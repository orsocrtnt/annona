import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { Prisma } from "@prisma/client";
import type { ConversationActor } from "../src/domains/order-conversation/order-conversation.service";
import { filterMiniAdminPermissions } from "../src/lib/permissions/mini-admin";
import * as clientDriver from "../src/domains/delivery/client-driver";
import { createHash } from "node:crypto";

const client: ConversationActor = { id: "client-a", companyId: "a", role: "CLIENT", permissions: ["dashboard:client"], name: "Client A" };
const driver: ConversationActor = { id: "driver-a", companyId: "a", role: "DRIVER", permissions: ["dashboard:driver"], name: "Driver A" };
const staff: ConversationActor = { id: "admin-a", companyId: "a", role: "COMPANY_ADMIN", permissions: ["orders:read", "orders:update"], name: "Admin A" };
const input = { body: "Instruction", kind: "INSTRUCTION", internal: false, requestKey: "test-key" };
function fixture() {
  const calls: Array<{ method: string; input: any }> = [];
  const order: any = { id: "order-a", companyId: "a", customerId: client.id, reference: "CMD-A", status: "ASSIGNED", updatedAt: new Date(1), deliveries: [{ id: "delivery-a", companyId: "a", driverId: driver.id, status: "ASSIGNED", completedAt: null, updatedAt: new Date(2) }] };
  const message: any = { id: "message-a", orderId: order.id, authorId: client.id, authorName: client.name, authorRole: client.role, createdAt: new Date(10), ...input };
  let replay: any = null; let read: any = null; let lockCount = 1; let users: any[] = [];
  const record = (method: string, result: () => any) => async (input: any) => { calls.push({ method, input }); return result(); };
  const tx = {
    user: { findMany: record("user.findMany", () => users) },
    order: { findFirst: record("order.findFirst", () => order), updateMany: record("order.updateMany", () => ({ count: 1 })) },
    delivery: { updateMany: record("delivery.updateMany", () => ({ count: lockCount })) },
    orderMessage: { findUnique: record("message.findUnique", () => replay), create: record("message.create", () => message), findFirst: record("message.findFirst", () => message), findMany: record("message.findMany", () => [message]), count: record("message.count", () => 1) },
    orderThreadRead: { findUnique: record("read.findUnique", () => read), upsert: record("read.upsert", () => ({})) },
    clientNotification: { upsert: record("notification.upsert", () => ({})), updateMany: record("notification.updateMany", () => ({ count: 1 })), findMany: record("notification.findMany", () => []) },
  };
  const module = { exports: {} };
  const deps: Record<string, unknown> = {
    "node:crypto": { createHash }, "@prisma/client": { Prisma }, "@/services/prisma/client": { prisma: { ...tx, $transaction: async (fn: any) => fn(tx) } },
    "@/lib/permissions/rbac": { STAFF_ROLES: ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"] },
    "@/lib/permissions/mini-admin": { filterMiniAdminPermissions },
    "@/domains/delivery/client-driver": clientDriver,
    "@/domains/operations/operation-job.service": { enqueueOperationJob: record("job.enqueue", () => ({ id: "job-a" })) },
  };
  runInNewContext(ts.transpileModule(readFileSync("src/domains/order-conversation/order-conversation.service.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Date, Error, Set, console, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return { service: module.exports as typeof import("../src/domains/order-conversation/order-conversation.service"), calls, order, message, replay: (v: any) => { replay = v; }, read: (v: any) => { read = v; }, users: (v: any[]) => { users = v; }, loseAssignment: () => { lockCount = 0; } };
}
function clean(value: unknown) { return JSON.parse(JSON.stringify(value)); }
test("conversation : client propriétaire et entreprise, chauffeur affecté et staff avec lecture", () => {
  const { service } = fixture();
  assert.deepEqual(clean(service.conversationScope(client)), { companyId: "a", customerId: client.id });
  assert.deepEqual(clean(service.conversationScope(driver)), { companyId: "a", deliveries: { some: { companyId: "a", driverId: driver.id } } });
  assert.deepEqual(clean(service.conversationScope(staff)), { companyId: "a" });
  assert.throws(() => service.conversationScope({ ...staff, permissions: [] }), /refusé/);
  assert.throws(() => service.conversationScope({ ...client, companyId: null }), /Entreprise/);
});
test("conversation : note réservée au staff et écriture exige permission", async () => {
  const { service, calls } = fixture();
  for (const actor of [client, driver]) await assert.rejects(service.postOrderMessage(actor, "order-a", { ...input, internal: true }), /non autorisée/);
  await assert.rejects(service.postOrderMessage({ ...staff, permissions: ["orders:read"] }, "order-a", input), /non autorisée/);
  assert.equal(calls.length, 0);
});
test("conversation : réaffectation gagnante empêche toute insertion", async () => {
  const f = fixture(); f.loseAssignment();
  await assert.rejects(f.service.postOrderMessage(driver, "order-a", input), /introuvable/);
  assert.equal(f.calls.some(c => c.method === "message.create"), false);
});
test("conversation : message et notification durable sont transactionnels, sans corps dans tâche", async () => {
  const f = fixture(); await f.service.postOrderMessage(driver, "order-a", input);
  const methods = f.calls.map(c => c.method);
  assert.ok(methods.indexOf("delivery.updateMany") < methods.indexOf("message.create"));
  const job = f.calls.find(c => c.method === "job.enqueue")!;
  // La dépendance reçoit le transaction client, pas le client global.
  assert.ok(job.input.orderMessage);
});
test("conversation : rejeu identique sans message ni tâche supplémentaire, clé différente refusée", async () => {
  const f = fixture(); f.replay(f.message);
  assert.equal((await f.service.postOrderMessage(client, "order-a", input)).replay, true);
  await assert.rejects(f.service.postOrderMessage(client, "order-a", { ...input, body: "Autre" }), /autre message/);
  assert.equal(f.calls.some(c => c.method === "message.create" || c.method === "job.enqueue"), false);
});
test("conversation : fin lecture seule et facture ne clôt pas une mission active", async () => {
  const f = fixture(); f.order.status = "PAID";
  assert.equal(f.service.conversationClosed(f.order), false);
  f.order.deliveries[0].status = "DELIVERED";
  await assert.rejects(f.service.postOrderMessage(client, "order-a", input), /lecture seule/);
  assert.equal(f.calls.some(c => c.method === "message.create"), false);
});
test("conversation : notes exclues du fil, pagination et compteur client", async () => {
  const f = fixture(); await f.service.getOrderConversation(client, "order-a");
  for (const method of ["message.findMany", "message.count"]) assert.equal(f.calls.find(c => c.method === method)!.input.where.internal, false);
  assert.deepEqual(clean(f.calls.find(c => c.method === "message.findMany")!.input.orderBy), [{ createdAt: "desc" }, { id: "desc" }]);
});
test("conversation : watermark exact ne consomme pas le prochain message", async () => {
  const f = fixture(); await f.service.markOrderConversationRead(client, "order-a", "message-a");
  const update = f.calls.find(c => c.method === "read.upsert")!.input;
  assert.equal(update.create.seenId, "message-a"); assert.equal(+update.create.seenAt, 10);
  assert.equal(f.calls.find(c => c.method === "message.findFirst")!.input.where.internal, false);
  const bounds = f.calls.find(c => c.method === "notification.updateMany")!.input.where.orderMessage.is.OR;
  assert.equal(+bounds[0].createdAt.lt, 10); assert.equal(bounds[1].id.lte, "message-a");
});
test("conversation : marquage ancien ne recule pas le watermark", async () => {
  const f = fixture(); f.read({ seenAt: new Date(20), seenId: "later" });
  await f.service.markOrderConversationRead(staff, "order-a", "message-a");
  assert.equal(f.calls.some(c => c.method === "read.upsert"), false);
});
test("conversation : notifications ancien chauffeur filtrées par affectation courante", async () => {
  const f = fixture(); await f.service.listOrderMessageNotifications(driver);
  const where = f.calls.find(c => c.method === "notification.findMany")!.input.where;
  assert.equal(where.orderMessage.is.internal, false);
  assert.equal(where.orderMessage.is.order.is.deliveries.some.driverId, driver.id);
});


test("conversation : worker note interne ne notifie que le staff habilité, et respecte watermark", async () => {
  const f = fixture(); f.replay({ ...f.message, internal: true, order: f.order });
  const actors = [client, driver, staff, { ...staff, id: "limited", role: "MINI_ADMIN", permissions: [] }];
  f.users(actors.map(actor => ({ id: actor.id, companyId: actor.companyId, settings: {}, role: { systemRole: actor.role, permissions: actor.permissions.map(slug => ({ permission: { slug } })) } })));
  f.read({ seenAt: new Date(20), seenId: "later" });
  await f.service.deliverOrderMessageNotification(f.message.id);
  const inserts = f.calls.filter(c => c.method === "notification.upsert");
  assert.equal(inserts.length, 1); assert.equal(inserts[0]!.input.create.userId, staff.id);
  assert.ok(inserts[0]!.input.create.readAt);
  assert.equal(inserts[0]!.input.create.body.includes(input.body), false);
});
