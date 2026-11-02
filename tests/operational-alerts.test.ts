import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { deriveOperationalAlerts, alertActionKey, isOperationalOrderClosed } from "../src/domains/operational-alerts/operational-alerts.policy";
import type { ConversationActor } from "../src/domains/order-conversation/order-conversation.service";
const now = new Date("2026-10-12T12:00:00Z"), due = new Date(+now - 60000);
const staff: ConversationActor = { id: "admin", companyId: "a", role: "COMPANY_ADMIN", permissions: ["orders:read", "orders:update"], name: "Admin" };
function order() { return { id: "o", reference: "CMD", companyId: "a", updatedAt: new Date(2), status: "ASSIGNED", requestedDeliveryDate: due, deliveries: [{ id: "d", reference: "LIV", status: "ASSIGNED", completedAt: null as Date | null, driverId: "driver", updatedAt: new Date(1) }] }; }
const incident = { id: "i", requestKey: "uuid", kind: "INCIDENT", internal: false, body: "Portail fermé", authorName: "Livreur", createdAt: now };
function action(id: string, key: "ack" | "resolve") { return { ...incident, id: key, kind: "INSTRUCTION", requestKey: alertActionKey(id, key), body: key === "ack" ? "Appeler" : "Accès ouvert" }; }
test("alerte : seule l’échéance demandée dépassée crée un retard, sans date aucune supposition", () => {
  const o = order(); const rows = deriveOperationalAlerts(o, [], true, now); assert.equal(rows.length, 1); assert.equal(rows[0]!.deliveryId, "d");
  assert.equal(deriveOperationalAlerts({ ...o, requestedDeliveryDate: now }, [], true, now).length, 0);
  assert.equal(deriveOperationalAlerts({ ...o, requestedDeliveryDate: null }, [], true, now).length, 0);
});
test("alerte : identité stable, acquittement et résolution dérivés de clés, jamais de texte", () => {
  const o = order(), id = deriveOperationalAlerts(o, [], true, now)[0]!.id;
  assert.equal(deriveOperationalAlerts(o, [incident], true, now)[0]!.id, id);
  assert.equal(deriveOperationalAlerts(o, [action(id, "ack")], true, now)[0]!.state, "ACKNOWLEDGED");
  const resolved = deriveOperationalAlerts(o, [action(id, "ack"), action(id, "resolve")], true, now)[0]!;
  assert.equal(resolved.state, "RESOLVED"); assert.equal(resolved.canAct, false);
  assert.equal(deriveOperationalAlerts(o, [{ ...incident, body: "Résolution : faux texte" }], true, now)[0]!.state, "OPEN");
});
test("alerte : nouvelle date crée nouvelle cible, journal ancien reste indépendant", () => {
  const o = order(), id = deriveOperationalAlerts(o, [], true, now)[0]!.id;
  const rows = deriveOperationalAlerts({ ...o, requestedDeliveryDate: new Date(+due - 1000) }, [action(id, "resolve")], true, now);
  assert.notEqual(rows[0]!.id, id); assert.equal(rows[0]!.state, "OPEN");
});
test("alerte : la clôture de commande est unique entre la politique et l'état incident", () => {
  const cancelled = { status: "CANCELLED", deliveries: [] as Array<{ completedAt: Date | null; status: string }> };
  const open = { status: "ASSIGNED", deliveries: [{ completedAt: null, status: "ASSIGNED" }] };
  const delivered = { status: "ASSIGNED", deliveries: [{ completedAt: now, status: "DELIVERED" }] };
  assert.equal(isOperationalOrderClosed(cancelled), true);
  assert.equal(isOperationalOrderClosed(open), false);
  assert.equal(isOperationalOrderClosed(delivered), true);
  assert.equal(deriveOperationalAlerts({ ...order(), status: "CANCELLED", deliveries: [] }, [incident], true, now)[0]!.state, "CLOSED");
  const closedOrder = order();
  closedOrder.deliveries[0]!.status = "DELIVERED";
  closedOrder.deliveries[0]!.completedAt = now;
  assert.equal(deriveOperationalAlerts(closedOrder, [incident, action("incident:i", "ack")], true, now).find(row => row.id === "incident:i")!.state, "CLOSED");
  assert.equal(deriveOperationalAlerts(closedOrder, [incident, action("incident:i", "resolve")], true, now).find(row => row.id === "incident:i")!.state, "RESOLVED");
});
test("alerte : incident, visibilité interne portée par la source et clôture distincte de résolution", () => {
  const o = order(); o.deliveries[0]!.status = "DELIVERED"; o.deliveries[0]!.completedAt = now;
  const rows = deriveOperationalAlerts(o, [{ ...incident, internal: true }], true, now);
  assert.ok(rows.every(r => r.state === "CLOSED" && !r.canAct)); assert.equal(rows[1]!.internal, true); assert.equal(rows[1]!.deliveryId, null);
  assert.equal(deriveOperationalAlerts(o, [incident, action("incident:i", "resolve")], true, now)[1]!.state, "RESOLVED");
});
test("alerte : une livraison terminée clôt son retard même si une autre reste active", () => {
  const o = order(); o.deliveries.push({ ...o.deliveries[0]!, id: "d2", reference: "LIV2" }); o.deliveries[0]!.completedAt = now;
  const rows = deriveOperationalAlerts(o, [], true, now); assert.equal(rows[0]!.state, "CLOSED"); assert.equal(rows[1]!.state, "OPEN");
});
test("alerte : livreur voit seulement ses retards, incidents partagés sur la commande", () => {
  const o = order(); o.deliveries.push({ ...o.deliveries[0]!, id: "d2", driverId: "other" });
  const rows = deriveOperationalAlerts(o, [incident], false, now, "driver"); assert.equal(rows.length, 2); assert.ok(rows[0]!.id.startsWith("late:d:")); assert.equal(rows[1]!.id, "incident:i");
  assert.equal(deriveOperationalAlerts(o, [], true, now).length, 2);
});
function fixture() {
  const o = order(), messages: any[] = [], calls: any[] = []; o.requestedDeliveryDate = new Date(Date.now() - 60000); let claim = 1;
  const tx: any = { orderMessage: {
    findMany: async (args: any) => { calls.push(["messages", args]); return messages.filter(m => args.where.internal !== false || !m.internal); },
    findFirst: async (args: any) => args.where.requestKey ? messages.find(m => m.requestKey === args.where.requestKey) : messages.at(-1),
    create: async ({ data }: any) => { const m = { id: "m" + messages.length, ...data }; messages.push(m); calls.push(["create", data]); return m; },
  }, delivery: { updateMany: async (args: any) => { calls.push(["claim", args]); return { count: claim }; } }, order: { updateMany: async (args: any) => { calls.push(["orderClaim", args]); return { count: 1 }; }, findMany: async (args: any) => { calls.push(["list", args]); return [{ ...o, messages }]; } } };
  class ConversationError extends Error { constructor(public status: number, message: string) { super(message); } }
  const module = { exports: {} };
  const deps: Record<string, any> = { "@prisma/client": {}, "@/services/prisma/client": { prisma: tx }, "@/domains/operational-alerts/operational-alerts.policy": { deriveOperationalAlerts, alertActionKey }, "@/domains/operations/operation-job.service": { enqueueOperationJob: async (_tx: any, input: any) => { calls.push(["job", input]); return { id: "job" }; } }, "@/domains/order-conversation/order-conversation.service": { ConversationError, isConversationStaff: (a: ConversationActor) => ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "SUPER_ADMIN"].includes(a.role), conversationScope: (a: ConversationActor) => ({ companyId: a.companyId }), transaction: (fn: any) => fn(tx), authorizedOrder: async (_tx: any, _actor: any, id: string, lock: boolean) => { calls.push(["authorize", { id, lock }]); return o; } } };
  runInNewContext(ts.transpileModule(readFileSync("src/domains/operational-alerts/operational-alerts.service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Date, Error, console, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return { service: module.exports as typeof import("../src/domains/operational-alerts/operational-alerts.service"), o, messages, calls, loseClaim: () => { claim = 0; } };
}
test("alerte service : actions refusées client/livreur et personnel lecture seule avant écriture", async () => {
  const f = fixture(); for (const actor of [{ ...staff, role: "CLIENT" as const }, { ...staff, role: "DRIVER" as const }, { ...staff, permissions: ["orders:read"] }]) await assert.rejects(f.service.actOnOperationalAlert(actor, "o", { alertId: "incident:i", action: "ack", note: "action" }), /habilitée/);
  assert.equal(f.calls.length, 0);
});
test("alerte service : prise en compte, résolution, rejeux inter-auteur sans nouvelle action ni tâche", async () => {
  const f = fixture(), id = (await f.service.getOrderOperationalAlerts(staff, "o"))[0]!.id;
  await assert.rejects(f.service.actOnOperationalAlert(staff, "o", { alertId: id, action: "resolve", note: "trop tôt" }), /avant/);
  const a = await f.service.actOnOperationalAlert(staff, "o", { alertId: id, action: "ack", note: "Appeler livreur" });
  const replay = await f.service.actOnOperationalAlert({ ...staff, id: "other-admin" }, "o", { alertId: id, action: "ack", note: "Double prise" });
  assert.equal(replay.messageId, a.messageId); assert.equal(replay.replay, true);
  await f.service.actOnOperationalAlert(staff, "o", { alertId: id, action: "resolve", note: "Livreur arrivé" });
  assert.equal(f.messages.length, 2); assert.equal(f.calls.filter(c => c[0]! === "job").length, 2);
  const row = (await f.service.getOrderOperationalAlerts(staff, "o"))[0]!; assert.equal(row.state, "RESOLVED"); assert.ok(!JSON.stringify(row).includes("requestKey"));
});
test("alerte service : verrou livraison perdant refuse action, version métier inchangée", async () => {
  const f = fixture(), id = (await f.service.getOrderOperationalAlerts(staff, "o"))[0]!.id; f.loseClaim();
  await assert.rejects(f.service.actOnOperationalAlert(staff, "o", { alertId: id, action: "ack", note: "action" }), /changé/); assert.equal(f.messages.length, 0);
  const claim = f.calls.find(c => c[0]! === "claim")[1]!; assert.equal(+claim.data.updatedAt, +f.o.deliveries[0]!.updatedAt);
});
test("alerte service : incident interne et actions internes jamais dans le dossier client", async () => {
  const f = fixture(); f.messages.push({ ...incident, internal: true });
  await f.service.actOnOperationalAlert(staff, "o", { alertId: "incident:i", action: "ack", note: "Secret" });
  assert.equal(f.messages[1]!.internal, true);
  const rows = await f.service.getOrderOperationalAlerts({ ...staff, role: "CLIENT", permissions: ["dashboard:client"] }, "o"); assert.equal(rows.length, 1); assert.ok(!JSON.stringify(rows).includes("Secret"));
});
test("alerte service : cible ancienne et clôture refusées, historique conservé", async () => {
  const f = fixture(), id = (await f.service.getOrderOperationalAlerts(staff, "o"))[0]!.id;
  await assert.rejects(f.service.actOnOperationalAlert(staff, "o", { alertId: "late:ancienne", action: "ack", note: "action" }), /introuvable/);
  f.o.deliveries[0]!.completedAt = new Date();
  await assert.rejects(f.service.actOnOperationalAlert(staff, "o", { alertId: id, action: "ack", note: "action" }), /terminée/);
});

test("alerte service : ordre livraisons puis commande, versions conservées", async () => {
  const f = fixture(), id = (await f.service.getOrderOperationalAlerts(staff, "o"))[0]!.id;
  await f.service.actOnOperationalAlert(staff, "o", { alertId: id, action: "ack", note: "Coordination" });
  assert.ok(f.calls.findIndex(c => c[0] === "claim") < f.calls.findIndex(c => c[0] === "orderClaim"));
  const orderClaim = f.calls.find(c => c[0] === "orderClaim")[1]; assert.equal(+orderClaim.data.updatedAt, +f.o.updatedAt);
});
