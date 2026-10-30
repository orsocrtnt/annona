// EMAIL / SEC-05 — recette réelle sur `tutelliv-dev` (ENV-2), envoi Resend en mode test (boîte contrôlée).
// Rejoue : échec d'envoi visible puis reprise, rejeu sans doublon, préférences respectées.
// Données E2E identifiables (facture `E2E-MAIL-…`), supprimées à la fin ; réglages du client restaurés.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { queueInvoiceIssuedNotification } from "@/domains/client-portal/notify.service";
import { processOperationJob } from "@/domains/operations/operation-job.service";
import { validateDevEnvironment } from "../env2/verify-dev-env";

const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

async function runJob(jobId: string) {
  // Comme le cron plus tard : l'échéance de reprise est avancée à maintenant.
  await prisma.operationJob.update({ where: { id: jobId }, data: { nextAttemptAt: new Date() } });
  const job = await processOperationJob(jobId);
  return { status: job?.status, attempts: job?.attempts, lastError: job?.lastError ?? null };
}

async function main() {
  const errors = validateDevEnvironment(process.env);
  if (errors.length) throw new Error(`DEV_ENVIRONMENT_REQUIRED:${errors.join(",")}`);
  process.env.EMAIL_DELIVERY_MODE = "test";
  const realKey = process.env.RESEND_API_KEY;
  if (!realKey || !process.env.EMAIL_TEST_RECIPIENT) throw new Error("EMAIL_TEST_CONFIG_REQUIRED");

  const client = await prisma.user.findFirst({
    where: { role: { systemRole: "CLIENT" }, companyId: { not: null } },
    select: { id: true, companyId: true, settings: true },
    orderBy: { createdAt: "asc" },
  });
  if (!client?.companyId) throw new Error("CLIENT_FIXTURE_MISSING");
  const original = client.settings;
  const base = original && typeof original === "object" && !Array.isArray(original) ? (original as Record<string, unknown>) : {};
  const setPrefs = (prefs: Record<string, boolean>) =>
    prisma.user.update({ where: { id: client.id }, data: { settings: { ...base, ...prefs } as Prisma.InputJsonObject } });

  const invoices: string[] = [];
  const jobKeys: string[] = [];
  const makeInvoice = async (suffix: string) => {
    const invoice = await prisma.invoice.create({
      data: { reference: `E2E-MAIL-${stamp}-${suffix}`, amount: 12.5, companyId: client.companyId!, customerId: client.id, lineItems: [] },
      select: { id: true, reference: true },
    });
    invoices.push(invoice.id);
    const job = await queueInvoiceIssuedNotification(prisma, { customerId: client.id, companyId: client.companyId!, reference: invoice.reference, invoiceId: invoice.id, amount: 12.5 });
    jobKeys.push(job!.jobKey);
    return { ...invoice, jobId: job!.id };
  };

  const report: Record<string, unknown> = { stamp };
  try {
    await setPrefs({ emailNotifications: true, invoiceAlerts: true });

    // 1. Échec visible puis reprise : clé Resend invalide, puis la vraie.
    const a = await makeInvoice("A");
    process.env.RESEND_API_KEY = "re_invalid_e2e_key_for_failure";
    const failed = await runJob(a.jobId);
    process.env.RESEND_API_KEY = realKey;
    const recovered = await runJob(a.jobId);
    // 2. Rejeu de la même tâche (même clé d'idempotence) : Resend ne doit pas renvoyer.
    await prisma.operationJob.update({ where: { id: a.jobId }, data: { status: "PENDING", completedAt: null } });
    const replayed = await runJob(a.jobId);
    const notificationsA = await prisma.clientNotification.count({ where: { userId: client.id, body: { contains: a.reference } } });
    report.failureThenRecovery = { reference: a.reference, failed, recovered, replayed, inAppNotifications: notificationsA };

    // 3. Préférence « alertes facture » coupée : aucune notification ni e-mail.
    await setPrefs({ emailNotifications: true, invoiceAlerts: false });
    const b = await makeInvoice("B");
    const muted = await runJob(b.jobId);
    const notificationsB = await prisma.clientNotification.count({ where: { userId: client.id, body: { contains: b.reference } } });
    report.invoiceAlertsOff = { reference: b.reference, job: muted, inAppNotifications: notificationsB };

    // 4. E-mails coupés mais alertes actives : notification in-app seulement.
    await setPrefs({ emailNotifications: false, invoiceAlerts: true });
    const c = await makeInvoice("C");
    const inAppOnly = await runJob(c.jobId);
    const notificationsC = await prisma.clientNotification.count({ where: { userId: client.id, body: { contains: c.reference } } });
    report.emailOff = { reference: c.reference, job: inAppOnly, inAppNotifications: notificationsC };
  } finally {
    process.env.RESEND_API_KEY = realKey;
    await prisma.user.update({ where: { id: client.id }, data: { settings: (original ?? {}) as object } });
    await prisma.clientNotification.deleteMany({ where: { userId: client.id, body: { contains: `E2E-MAIL-${stamp}` } } });
    await prisma.operationJob.deleteMany({ where: { jobKey: { in: jobKeys } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoices } } });
    report.cleanedUp = { invoices: invoices.length, jobs: jobKeys.length };
    await prisma.$disconnect();
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "EMAIL_REAL_RECETTE_FAILED");
  process.exitCode = 1;
});
