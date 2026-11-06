import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  DEMO_SCENARIO_ANCHOR_KEY,
  DEMO_SHIFTED_MODELS,
  DEMO_SHIFT_STEP_MS,
  DEMO_UNSHIFTED_MODELS,
  buildDemoShiftStatements,
  demoShiftMs,
  readDemoScenarioAnchor,
} from "../src/domains/demo/demo-time-shift.service";

const TIED_PARENTS = new Set(["Company", "Order", "Delivery", "SupportTicket", "User"]);

test("DEMO-REFONTE : chaque modèle daté rattaché à une entreprise est décalé ou exclu avec une raison", () => {
  const unclassified: string[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    const hasDate = model.fields.some((field) => field.type === "DateTime");
    const tied = model.fields.some(
      (field) => field.kind === "object" && (field.relationFromFields?.length ?? 0) > 0 && TIED_PARENTS.has(field.type)
    );
    if (!hasDate || !tied) continue;
    if (!(model.name in DEMO_SHIFTED_MODELS) && !(model.name in DEMO_UNSHIFTED_MODELS)) unclassified.push(model.name);
  }
  assert.deepEqual(unclassified, [], "nouveau modèle daté : le ranger dans DEMO_SHIFTED_MODELS ou DEMO_UNSHIFTED_MODELS");
  for (const name of Object.keys(DEMO_SHIFTED_MODELS)) assert.ok(!(name in DEMO_UNSHIFTED_MODELS), name);
});

test("DEMO-REFONTE : toutes les colonnes de date d'un modèle décalé avancent, dans le seul espace visé", () => {
  const statements = buildDemoShiftStatements();
  assert.equal(statements.length, Object.keys(DEMO_SHIFTED_MODELS).length);
  for (const name of Object.keys(DEMO_SHIFTED_MODELS)) {
    const model = Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === name)!;
    const sql = statements.find((statement) => statement.startsWith(`UPDATE "${model.dbName ?? model.name}" SET`));
    assert.ok(sql, `requête pour ${name}`);
    for (const field of model.fields.filter((candidate) => candidate.type === "DateTime")) {
      const column = field.dbName ?? field.name;
      assert.ok(sql.includes(`"${column}" = "${column}" + ($2::bigint * interval '1 millisecond')`), `${name}.${field.name}`);
    }
    assert.match(sql, /= \$1\)?$/, `${name} filtré par entreprise`);
  }
  const orders = statements.find((statement) => statement.startsWith('UPDATE "orders"'))!;
  assert.match(orders, /"requested_delivery_date" = "requested_delivery_date" \+/);
  assert.match(orders, /WHERE "company_id" = \$1$/);
  const tracking = statements.find((statement) => statement.startsWith('UPDATE "tracking_events"'))!;
  assert.match(tracking, /WHERE "delivery_id" IN \(SELECT "id" FROM "deliveries" WHERE "company_id" = \$1\)$/);
  const locations = statements.find((statement) => statement.startsWith('UPDATE "driver_locations"'))!;
  assert.match(locations, /WHERE "driver_id" IN \(SELECT "id" FROM "users" WHERE "company_id" = \$1\)$/);
});

test("DEMO-REFONTE : décalage arrondi au quart d'heure, nul pour un espace déjà à l'heure", () => {
  const anchor = new Date("2026-11-05T08:00:00.000Z");
  assert.equal(demoShiftMs(anchor, new Date("2026-11-05T08:05:00.000Z")), 0);
  assert.equal(demoShiftMs(anchor, new Date("2026-11-05T08:10:00.000Z")), DEMO_SHIFT_STEP_MS);
  assert.equal(demoShiftMs(anchor, new Date("2026-11-06T04:00:00.000Z")), 20 * 60 * 60 * 1000);
});

test("DEMO-REFONTE : l'ancrage se relit depuis les réglages et refuse une valeur invalide", () => {
  assert.equal(readDemoScenarioAnchor({ [DEMO_SCENARIO_ANCHOR_KEY]: "2026-11-05T08:00:00.000Z" })?.toISOString(), "2026-11-05T08:00:00.000Z");
  assert.equal(readDemoScenarioAnchor({ [DEMO_SCENARIO_ANCHOR_KEY]: "pas une date" }), null);
  assert.equal(readDemoScenarioAnchor({}), null);
  assert.equal(readDemoScenarioAnchor(null), null);
});

test("DEMO-REFONTE : l'espace est remis à l'heure au prêt, l'ancrage est posé à la remise à zéro", () => {
  const pool = readFileSync("src/domains/demo/demo-pool.service.ts", "utf8");
  assert.match(pool, /if \(!lease\.reused\) await realignLeasedDemo\(lease\.companyId, now\);/);
  const scenario = readFileSync("src/domains/demo/demo-scenario.service.ts", "utf8");
  assert.match(scenario, /\[DEMO_SCENARIO_ANCHOR_KEY\]: referenceDate\.toISOString\(\)/);
});
