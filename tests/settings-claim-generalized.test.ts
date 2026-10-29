import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { updateSettingsWithClaim, settingsSection } from "../src/lib/database/claimed-settings-update";
import { resolveApiError } from "../src/lib/api/route-handler";
import { updateCompanyDispatchSettings } from "../src/domains/company/dispatch-settings.service";
import { updateCompanyLocationSettings } from "../src/domains/company/location-settings.service";
import { updateCompanyTariffSettings } from "../src/domains/company/tariff-settings.service";
import { updateCompanyDeliveryOptions } from "../src/domains/company/company-settings.service";
import { resetDashboardLayout } from "../src/domains/back-office/dashboard-settings.service";
import { resetPortalDashboardLayout } from "../src/domains/client-portal/portal-dashboard-settings.service";
import { updateClientSettings } from "../src/domains/client-portal/settings.service";
import { DEFAULT_DISPATCH_SETTINGS } from "../src/lib/validations/dispatch-settings";
import { DEFAULT_DRIVER_LOCATION_SETTINGS } from "../src/lib/validations/driver-location-settings";
import { prisma } from "../src/services/prisma/client";

// RECETTE-2810 point 16 : chaque réglage enregistré dans un JSON `settings` passe par la réclamation
// sur `updatedAt`. La frontière simulée est Prisma (ligne en mémoire qui reproduit
// `updateMany({ where: { id, updatedAt } })`) ; les services testés sont les vrais.

type Row = { settings: Record<string, unknown>; updatedAt: Date };
const tick = () => new Promise((resolve) => setImmediate(resolve));

function stub(t: import("node:test").TestContext, delegate: object, key: string, fn: unknown) {
  const target = delegate as Record<string, unknown>;
  const original = target[key];
  target[key] = fn;
  t.after(() => { target[key] = original; });
}

/** Ligne unique en mémoire ; chaque lecture et écriture laisse les autres écrivains s'intercaler. */
function memoryStore(t: import("node:test").TestContext, delegate: object, loadKey: "findUnique" | "findFirst", settings: Record<string, unknown>) {
  const row: Row = { settings: structuredClone(settings), updatedAt: new Date("2026-10-29T08:00:00.000Z") };
  let writes = 0;
  stub(t, delegate, loadKey, async () => { await tick(); return { settings: structuredClone(row.settings), updatedAt: row.updatedAt }; });
  stub(t, delegate, "updateMany", async (args: { where: { updatedAt: Date }; data: { settings: Record<string, unknown>; updatedAt: Date } }) => {
    await tick();
    if (args.where.updatedAt.getTime() !== row.updatedAt.getTime()) return { count: 0 };
    assert.ok(args.data.updatedAt.getTime() > row.updatedAt.getTime(), "version strictement croissante");
    row.settings = structuredClone(args.data.settings);
    row.updatedAt = args.data.updatedAt;
    writes += 1;
    return { count: 1 };
  });
  stub(t, delegate, "update", async () => { throw new Error("écriture de settings non réclamée"); });
  return { row, get writes() { return writes; } };
}

const settle = (promise: Promise<unknown>) => promise.then(() => "saved", (error: Error) => error.message);

test("section : deux enregistrements simultanés du même réglage — le second reçoit SETTINGS_CONFLICT, rien n'est écrasé", async () => {
  const row: Row = { settings: { billing: { a: 1 } }, updatedAt: new Date("2026-10-29T08:00:00.000Z") };
  const load = async () => { await tick(); return { settings: structuredClone(row.settings), updatedAt: row.updatedAt }; };
  const save = async (next: Record<string, unknown>, claim: { expected: Date; next: Date }) => {
    await tick();
    if (row.updatedAt.getTime() !== claim.expected.getTime()) return false;
    row.settings = next; row.updatedAt = claim.next; return true;
  };
  const writer = (value: number) => updateSettingsWithClaim({ load, save, apply: (c) => ({ ...c, dispatchRules: { v: value } }), section: settingsSection("dispatchRules") });
  const results = await Promise.all([settle(writer(1)), settle(writer(2))]);
  assert.deepEqual([...results].sort(), ["SETTINGS_CONFLICT", "saved"]);
  const winner = results[0] === "saved" ? 1 : 2;
  assert.deepEqual(row.settings, { billing: { a: 1 }, dispatchRules: { v: winner } }, "seul le premier enregistrement est écrit");
});

test("entreprise : dispatch, localisation, tarifs et catégories enregistrés en même temps — aucune clé perdue", async (t) => {
  const store = memoryStore(t, prisma.company, "findUnique", { billing: { invoice: { vatRate: 20 } }, einvoicing: { vatNumber: "FR00" } });
  const dispatch = { ...DEFAULT_DISPATCH_SETTINGS, maxActiveDeliveriesPerDriver: 4 };
  const location = { ...DEFAULT_DRIVER_LOCATION_SETTINGS, idleIntervalSeconds: 30 };
  const tariffs = { tariffZones: [], tariffFees: [] };
  const categories = { deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: true } };
  const results = await Promise.all([
    settle(updateCompanyDispatchSettings("company-a", dispatch)),
    settle(updateCompanyLocationSettings("company-a", location)),
    settle(updateCompanyTariffSettings("company-a", tariffs)),
    settle(updateCompanyDeliveryOptions("company-a", categories)),
  ]);
  // Quatre écrivains, trois tentatives chacun : un conflit est permis, jamais une perte silencieuse.
  const saved = results.filter((result) => result === "saved").length;
  assert.ok(results.every((result) => result === "saved" || result === "SETTINGS_CONFLICT"), results.join());
  assert.equal(store.writes, saved, "une écriture par enregistrement réussi");
  assert.deepEqual(store.row.settings.billing, { invoice: { vatRate: 20 } });
  assert.deepEqual(store.row.settings.einvoicing, { vatNumber: "FR00" });
  if (results[0] === "saved") assert.equal((store.row.settings.dispatchRules as { maxActiveDeliveriesPerDriver: number }).maxActiveDeliveriesPerDriver, 4);
  if (results[1] === "saved") assert.equal((store.row.settings.locationTracking as { idleIntervalSeconds: number }).idleIntervalSeconds, 30);
  if (results[2] === "saved") assert.deepEqual(store.row.settings.tariffZones, []);
  if (results[3] === "saved") assert.deepEqual(store.row.settings.deliveryCategories, categories.deliveryCategories);
});

