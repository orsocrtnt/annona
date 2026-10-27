import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const todo = readFileSync("TODO.md", "utf8");
const acceptance = readFileSync("docs/operations/admin01/ACCEPTANCE.md", "utf8");
const script = JSON.parse(readFileSync("package.json", "utf8")).scripts["test:admin01"] as string;
const gate = acceptance.slice(acceptance.indexOf("<!-- ADMIN01_GATE_START -->"), acceptance.indexOf("<!-- ADMIN01_GATE_END -->"));

const requirements = [
  "seules les personnes plateforme explicitement autorisées accèdent aux vues",
  "accès sensibles journalisés",
  "aucune impersonation ni mutation de données client implicite",
  "métriques d'abonnement séparées des factures de livraison",
  "pagination côté serveur",
  "panne d'un fournisseur visible sans secret",
  "isolation et minimisation des données vérifiées",
];

test("ADMIN-1 porte : les sept exigences locales ont des preuves exécutées", () => {
  const admin = todo.slice(todo.indexOf("- [x] **ADMIN-1"));
  const done = admin.slice(admin.indexOf("Terminé quand :"), admin.indexOf("Source / dépendance"));
  assert.equal(requirements.every((requirement) => done.includes(requirement)), true);
  assert.equal(gate.includes("Le code est prouvé localement."), true);
  assert.equal(gate.includes("Le journal et le détail entreprise ont été ouverts par un SUPER_ADMIN connecté."), true);
  for (const requirement of requirements) {
    assert.equal(gate.includes(requirement), true, requirement);
  }
  const files = [...new Set([...gate.matchAll(/tests\/admin01-[a-z0-9-]+\.test\.ts/g)].map((match) => match[0]))].sort();
  assert.equal(files.length, 24);
  for (const file of files) {
    assert.equal(existsSync(file), true, file);
    assert.equal(script.includes(file), true, file);
  }
});

test("ADMIN-1 porte : la migration est appliquée et la case est cochée", () => {
  const proof = readFileSync("docs/operations/admin01/PREPROD-ACCESS-EVENTS.md", "utf8");
  assert.equal(gate.includes("La migration du journal est appliquée sur la préproduction autorisée."), true);
  assert.equal(gate.includes("docs/operations/admin01/PREPROD-ACCESS-EVENTS.md"), true);
  assert.equal(gate.includes("ouverts par un SUPER_ADMIN temporaire le 2026-10-25"), true);
  assert.equal(gate.includes("`POST /api/auth/login` a répondu 200."), true);
  assert.equal(gate.includes("`GET /api/admin/access-events` et `GET /api/admin/companies/[id]` ont répondu 200."), true);
  assert.equal(gate.includes("Aucun SUPER_ADMIN ne reste."), true);
  assert.equal(gate.includes("n'est pas appliquée"), false);
  assert.equal(gate.includes("ENOTFOUND"), false);
  assert.equal(proof.includes("Prouvée le 2026-10-25"), true);
  assert.equal(proof.includes("Il ne reste aucun `SUPER_ADMIN`."), true);
  assert.equal(proof.includes("20261025220000_platform_access_events"), true);
  assert.equal(proof.includes("Le statut global n'est pas propre."), true);
  for (const pending of [
    "20261023190000_ops03b_monitor_extensions",
    "20261023191000_ops03b_monitor",
    "20261023192000_ops03b_monitor_fix",
    "20261024010000_saas_billing_sandbox",
    "20261024011000_catalog_c9_business",
  ]) {
    assert.equal(proof.includes(pending), true, pending);
  }
  assert.equal(gate.includes("ADMIN-1 est cochée le 2026-10-25."), true);
  assert.equal(/^- \[x\] \*\*ADMIN-1 /m.test(todo), true);
  assert.equal(/^- \[ \] \*\*ADMIN-1 /m.test(todo), false);
});
