/**
 * Test d'intégration opt-in : réclamation sur `updatedAt` des JSON `settings` sur PostgreSQL RÉEL
 * (annona-dev uniquement), RECETTE-2810 point 16. Hors `npm run check`. Lancement :
 *   npx dotenv -e <chemin>/.env.local -- npm run test:pg-settings
 * Écritures concurrentes réelles (Promise.all, 10) avec un pool de 5 connexions, par les vrais services :
 *  (a) entreprise : dix réglages différents enregistrés en même temps — aucune clé perdue ;
 *  (b) entreprise : dix enregistrements simultanés des règles de dispatch — jamais d'écrasement
 *      silencieux : chaque enregistrement réussi a été écrit sur la version qu'il avait lue ;
 *  (c) compte : tableaux de bord, préférences client, mini-admin et écrivains tiers — aucune clé perdue ;
 *  (d) témoin : l'ancienne lecture-réécriture sans réclamation, mêmes conditions (perte constatée ou non).
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
  process.env.DATABASE_CONNECTION_LIMIT = "5";

  const { prisma } = await import("../../src/services/prisma/client");
  const { updateCompanySettingsWithClaim, updateUserSettingsWithClaim } = await import("../../src/lib/database/settings-claims");
  const { updateCompanyDispatchSettings } = await import("../../src/domains/company/dispatch-settings.service");
  const { updateCompanyLocationSettings } = await import("../../src/domains/company/location-settings.service");
  const { updateCompanyDeliveryOptions } = await import("../../src/domains/company/company-settings.service");
  const { updatePortalShowDriverPhone } = await import("../../src/domains/company/portal-settings.service");
  const { updateCompanyBillingSettings } = await import("../../src/domains/company/billing-settings.service");
  const { resetDashboardLayout } = await import("../../src/domains/back-office/dashboard-settings.service");
  const { resetPortalDashboardLayout } = await import("../../src/domains/client-portal/portal-dashboard-settings.service");
  const { updateClientSettings } = await import("../../src/domains/client-portal/settings.service");
  const { updateMiniAdminByAdmin } = await import("../../src/domains/user/user.service");
  const { DEFAULT_DISPATCH_SETTINGS } = await import("../../src/lib/validations/dispatch-settings");
  const { DEFAULT_DRIVER_LOCATION_SETTINGS } = await import("../../src/lib/validations/driver-location-settings");
  const { DEFAULT_BILLING_SETTINGS } = await import("../../src/lib/validations/billing-settings");

  const tag = randomUUID().slice(0, 8);
  const slug = `e2e-pgsettings-${tag}`;
  const report: Record<string, unknown> = { tag, connectionLimit: process.env.DATABASE_CONNECTION_LIMIT, parallel: PARALLEL };
  let companyId: string | null = null;
  const settle = (promise: Promise<unknown>) => promise.then(() => "saved", (error: Error) => error.message);
  const companySettings = async () =>
    ((await prisma.company.findUniqueOrThrow({ where: { id: companyId! }, select: { settings: true } })).settings ?? {}) as Record<string, unknown>;

  try {
    const roles = Object.fromEntries(
      (await prisma.role.findMany({ where: { systemRole: { in: ["COMPANY_ADMIN", "MINI_ADMIN", "CLIENT"] } }, select: { id: true, systemRole: true } }))
        .map((row) => [row.systemRole, row.id])
    ) as Record<"COMPANY_ADMIN" | "MINI_ADMIN" | "CLIENT", string>;
    assert.ok(roles.COMPANY_ADMIN && roles.MINI_ADMIN && roles.CLIENT, "PG_SETTINGS_ROLES_MISSING");
    const company = await prisma.company.create({
      data: { name: `E2E PG-SETTINGS ${tag}`, slug, isDemo: true, settings: { e2ePreexisting: { kept: true } } },
    });
    companyId = company.id;
    const user = (role: keyof typeof roles, name: string) => prisma.user.create({
      data: { authId: `${slug}-${name}`, email: `${name}@${slug}.invalid`, firstName: "E2E", lastName: name, status: "ACTIVE", roleId: roles[role], companyId: company.id, settings: { e2ePreexisting: { kept: true } } },
    });
    const client = await user("CLIENT", "client");
    const mini = await user("MINI_ADMIN", "mini");

    // (a) Dix réglages différents de l'entreprise, enregistrés en même temps.
    const extra = (key: string) => updateCompanySettingsWithClaim(company.id, { apply: (current) => ({ ...current, [key]: { tag } }) });
    const writers: Array<[string, () => Promise<unknown>]> = [
      ["dispatchRules", () => updateCompanyDispatchSettings(company.id, { ...DEFAULT_DISPATCH_SETTINGS, maxActiveDeliveriesPerDriver: 7 })],
      ["locationTracking", () => updateCompanyLocationSettings(company.id, { ...DEFAULT_DRIVER_LOCATION_SETTINGS, idleIntervalSeconds: 31 })],
      ["deliveryCategories", () => updateCompanyDeliveryOptions(company.id, { deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: true } })],
      ["portalShowDriverPhone", () => updatePortalShowDriverPhone(company.id, false)],
      ["billing", () => updateCompanyBillingSettings(company.id, DEFAULT_BILLING_SETTINGS)],
      ...["e2eA", "e2eB", "e2eC", "e2eD"].map((key): [string, () => Promise<unknown>] => [key, () => extra(key)]),
    ];
    const a = await Promise.all(writers.map(([, write]) => settle(write())));
    const afterA = await companySettings();
    const lostA = writers.filter(([key], index) => a[index] === "saved" && !(key in afterA)).map(([key]) => key);
    report.a = { saved: a.filter((r) => r === "saved").length, conflicts: a.filter((r) => r === "SETTINGS_CONFLICT").length, other: a.filter((r) => r !== "saved" && r !== "SETTINGS_CONFLICT"), lost: lostA, preexistingKept: Boolean(afterA.e2ePreexisting) };
    assert.deepEqual(a.filter((r) => r !== "saved" && r !== "SETTINGS_CONFLICT"), [], "a : seules issues permises : enregistré ou conflit 409");
    assert.deepEqual(lostA, [], "a : aucun enregistrement réussi perdu");
    assert.ok(afterA.e2ePreexisting, "a : clé préexistante conservée");
    assert.equal((afterA.dispatchRules as { maxActiveDeliveriesPerDriver?: number } | undefined)?.maxActiveDeliveriesPerDriver ?? 7, 7);

    // (b) Dix enregistrements simultanés des règles de dispatch : chaque succès s'appuie sur la version
    // qu'il a lue (sinon conflit). Preuve : la valeur finale est celle d'un succès, et chaque succès
    // a vu, à sa première lecture, la valeur écrite par le succès précédent (aucun saut silencieux).
    const seen: Array<{ value: number; firstRead: unknown }> = [];
    const b = await Promise.all(Array.from({ length: PARALLEL }, (_, index) => settle(
      updateCompanySettingsWithClaim(company.id, {
        apply: (current) => {
          if (!seen.some((entry) => entry.value === index)) seen.push({ value: index, firstRead: (current.dispatchRules as { e2eWriter?: number } | undefined)?.e2eWriter ?? null });
          return { ...current, dispatchRules: { ...(current.dispatchRules as object), e2eWriter: index } };
        },
        section: (current) => current.dispatchRules ?? null,
      })
    )));
    const savedB = b.map((r, index) => (r === "saved" ? index : -1)).filter((index) => index >= 0);
    const afterB = await companySettings();
    const finalB = (afterB.dispatchRules as { e2eWriter?: number }).e2eWriter;
    report.b = { saved: savedB.length, conflicts: b.filter((r) => r === "SETTINGS_CONFLICT").length, final: finalB };
    assert.deepEqual(b.filter((r) => r !== "saved" && r !== "SETTINGS_CONFLICT"), [], "b : seules issues permises");
    assert.ok(savedB.length >= 1, "b : au moins un enregistrement");
    assert.ok(savedB.includes(finalB!), "b : la valeur finale est celle d'un enregistrement réussi");
    // Chaîne des succès : chacun a lu la valeur du précédent (premier succès : valeur de (a), sans e2eWriter).
    const readsBySaved = new Set(savedB.map((index) => seen.find((entry) => entry.value === index)!.firstRead));
    assert.equal(readsBySaved.size, savedB.length, "b : deux succès n'ont jamais lu la même version (pas d'écrasement)");
    assert.ok(afterB.e2eA && afterB.billing && afterB.e2ePreexisting, "b : autres clés intactes");

    // (c) Compte : dix écritures simultanées de clés différentes du même utilisateur.
    const userExtra = (id: string, key: string) => updateUserSettingsWithClaim(id, { apply: (current) => ({ ...current, [key]: { tag } }) });
    const c = await Promise.all([
      settle(resetDashboardLayout(client.id)),
      settle(resetPortalDashboardLayout(client.id)),
      settle(updateClientSettings(client.id, { invoiceAlerts: false })),
      ...["u1", "u2", "u3", "u4", "u5"].map((key) => settle(userExtra(client.id, key))),
      settle(updateMiniAdminByAdmin(mini.id, { miniAdminTitle: "E2E", miniAdminModules: [] }, company.id, "COMPANY_ADMIN")),
      settle(userExtra(mini.id, "u6")),
    ]);
    const clientAfter = ((await prisma.user.findUniqueOrThrow({ where: { id: client.id }, select: { settings: true } })).settings ?? {}) as Record<string, unknown>;
    const miniAfter = ((await prisma.user.findUniqueOrThrow({ where: { id: mini.id }, select: { settings: true } })).settings ?? {}) as Record<string, unknown>;
    const expectedClient: Array<[number, (s: Record<string, unknown>) => boolean]> = [
      [0, (s) => Boolean((s.backOffice as { dashboard?: unknown } | undefined)?.dashboard)],
      [1, (s) => Boolean((s.portal as { dashboard?: unknown } | undefined)?.dashboard)],
      [2, (s) => s.invoiceAlerts === false],
      ...[3, 4, 5, 6, 7].map((index): [number, (s: Record<string, unknown>) => boolean] => [index, (s) => Boolean(s[`u${index - 2}`])]),
    ];
    const lostC = expectedClient.filter(([index, present]) => c[index] === "saved" && !present(clientAfter)).map(([index]) => index);
    if (c[8] === "saved" && !miniAfter.miniAdmin) lostC.push(8);
    if (c[9] === "saved" && !miniAfter.u6) lostC.push(9);
    report.c = { saved: c.filter((r) => r === "saved").length, conflicts: c.filter((r) => r === "SETTINGS_CONFLICT").length, other: c.filter((r) => r !== "saved" && r !== "SETTINGS_CONFLICT"), lost: lostC };
    assert.deepEqual(c.filter((r) => r !== "saved" && r !== "SETTINGS_CONFLICT"), [], "c : seules issues permises");
    assert.deepEqual(lostC, [], "c : aucun enregistrement réussi perdu");
    assert.ok(clientAfter.e2ePreexisting && miniAfter.e2ePreexisting, "c : clés préexistantes conservées");

    // (d) Témoin : ancienne lecture-réécriture (findUnique puis update du JSON entier), mêmes conditions.
    await prisma.company.update({ where: { id: company.id }, data: { settings: { e2ePreexisting: { kept: true } } } });
    const naive = async (key: string) => {
      const row = await prisma.company.findUniqueOrThrow({ where: { id: company.id }, select: { settings: true } });
      await prisma.company.update({ where: { id: company.id }, data: { settings: { ...(row.settings as object), [key]: { tag } } } });
    };
    const naiveKeys = Array.from({ length: PARALLEL }, (_, index) => `naive${index}`);
    await Promise.all(naiveKeys.map((key) => naive(key)));
    const afterD = await companySettings();
    report.d = { oldPatternLostKeys: naiveKeys.filter((key) => !(key in afterD)).length, of: PARALLEL };

    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    const cleanup: Record<string, number> = {};
    if (companyId) {
      cleanup.users = (await prisma.user.deleteMany({ where: { companyId } })).count;
      cleanup.companies = (await prisma.company.deleteMany({ where: { id: companyId } })).count;
    }
    cleanup.leftover = await prisma.company.count({ where: { slug: { startsWith: "e2e-pgsettings-" } } });
    report.cleanup = cleanup;
    await prisma.$disconnect();
    console.log(JSON.stringify(report, null, 2));
  }
}

void main();
