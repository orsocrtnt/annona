import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflow = readFileSync(resolve(".github/workflows/cron-operations.yml"), "utf8");

test("le workflow est planifié toutes les 5 minutes et lancé à la main possible", () => {
  assert.match(workflow, /cron: "\*\/5 \* \* \* \*"/);
  assert.match(workflow, /workflow_dispatch:/);
});

test("le workflow lit ses valeurs dans des secrets GitHub de l'environnement preproduction", () => {
  assert.match(workflow, /environment: preproduction/);
  for (const name of ["PREPROD_BASE_URL", "PREPROD_CRON_SECRET", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    assert.match(workflow, new RegExp(`\\$\\{\\{ secrets\\.${name} \\}\\}`));
  }
});

test("le workflow échoue clairement si un secret obligatoire manque", () => {
  assert.match(workflow, /Secret GitHub manquant/);
  assert.match(workflow, /exit "\$missing"/);
});

test("le workflow n'embarque aucune valeur de secret ni URL en dur", () => {
  assert.doesNotMatch(workflow, /https?:\/\/(?!\*)[a-z0-9.-]+\.[a-z]{2,}/i);
  assert.doesNotMatch(workflow, /Bearer [A-Za-z0-9]{16,}/);
  assert.match(workflow, /Authorization: Bearer \$\{PREPROD_CRON_SECRET\}/);
});

test("la route cron refuse un secret absent ou faux", async () => {
  const { GET } = await import("../src/app/api/cron/operations/route");
  const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    const missing = await GET(new Request("http://x/api/cron/operations", { headers: { authorization: "Bearer undefined" } }));
    assert.equal(missing.status, 401);
    process.env.CRON_SECRET = "bon-secret";
    const wrong = await GET(new Request("http://x/api/cron/operations", { headers: { authorization: "Bearer faux" } }));
    assert.equal(wrong.status, 401);
    const none = await GET(new Request("http://x/api/cron/operations"));
    assert.equal(none.status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("les tâches quotidiennes tournent sur annona.fr, pas seulement en production Vercel (AUDIT-0111, E1)", () => {
  const daily = readFileSync(resolve(".github/workflows/cron-daily.yml"), "utf8");
  assert.match(daily, /cron: "0 6 \* \* \*"/);
  assert.match(daily, /workflow_dispatch:/);
  assert.match(daily, /environment: preproduction/);
  // FACT-1 : les récurrences sont générées par le verrouillage (cron-lock-orders.yml) ; seules les
  // routes existantes sont appelées.
  assert.doesNotMatch(daily, /\/api\/cron\/recurring-orders/);
  assert.match(daily, /\/api\/cron\/billing/);
  for (const [, route] of daily.matchAll(/\/api\/cron\/([a-z-]+)/g)) {
    assert.ok(existsSync(resolve(`src/app/api/cron/${route}/route.ts`)), `route appelée absente : ${route}`);
  }
  assert.match(daily, /Authorization: Bearer \$\{PREPROD_CRON_SECRET\}/);
  assert.doesNotMatch(daily, /https?:\/\/(?!\*)[a-z0-9.-]+\.[a-z]{2,}/i);
});
