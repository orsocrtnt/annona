import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { updateSettingsWithClaim, settingsSection } from "../src/lib/database/claimed-settings-update";
import { resolveApiError } from "../src/lib/api/route-handler";
import { updateCompanyLocationSettings } from "../src/domains/company/location-settings.service";
import { updateClientSettings } from "../src/domains/client-portal/settings.service";
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

test("compte : deux enregistrements simultanés des préférences — le second reçoit SETTINGS_CONFLICT", async (t) => {
  const store = memoryStore(t, prisma.user, "findFirst", {});
  const results = await Promise.all([
    settle(updateClientSettings("user-a", { invoiceAlerts: false })),
    settle(updateClientSettings("user-a", { deliveryAlerts: false })),
  ]);
  assert.deepEqual([...results].sort(), ["SETTINGS_CONFLICT", "saved"]);
  assert.equal(store.writes, 1);
});

// Inventaire statique : toute écriture de `settings` sur Company ou User passe par une réclamation.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

/** Remplacement complet volontaire : (re)provisionnement d'une entreprise de démo ou d'un environnement d'offre de test. */
const DELIBERATE_RESETS = new Set<string>([]);

test("inventaire : aucune lecture-réécriture de settings sans réclamation dans src/", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\.(company|user)\.(update|upsert|updateMany)\(\{/g)) {
      const call = source.slice(match.index!, match.index! + 600);
      const end = call.indexOf("});") > 0 ? call.indexOf("});") : call.length;
      const body = call.slice(0, end);
      if (!/\bsettings\b(?!:\s*true)/.test(body.replace(/select:\s*\{[^}]*\}/g, ""))) continue;
      const line = source.slice(0, match.index!).split("\n").length;
      const claimed = match[2] === "updateMany" && /updatedAt: (claim\.expected|driver\.updatedAt)|settings: \{ equals:/.test(body);
      if (!claimed && !DELIBERATE_RESETS.has(file)) offenders.push(`${file}:${line}`);
    }
  }
  assert.deepEqual(offenders, [], "écriture de settings non réclamée");
});

test("inventaire (contrôle statique du texte SQL) : une écriture SQL brute de settings fait avancer updated_at", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles("src")) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/SET "settings" =/g)) {
      const statement = source.slice(match.index!, source.indexOf("`", match.index!));
      if (!/"updated_at" = GREATEST\(\(now\(\) AT TIME ZONE 'UTC'\)::timestamp\(3\), "updated_at" \+ interval '1 millisecond'\)/.test(statement)) {
        offenders.push(`${file}:${source.slice(0, match.index!).split("\n").length}`);
      }
    }
  }
  // SCHEMA-1 : plus aucune écriture SQL brute de settings (l'ancienne preuve de livraison est retirée).
  assert.deepEqual(offenders, []);
});
