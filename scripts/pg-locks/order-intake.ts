/**
 * Test d'intégration opt-in : SQL de la commande par message sur PostgreSQL RÉEL (tutelliv-dev uniquement).
 * Hors `npm run check`. Lancement :
 *   npx dotenv -e <chemin>/.env.local -- npm run test:pg-intake
 * (a) rapprochement de l'expéditeur par téléphone (`regexp_replace` sur des formats variés, clients actifs
 *     de l'entreprise seulement, ambiguïté = aucun rapprochement) ;
 * (b) plafond horaire sous concurrence (verrou consultatif) : 10 réservations simultanées pour 2 places.
 * Données préfixées E2E, supprimées dans `finally`, même en cas d'échec.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateDevEnvironment } from "../env2/verify-dev-env";

const PARALLEL = 10;

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
  const { matchCustomerBySender } = await import("../../src/domains/order-intake/order-intake.customer");
  const { reserveOrderIntakeCall, ORDER_INTAKE_HOURLY_LIMIT } = await import("../../src/domains/order-intake/order-intake.usage");

  const tag = randomUUID().slice(0, 8);
  const slug = `e2e-pgintake-${tag}`;
  const report: Record<string, unknown> = { tag, connectionLimit: process.env.DATABASE_CONNECTION_LIMIT, parallel: PARALLEL };
  const companyIds: string[] = [];

  try {
    const roles = Object.fromEntries(
      (await prisma.role.findMany({ where: { systemRole: { in: ["COMPANY_ADMIN", "CLIENT"] } }, select: { id: true, systemRole: true } }))
        .map((row) => [row.systemRole, row.id])
    ) as Record<"COMPANY_ADMIN" | "CLIENT", string>;
    assert.ok(roles.COMPANY_ADMIN && roles.CLIENT, "PG_INTAKE_ROLES_MISSING");
    const company = await prisma.company.create({ data: { name: `E2E PG-INTAKE ${tag}`, slug, isDemo: true } });
    const other = await prisma.company.create({ data: { name: `E2E PG-INTAKE autre ${tag}`, slug: `${slug}-autre`, isDemo: true } });
    companyIds.push(company.id, other.id);
    const user = (name: string, phone: string, options: { role?: "COMPANY_ADMIN" | "CLIENT"; status?: "ACTIVE" | "INACTIVE"; companyId?: string } = {}) =>
      prisma.user.create({
        data: {
          authId: `${slug}-${name}`, email: `${name}@${slug}.invalid`, firstName: "E2E", lastName: name, phone,
          status: options.status ?? "ACTIVE", roleId: roles[options.role ?? "CLIENT"], companyId: options.companyId ?? company.id,
        },
      });
    const a = await user("plus33", "+33 6 12 34 56 78");
    const b = await user("points", "06.98.76.54.32");
    const c = await user("double-zero", "0033 (0)6 55 44 33 22".replace("(0)", ""));
    await user("inactif", "06 11 11 11 11", { status: "INACTIVE" });
    await user("ambigu-1", "07 00 00 00 01");
    await user("ambigu-2", "+33700000001");
    await user("admin", "06 33 33 33 33", { role: "COMPANY_ADMIN" });
    await user("autre-entreprise", "06 22 22 22 22", { companyId: other.id });

    // (a) Rapprochement par téléphone.
    const cases: Array<[string, string | null]> = [
      ["+33612345678", a.id],
      ["06 12 34 56 78", a.id],
      ["0033 6 12 34 56 78", a.id],
      ["06-98-76-54-32", b.id],
      ["+33 6 98 76 54 32", b.id],
      ["06 55 44 33 22", c.id],
      ["06 11 11 11 11", null], // client inactif
      ["07 00 00 00 01", null], // deux clients : ambiguïté
      ["06 33 33 33 33", null], // administrateur, pas un client
      ["06 22 22 22 22", null], // client d'une autre entreprise
      ["06 00 00 00 00", null], // inconnu
    ];
    const phoneResults = [];
    for (const [sender, expected] of cases) {
      const match = await matchCustomerBySender(company.id, sender);
      phoneResults.push({ sender, expected: expected ? "client" : null, got: match?.customerId ? (match.customerId === expected ? "client attendu" : "AUTRE CLIENT") : null });
      assert.equal(match?.customerId ?? null, expected, `rapprochement ${sender}`);
      if (expected) assert.equal(match?.matchedBy, "phone");
    }
    report.phone = { cases: cases.length, results: phoneResults };

    // (b) Plafond horaire sous concurrence : on remplit jusqu'à 2 places du plafond, puis 10 réservations simultanées.
    const now = new Date();
    const prefill = ORDER_INTAKE_HOURLY_LIMIT - 2;
    await prisma.orderIntakeUsage.createMany({
      data: Array.from({ length: prefill }, (_, index) => ({
        companyId: company.id, status: "SUCCEEDED" as const, model: "e2e-pgintake",
        createdAt: new Date(now.getTime() - (50 - (index % 40)) * 60_000),
      })),
    });
    const results = await Promise.all(Array.from({ length: PARALLEL }, () => reserveOrderIntakeCall(company.id, "e2e-pgintake", now)));
    const reserved = results.filter((result) => result.status === "reserved").length;
    const limited = results.filter((result) => result.status === "rate_limited");
    const total = await prisma.orderIntakeUsage.count({ where: { companyId: company.id } });
    report.quota = { limit: ORDER_INTAKE_HOURLY_LIMIT, prefill, reserved, rateLimited: limited.length, totalRows: total, retryAfterSeconds: [...new Set(limited.map((result) => result.retryAfterSeconds))] };
    assert.equal(reserved, 2, "exactement deux places réservées");
    assert.equal(limited.length, PARALLEL - 2);
    assert.equal(total, ORDER_INTAKE_HOURLY_LIMIT, "jamais au-delà du plafond");
    assert.ok(limited.every((result) => result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 3600));

    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    const cleanup: Record<string, number> = {};
    if (companyIds.length) {
      cleanup.usage = (await prisma.orderIntakeUsage.deleteMany({ where: { companyId: { in: companyIds } } })).count;
      cleanup.users = (await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } })).count;
      cleanup.companies = (await prisma.company.deleteMany({ where: { id: { in: companyIds } } })).count;
      cleanup.leftover = await prisma.company.count({ where: { slug: { startsWith: "e2e-pgintake-" } } });
    }
    report.cleanup = cleanup;
    await prisma.$disconnect();
    console.log(JSON.stringify(report, null, 2));
  }
}

void main();
