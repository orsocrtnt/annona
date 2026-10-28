import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { updateSettingsWithClaim } from "../src/lib/database/claimed-settings-update";

/** Ligne en mémoire qui reproduit `updateMany({ where: { id, updatedAt } })` : 0 ligne si la version a changé. */
function memoryRow(settings: Record<string, unknown>) {
  const row = { settings: { ...settings }, updatedAt: new Date("2026-10-28T10:00:00.000Z") };
  return {
    row,
    load: async () => {
      await new Promise((resolve) => setImmediate(resolve)); // laisse l'autre écrivain s'intercaler
      return { settings: structuredClone(row.settings), updatedAt: row.updatedAt };
    },
    save: async (next: Record<string, unknown>, claim: { expected: Date; next: Date }) => {
      await new Promise((resolve) => setImmediate(resolve));
      if (row.updatedAt.getTime() !== claim.expected.getTime()) return false;
      row.settings = next;
      row.updatedAt = claim.next;
      return true;
    },
  };
}

test("deux écritures concurrentes de clés différentes de settings : aucune ne s'écrase", async () => {
  const store = memoryRow({ billing: { invoice: { vatRate: 20 } } });
  const writer = (key: string, value: unknown) =>
    updateSettingsWithClaim({ load: store.load, save: store.save, apply: (current) => ({ ...current, [key]: value }) });
  const results = await Promise.all([writer("einvoicing", { vatNumber: "FR44732829320" }), writer("invoiceIdentity", { city: "Lyon" })]);
  assert.deepEqual(results, ["saved", "saved"]);
  assert.deepEqual(Object.keys(store.row.settings).sort(), ["billing", "einvoicing", "invoiceIdentity"]);
  assert.deepEqual(store.row.settings.billing, { invoice: { vatRate: 20 } });
});

test("conflit persistant : erreur SETTINGS_CONFLICT après les tentatives, rien n'est écrasé", async () => {
  const store = memoryRow({ billing: { a: 1 } });
  let saves = 0;
  await assert.rejects(
    updateSettingsWithClaim({ load: store.load, save: async () => { saves += 1; return false; }, apply: (c) => ({ ...c, x: 1 }), attempts: 3 }),
    /SETTINGS_CONFLICT/
  );
  assert.equal(saves, 3);
  assert.deepEqual(store.row.settings, { billing: { a: 1 } });
});

test("ligne absente : « missing », sans écriture ; la version suivante est strictement plus récente", async () => {
  assert.equal(await updateSettingsWithClaim({ load: async () => null, save: async () => { throw new Error("ne doit pas écrire"); }, apply: (c) => c }), "missing");
  const future = new Date(Date.now() + 60_000);
  let next: Date | undefined;
  await updateSettingsWithClaim({ load: async () => ({ settings: null, updatedAt: future }), save: async (_s, claim) => { next = claim.next; return true; }, apply: (c) => c });
  assert.ok(next && next.getTime() > future.getTime());
});

test("les écritures de settings Factur-X et de facturation passent par la réclamation sur updatedAt", () => {
  for (const file of ["src/domains/invoice/facturx/facturx.service.ts", "src/domains/company/billing-settings.service.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /updateSettingsWithClaim\(/, file);
    assert.match(source, /updateMany\(\{\s*where: \{[^}]*updatedAt: claim\.expected/, file);
    assert.doesNotMatch(source, /\.update\(\{[\s\S]{0,200}settings:/, `${file} : écriture de settings non réclamée`);
  }
});
