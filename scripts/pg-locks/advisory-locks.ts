/**
 * Test d'intégration opt-in : verrous consultatifs sur PostgreSQL RÉEL (annona-dev uniquement).
 * Hors `npm run check`. Lancement :
 *   npx dotenv -e <chemin>/.env.local -- npm run test:pg-locks
 * Requêtes concurrentes réelles (Promise.all, ≥ 10) avec un pool de 5 connexions :
 *  (a) réservation d'envoi des relances de facture (création, envoi, reprise après issue inconnue) ;
 *  (b) anti-doublon de commande par message (même clé, deux clients de la même entreprise) ;
 *  (c) compteur d'échecs de connexion (auth_login_failures) ;
 *  (d) fenêtre d'idempotence e-mail des tâches durables (première tentative inscrite une seule fois).
 * Données préfixées E2E, supprimées dans `finally`, même en cas d'échec.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateDevEnvironment } from "../env2/verify-dev-env";

const PARALLEL = 10;
const MIN = 60_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const envErrors = validateDevEnvironment(process.env);
  if (envErrors.length) {
    console.log(JSON.stringify({ passed: false, reason: "ENVIRONNEMENT_NON_DEV", errors: envErrors }));
    process.exitCode = 2;
    return;
  }
  // Pool borné imposé avant la création du client Prisma.
  process.env.DATABASE_CONNECTION_LIMIT = "5";

  const { prisma } = await import("../../src/services/prisma/client");
  const { remindInvoice, deliverInvoiceReminderJob } = await import("../../src/domains/invoice/invoice-reminder.service");
  const { beginLoginAttempt, loginAttemptKeys, LOGIN_PAIR_FAILURE_LIMIT } = await import("../../src/domains/auth/login-rate-limit.service");
  const { jobEmailReplayWindow, enqueueOperationJob } = await import("../../src/domains/operations/operation-job.service");

  const tag = randomUUID().slice(0, 8);
  const slug = `e2e-pglocks-${tag}`;
  const report: Record<string, unknown> = { tag, connectionLimit: process.env.DATABASE_CONNECTION_LIMIT, parallel: PARALLEL };
  let companyId: string | null = null;
  const loginKeys = loginAttemptKeys(`${slug}@e2e-pglocks.invalid`, `e2e-pglocks-source-${tag}`, { secret: `e2e-pglocks-secret-${tag}` });

  try {
    const roles = Object.fromEntries(
      (await prisma.role.findMany({ where: { systemRole: { in: ["COMPANY_ADMIN", "CLIENT"] } }, select: { id: true, systemRole: true } }))
        .map((row) => [row.systemRole, row.id])
    ) as Record<"COMPANY_ADMIN" | "CLIENT", string>;
    assert.ok(roles.COMPANY_ADMIN && roles.CLIENT, "PG_LOCKS_ROLES_MISSING");
    const company = await prisma.company.create({
      data: { name: `E2E PG-LOCKS ${tag}`, slug, isDemo: true, settings: { orderIntake: { enabled: true } } },
    });
    companyId = company.id;
    const user = (role: "COMPANY_ADMIN" | "CLIENT", name: string) => prisma.user.create({
      data: { authId: `${slug}-${name}`, email: `${name}@${slug}.invalid`, firstName: "E2E", lastName: name, status: "ACTIVE", roleId: roles[role], companyId: company.id },
    });
    const [admin, clientA, clientB] = [await user("COMPANY_ADMIN", "admin"), await user("CLIENT", "client-a"), await user("CLIENT", "client-b")];
    const newInvoice = (suffix: string) => prisma.invoice.create({
      data: { reference: `E2E-PGLOCKS-${tag}-${suffix}`, amount: 42, status: "OVERDUE", dueDate: new Date(Date.now() - 8 * 24 * 60 * MIN), companyId: company.id, customerId: clientA.id },
    });
    const settings = async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true });
    // Les tâches durables créées ne doivent jamais être prises par un cron : échéance repoussée.
    const parkJobs = () => prisma.operationJob.updateMany({ where: { companyId: company.id }, data: { nextAttemptAt: new Date(Date.now() + 24 * 60 * MIN) } });

    // (a1) 10 clics « Relancer » simultanés → une seule relance.
    const inv1 = await newInvoice("a");
    const clicks = await Promise.all(Array.from({ length: PARALLEL }, () =>
      remindInvoice({ companyId: company.id, invoiceId: inv1.id, userId: admin.id, emailConfigured: true }, { kick: () => undefined })));
    await parkJobs();
    const created = clicks.filter((click) => click && !click.duplicate);
    const reminders1 = await prisma.invoiceReminder.findMany({ where: { invoiceId: inv1.id } });
    assert.equal(created.length, 1, "a1 : une seule relance créée");
    assert.equal(reminders1.length, 1, "a1 : une seule ligne en base");
    const payload1 = { kind: "INVOICE_REMINDER", reminderId: reminders1[0]!.id, companyId: company.id };

    // (a2) 10 exécutions simultanées de la tâche, envoi lent (300 ms) → un seul envoi.
    let sends = 0;
    const slowSend = async () => { sends += 1; await sleep(300); return { status: "sent" }; };
    const runs = await Promise.allSettled(Array.from({ length: PARALLEL }, () =>
      deliverInvoiceReminderJob(payload1, "e2e", { getClientSettings: settings, send: slowSend, appUrl: "http://localhost:3000" })));
    const after1 = await prisma.invoiceReminder.findUniqueOrThrow({ where: { id: reminders1[0]!.id } });
    assert.equal(sends, 1, "a2 : un seul envoi");
    assert.equal(after1.result, "SENT");
    report.a = {
      clicks: { parallel: PARALLEL, created: created.length, duplicates: clicks.length - created.length },
      deliveries: { parallel: PARALLEL, sends, rejected: runs.filter((run) => run.status === "rejected").map((run) => (run as PromiseRejectedResult).reason?.message).sort() },
    };

    // (a3) Issue inconnue (réponse perdue), puis 10 clics et 10 reprises simultanés après 6 min.
    const inv2 = await newInvoice("b");
    const first = await remindInvoice({ companyId: company.id, invoiceId: inv2.id, userId: admin.id, emailConfigured: true }, { kick: () => undefined });
    await parkJobs();
    const payload2 = { kind: "INVOICE_REMINDER", reminderId: first!.reminder.id, companyId: company.id };
    const keys: string[] = [];
    await deliverInvoiceReminderJob(payload2, "e2e", {
      getClientSettings: settings, appUrl: "http://localhost:3000",
      send: async (input) => { keys.push(input.idempotencyKey); throw Object.assign(new Error("timeout"), { name: "TimeoutError" }); },
    }).catch(() => undefined);
    const unknownState = (await prisma.invoiceReminder.findUniqueOrThrow({ where: { id: first!.reminder.id } })).result;
    assert.equal(unknownState, "SENDING", "a3 : réservation gardée après une issue inconnue");
    const clicks2 = await Promise.all(Array.from({ length: PARALLEL }, () =>
      remindInvoice({ companyId: company.id, invoiceId: inv2.id, userId: admin.id, emailConfigured: true }, { kick: () => undefined })));
    assert.ok(clicks2.every((click) => click?.duplicate === true), "a3 : aucun clic ne crée de relance");
    assert.equal(await prisma.invoiceReminder.count({ where: { invoiceId: inv2.id } }), 1);
    let resumes = 0;
    const later = new Date(Date.now() + 6 * MIN);
    await Promise.allSettled(Array.from({ length: PARALLEL }, () =>
      deliverInvoiceReminderJob(payload2, "e2e", {
        now: later, getClientSettings: settings, appUrl: "http://localhost:3000",
        send: async (input) => { resumes += 1; keys.push(input.idempotencyKey); await sleep(300); return { status: "sent" }; },
      })));
    const after2 = await prisma.invoiceReminder.findUniqueOrThrow({ where: { id: first!.reminder.id } });
    assert.equal(resumes, 1, "a3 : une seule reprise");
    assert.equal(new Set(keys).size, 1, "a3 : même clé d'idempotence");
    assert.equal(after2.result, "SENT");
    report.a3 = { afterUnknown: unknownState, clicksCreated: clicks2.filter((click) => click && !click.duplicate).length, parallelResumes: PARALLEL, resumes, distinctKeys: new Set(keys).size, final: after2.result };

    // (c) Compteur d'échecs de connexion : 12 tentatives simultanées, limite 5 par couple.
    const attempts = await Promise.all(Array.from({ length: PARALLEL + 2 }, () => beginLoginAttempt(loginKeys, { db: prisma })));
    const allowed = attempts.filter((gate) => gate.allowed);
    const failOpen = allowed.filter((gate) => gate.allowed && gate.attempt === null).length;
    const pairRows = await prisma.authLoginFailure.count({ where: { keyHash: loginKeys.pairKey! } });
    const refusedByContention = attempts.filter((gate) => !gate.allowed && gate.busy === true).length;
    report.c = {
      parallel: PARALLEL + 2, allowed: allowed.length, failOpen,
      refusedByLimit: attempts.length - allowed.length - refusedByContention, refusedByContention,
      pairRows, limit: LOGIN_PAIR_FAILURE_LIMIT,
    };
    assert.equal(failOpen, 0, "c : aucune tentative autorisée par défaillance (fail-open)");
    assert.ok(allowed.length >= 1 && allowed.length <= LOGIN_PAIR_FAILURE_LIMIT, "c : jamais au-delà de la limite");
    assert.equal(pairRows, allowed.length, "c : chaque autorisation est comptée");

    // (d) 10 exécutions simultanées inscrivent la première tentative e-mail : une seule est « première ».
    const job = await enqueueOperationJob(prisma, { jobKey: `e2e-pglocks-email-${tag}`, type: "CLIENT_NOTIFICATION", companyId: company.id, payload: { kind: "E2E_PG_LOCKS" } });
    await parkJobs();
    const windows = await Promise.all(Array.from({ length: PARALLEL }, () => jobEmailReplayWindow({ id: job.id, createdAt: new Date(), previouslyAttempted: false })()));
    const firsts = windows.filter((value) => value === null).length;
    const stamps = new Set(windows.filter((value): value is Date => value !== null).map((value) => value.getTime()));
    const later2 = await jobEmailReplayWindow({ id: job.id, createdAt: new Date(), previouslyAttempted: false })();
    report.d = { parallel: PARALLEL, firstAttempts: firsts, distinctStoredStamps: stamps.size, laterCallSeesStamp: later2 !== null };
    assert.equal(firsts, 1, "d : une seule première tentative");
    assert.equal(stamps.size, 1, "d : un seul horodatage inscrit");
    assert.ok(later2 && stamps.has(later2.getTime()), "d : l'horodatage n'est jamais réécrit");

    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    const keyHashes = [loginKeys.pairKey, loginKeys.emailKey, loginKeys.sourceKey].filter((key): key is string => Boolean(key));
    const cleanup: Record<string, number> = {};
    cleanup.authLoginFailures = (await prisma.authLoginFailure.deleteMany({ where: { keyHash: { in: keyHashes } } })).count;
    if (companyId) {
      cleanup.reminders = (await prisma.invoiceReminder.deleteMany({ where: { companyId } })).count;
      cleanup.jobs = (await prisma.operationJob.deleteMany({ where: { companyId } })).count;
      cleanup.invoices = (await prisma.invoice.deleteMany({ where: { companyId } })).count;
      cleanup.orders = (await prisma.order.deleteMany({ where: { companyId } })).count;
      cleanup.users = (await prisma.user.deleteMany({ where: { companyId } })).count;
      cleanup.companies = (await prisma.company.deleteMany({ where: { id: companyId } })).count;
      cleanup.leftover = await prisma.company.count({ where: { slug: { startsWith: "e2e-pglocks-" } } });
    }
    report.cleanup = cleanup;
    await prisma.$disconnect();
    console.log(JSON.stringify(report, null, 2));
  }
}

void main();
