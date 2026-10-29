import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as dispatchPolicy from "../src/domains/delivery/dispatch-policy";
import * as eligibility from "../src/lib/dispatch/driver-eligibility";
import * as orderStatus from "../src/lib/constants/order-status";
import * as personLabels from "../src/lib/format/person-labels";
import { DEFAULT_DISPATCH_SETTINGS } from "../src/lib/validations/dispatch-settings";

type Assign = (companyId: string, deliveryId: string, driverId: string, options?: Record<string, unknown>) => Promise<unknown>;

/**
 * Vraie fonction `assignDeliveryToDriver` ; seule la base (Prisma) est simulée.
 * Chemin DISPATCH-4 : `expectUnassigned` (clic sur une suggestion, auto-dispatch).
 */
function load(current: Record<string, unknown>, log: string[]) {
  const tx = {
    $queryRaw: async () => [],
    company: { findUnique: async () => ({ settings: {} }) },
    user: { findFirst: async (args: { where: { id: string; companyId: string } }) => (args.where.companyId === "c1" ? { id: args.where.id, firstName: "E2E", lastName: "Livreur" } : null) },
    delivery: {
      findFirst: async () => current,
      findUnique: async () => ({ ...current, idempotentRead: true }),
      updateMany: async () => { log.push("claim"); return { count: 1 }; },
    },
    order: { updateMany: async () => { log.push("order"); return { count: 1 }; } },
    trackingEvent: { create: async () => { log.push("event"); return { id: "ev" }; } },
  };
  const prisma = { $transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx) };
  const unexpected = (id: string) => new Proxy({}, { get: (_t, key) => (key === "__esModule" ? false : () => { throw new Error(`appel inattendu ${id}.${String(key)}`); }) });
  const known: Record<string, unknown> = {
    "@/services/prisma/client": { prisma },
    "@/domains/delivery/dispatch-policy": dispatchPolicy,
    "@/lib/dispatch/driver-eligibility": eligibility,
    "@/lib/constants/order-status": orderStatus,
    "@/lib/format/person-labels": personLabels,
    "@/domains/company/dispatch-settings.service": { parseDispatchSettings: () => DEFAULT_DISPATCH_SETTINGS, getCompanyDispatchSettings: async () => DEFAULT_DISPATCH_SETTINGS },
    "@/domains/operations/operation-job.service": { kickOperationJob: () => log.push("kick") },
  };
  const module = { exports: {} as { assignDeliveryToDriver: Assign } };
  runInNewContext(ts.transpileModule(readFileSync(resolve("src/domains/delivery/delivery.service.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { Date, Math, Map, Set, Error, Promise, Number, Object, Array, JSON, console, exports: module.exports, module,
    require: (id: string) => known[id] ?? unexpected(id) });
  return module.exports.assignDeliveryToDriver;
}

const base = { id: "d1", companyId: "c1", status: "ASSIGNED", driverId: "drv-a", driverName: "E2E Livreur", missionStartedAt: null, missionAcceptedAt: null, updatedAt: new Date(), order: { status: "ASSIGNED" } };

test("affectation : double clic sur la même suggestion → succès idempotent, aucune écriture ni événement", async () => {
  const log: string[] = [];
  const assign = load(base, log);
  const result = (await assign("c1", "d1", "drv-a", { expectUnassigned: true })) as Record<string, unknown>;
  assert.equal(result.idempotentRead, true);
  assert.deepEqual(log, [], "ni nouvelle affectation, ni historique, ni notification");
});

test("affectation : livraison déjà confiée à un autre livreur → refus explicite, jamais de remplacement", async () => {
  const log: string[] = [];
  const assign = load(base, log);
  await assert.rejects(assign("c1", "d1", "drv-b", { expectUnassigned: true }), /DELIVERY_NOT_AVAILABLE/);
  assert.deepEqual(log, []);
});

test("affectation : même livreur mais mission démarrée ou statut changé → refus (pas d'idempotence abusive)", async () => {
  for (const current of [{ ...base, status: "IN_DELIVERY" }, { ...base, status: "PENDING", driverId: "drv-a" }]) {
    const log: string[] = [];
    await assert.rejects(load(current, log)("c1", "d1", "drv-a", { expectUnassigned: true }), /DELIVERY_NOT_AVAILABLE/, current.status);
    assert.deepEqual(log, []);
  }
});

test("affectation : livreur d'une autre entreprise → introuvable, rien n'est écrit", async () => {
  const log: string[] = [];
  const assign = load({ ...base, status: "PENDING", driverId: null, order: { status: "PENDING" } }, log);
  await assert.rejects(assign("c2", "d1", "drv-a", { expectUnassigned: true }), /DRIVER_NOT_FOUND/);
  assert.deepEqual(log, []);
});
