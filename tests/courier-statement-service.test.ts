import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as statementModule from "../src/domains/delivery/courier-statement";

test("service relevé : requête bornée à l'entreprise, fin exclusive au lendemain (Paris), livreur étranger sans résultat", async () => {
  const wheres: Record<string, unknown>[] = [];
  const module = { exports: {} as typeof import("../src/domains/delivery/courier-statement.service") };
  const js = ts.transpileModule(readFileSync(resolve("src/domains/delivery/courier-statement.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps: Record<string, unknown> = {
    "@/services/prisma/client": { prisma: { delivery: { findMany: async ({ where }: { where: Record<string, unknown> }) => {
      wheres.push(where);
      return where.driverId === "driver-de-b" && where.companyId !== "company-b"
        ? []
        : [{ id: "d1", reference: "LIV-1", status: "DELIVERED", driverId: "dr1", driverName: null, missionStartedAt: null, completedAt: new Date(), address: "a", city: "b", driver: { firstName: "Luc", lastName: "L" } }];
    } } } },
    "./courier-statement": statementModule,
  };
  runInNewContext(js, { Date, Object, Intl, Number, Array, exports: module.exports, module, require: (id: string) => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id]; } });

  const result = await module.exports.getCourierStatement({ companyId: "company-a", from: "2026-10-27", to: "2026-10-28" });
  assert.equal(wheres[0]!.companyId, "company-a");
  const range = wheres[0]!.completedAt as { gte: Date; lt: Date };
  assert.equal(range.gte.toISOString(), "2026-10-26T23:00:00.000Z");
  assert.equal(range.lt.toISOString(), "2026-10-28T23:00:00.000Z");
  assert.equal(result.couriers[0]!.driverName, "Luc L");

  const foreign = await module.exports.getCourierStatement({ companyId: "company-a", from: "2026-10-27", to: "2026-10-28", driverId: "driver-de-b" });
  assert.equal(wheres[1]!.companyId, "company-a");
  assert.equal(wheres[1]!.driverId, "driver-de-b");
  assert.deepEqual(foreign.couriers, []);
});
