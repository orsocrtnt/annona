import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { alertActionKey, deriveOperationalAlerts, describeAlertTarget, isMissionInProgress } from "../src/domains/operational-alerts/operational-alerts.policy";
import { splitAlertsForMode } from "../src/lib/operational-alerts-placement";
import type { ConversationActor } from "../src/domains/order-conversation/order-conversation.service";

// Seule la frontière externe (Prisma) est simulée : le service et la politique d'alertes sont les vrais.
const staff: ConversationActor = { id: "admin", companyId: "a", role: "COMPANY_ADMIN", permissions: ["orders:read", "orders:update"], name: "Admin" };
const incident = (id: string) => ({ id, requestKey: `uuid-${id}`, kind: "INCIDENT", internal: false, body: "Portail fermé", authorName: "Chauffeur", createdAt: new Date() });
const order = (id: string, deliveryIds: string[], messages: unknown[]) => ({
  id, reference: `CMD-${id}`, companyId: "a", updatedAt: new Date(2), status: "ASSIGNED", requestedDeliveryDate: null, shippingAddress: null, shippingCity: null, customer: null,
  deliveries: deliveryIds.map(d => ({ id: d, reference: `LIV-${d}`, status: "ASSIGNED", completedAt: null, driverId: "driver", address: null, city: null })), messages,
});

function load(orders: unknown[]) {
  const prisma = { order: { findMany: async () => orders } };
  const module = { exports: {} as any };
  const deps: Record<string, any> = {
    "@prisma/client": {}, "@/services/prisma/client": { prisma },
    "@/domains/operational-alerts/operational-alerts.policy": { deriveOperationalAlerts, alertActionKey, describeAlertTarget, isMissionInProgress },
    "@/domains/operations/operation-job.service": {},
    "@/domains/order-conversation/order-conversation.service": { isConversationStaff: () => true, conversationScope: (a: ConversationActor) => ({ companyId: a.companyId }) },
  };
  runInNewContext(ts.transpileModule(readFileSync("src/domains/operational-alerts/operational-alerts.service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Date, Error, console, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return module.exports as typeof import("../src/domains/operational-alerts/operational-alerts.service");
}

test("fiche livraison : l'incident de la commande (deliveryId nul) est en haut, jamais celui d'une autre commande", async () => {
  const service = load([order("o1", ["d1", "d2"], [incident("i1")]), order("o2", ["d3"], [incident("i2")])]);
  const { alerts } = await service.listOperationalAlerts(staff);
  assert.equal(alerts.find(a => a.id === "incident:i1")!.deliveryId, null);
  const onD1 = splitAlertsForMode(alerts, "context", { deliveryId: "d1" });
  assert.deepEqual(onD1.top.map(a => a.id), ["incident:i1"]);
  assert.deepEqual(onD1.behindAccess.map(a => a.id), ["incident:i2"]);
  assert.deepEqual(splitAlertsForMode(alerts, "context", { deliveryId: "d2" }).top.map(a => a.id), ["incident:i1"]);
  assert.deepEqual(splitAlertsForMode(alerts, "context", { deliveryId: "d3" }).top.map(a => a.id), ["incident:i2"]);
  assert.deepEqual(splitAlertsForMode(alerts, "context", { deliveryId: "inconnue" }).top, []);
});
