import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DRIVER_PROOF_RULES_KEY,
  effectiveSignatureRequired,
  readCachedProofRules,
  writeCachedProofRules,
} from "../src/features/driver/proof-rules-cache";

function memoryStore() {
  const map = new Map<string, string>();
  return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), map };
}

test("POD-2 hors ligne : la dernière règle chargée est gardée sur le téléphone", () => {
  const store = memoryStore();
  assert.equal(readCachedProofRules(store), undefined);
  writeCachedProofRules({ signatureRequired: true }, store);
  assert.deepEqual(readCachedProofRules(store), { signatureRequired: true });
  writeCachedProofRules({ signatureRequired: false }, store);
  assert.deepEqual(readCachedProofRules(store), { signatureRequired: false });
});

test("POD-2 hors ligne : valeur illisible ou stockage indisponible = règle inconnue", () => {
  const store = memoryStore();
  store.map.set(DRIVER_PROOF_RULES_KEY, "{pas du json");
  assert.equal(readCachedProofRules(store), undefined);
  store.map.set(DRIVER_PROOF_RULES_KEY, JSON.stringify({ signatureRequired: "oui" }));
  assert.equal(readCachedProofRules(store), undefined);
  assert.equal(readCachedProofRules(null), undefined);
  assert.doesNotThrow(() => writeCachedProofRules({ signatureRequired: true }, null));
});

test("POD-2 hors ligne : règle jamais chargée = signature demandée par précaution", () => {
  assert.equal(effectiveSignatureRequired(undefined), true);
  assert.equal(effectiveSignatureRequired({ signatureRequired: false }), false);
  assert.equal(effectiveSignatureRequired({ signatureRequired: true }), true);
  const dialog = readFileSync("src/features/driver/proof-of-delivery-dialog.tsx", "utf8");
  assert.match(dialog, /effectiveSignatureRequired\(proofRules\)/);
  assert.doesNotMatch(dialog, /proofRules\?\.signatureRequired \?\? false/);
});

test("POD-2 : les règles de preuve se pilotent depuis Paramètres (API company/proof-rules)", () => {
  const page = readFileSync("src/app/(back-office)/settings/page.tsx", "utf8");
  assert.match(page, /Signature du réceptionnaire obligatoire/);
  assert.match(page, /Envoyer la preuve au client par e-mail/);
  assert.match(page, /useUpdateCompanyProofRules/);
  const api = readFileSync("src/features/back-office/company-settings-api.ts", "utf8");
  assert.match(api, /"\/api\/company\/proof-rules", \{\s*method: "PATCH"/);
});