test("entreprise : deux enregistrements simultanés des règles de dispatch — 409 au second, le premier reste", async (t) => {
  const store = memoryStore(t, prisma.company, "findUnique", { tariffZones: [] });
  const results = await Promise.all([
    settle(updateCompanyDispatchSettings("company-a", { ...DEFAULT_DISPATCH_SETTINGS, maxActiveDeliveriesPerDriver: 5 })),
    settle(updateCompanyDispatchSettings("company-a", { ...DEFAULT_DISPATCH_SETTINGS, maxActiveDeliveriesPerDriver: 6 })),
  ]);
  assert.deepEqual([...results].sort(), ["SETTINGS_CONFLICT", "saved"]);
  const expected = results[0] === "saved" ? 5 : 6;
  assert.equal((store.row.settings.dispatchRules as { maxActiveDeliveriesPerDriver: number }).maxActiveDeliveriesPerDriver, expected);
  assert.deepEqual(resolveApiError(new Error(results.find((r) => r !== "saved"))), {
    status: 409,
    message: "Les réglages ont changé pendant l'enregistrement. Rechargez puis réessayez.",
  });
});

test("compte : tableaux de bord et préférences client enregistrés en même temps — les clés du suivi restent", async (t) => {
  const tracking = { trackingService: { active: true, startedAt: "2026-10-29T07:00:00.000Z", endedAt: null } };
  const store = memoryStore(t, prisma.user, "findFirst", { ...tracking, invoiceIdentity: { city: "Lyon" } });
  const results = await Promise.all([
    settle(resetDashboardLayout("user-a")),
    settle(resetPortalDashboardLayout("user-a")),
    settle(updateClientSettings("user-a", { invoiceAlerts: false })),
  ]);
  assert.ok(results.every((result) => result === "saved" || result === "SETTINGS_CONFLICT"), results.join());
  assert.deepEqual(store.row.settings.trackingService, tracking.trackingService);
  assert.deepEqual(store.row.settings.invoiceIdentity, { city: "Lyon" });
  if (results[2] === "saved") {
    assert.equal(store.row.settings.invoiceAlerts, false);
    assert.equal(store.row.settings.emailNotifications, true, "valeur par défaut conservée");
    assert.equal(store.row.settings.smsNotifications, false);
  }
});

test("compte : deux enregistrements simultanés des préférences — le second reçoit SETTINGS_CONFLICT", async (t) => {
  const store = memoryStore(t, prisma.user, "findFirst", {});
  const results = await Promise.all([
    settle(updateClientSettings("user-a", { invoiceAlerts: false })),
    settle(updateClientSettings("user-a", { deliveryAlerts: false })),
  ]);
  assert.deepEqual([...results].sort(), ["SETTINGS_CONFLICT", "saved"]);
  assert.equal(store.writes, 1);
});

test("compte : utilisateur absent — USER_NOT_FOUND, aucune écriture", async (t) => {
  stub(t, prisma.user, "findFirst", async () => null);
  stub(t, prisma.user, "updateMany", async () => { throw new Error("ne doit pas écrire"); });
  await assert.rejects(updateClientSettings("user-z", { invoiceAlerts: false }), /USER_NOT_FOUND/);
  await assert.rejects(resetDashboardLayout("user-z"), /USER_NOT_FOUND/);
});

// Inventaire statique : toute écriture de `settings` sur Company ou User passe par une réclamation.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Remplacement complet volontaire : (re)provisionnement d'une entreprise de démo. */
const DELIBERATE_RESETS = new Set(["src/domains/demo/demo-provision.service.ts"]);

test("inventaire : aucune lecture-réécriture de settings sans réclamation dans src/", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.(company|user)\.(update|upsert|updateMany)\(\{/g)) {
      const call = source.slice(match.index!, match.index! + 600);
      const end = call.indexOf("\n  });") > 0 ? call.indexOf("\n  });") : call.length;
      const body = call.slice(0, end);
      if (!/\bsettings\b(?!:\s*true)/.test(body.replace(/select:\s*\{[^}]*\}/g, ""))) continue;
      const line = source.slice(0, match.index!).split("\n").length;
      const claimed = match[2] === "updateMany" && /updatedAt: (claim\.expected|driver\.updatedAt)|settings: \{ equals:/.test(body);
      if (!claimed && !DELIBERATE_RESETS.has(file)) offenders.push(`${file}:${line}`);
    }
  }
  assert.deepEqual(offenders, [], "écriture de settings non réclamée");
});
