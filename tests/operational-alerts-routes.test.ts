import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { z } from "zod";
function fixture() {
  const calls: string[] = []; let replay = false, anonymous = false;
  class ConversationError extends Error { constructor(public status: number, message: string) { super(message); } }
  const module = { exports: {} };
  const deps: Record<string, unknown> = { "next/server": { NextResponse }, zod: { z }, "@/lib/api/conversation-auth": { conversationAuth: async () => anonymous ? { error: NextResponse.json({ error: "Authentification requise" }, { status: 401 }) } : { actor: {} } }, "@/domains/order-conversation/order-conversation.service": { ConversationError }, "@/domains/operational-alerts/operational-alerts.service": { getOrderOperationalAlerts: async () => [], actOnOperationalAlert: async () => { calls.push("act"); return { messageId: "m", jobId: replay ? null : "job", replay }; } }, "@/domains/operations/operation-job.service": { kickOperationJob: () => calls.push("kick") } };
  runInNewContext(ts.transpileModule(readFileSync("src/app/api/operational-alerts/[id]/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Error, console, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return { routes: module.exports as typeof import("../src/app/api/operational-alerts/[id]/route"), calls, replay: () => { replay = true; }, anonymous: () => { anonymous = true; } };
}
const context = { params: Promise.resolve({ id: "o" }) };
const request = (value: unknown) => new Request("http://local/api/operational-alerts/o", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value) });
const input = { alertId: "incident:i", action: "ack", note: "Appeler" };
test("route alertes : authentification avant corps et service", async () => {
  const f = fixture(); f.anonymous(); assert.equal((await f.routes.POST(request(input), context)).status, 401); assert.equal(f.calls.length, 0);
});
test("route alertes : action, cible, motif et champs strictement validés", async () => {
  const f = fixture(); for (const value of [{ ...input, note: "  " }, { ...input, note: "x".repeat(1501) }, { ...input, action: "invented" }, { ...input, internal: true }, { ...input, alertId: "" }]) assert.equal((await f.routes.POST(request(value), context)).status, 400); assert.equal(f.calls.length, 0);
});
test("route alertes : effet durable déclenché une fois, rejeu ne recrée aucune tâche", async () => {
  const f = fixture(); assert.equal((await f.routes.POST(request(input), context)).status, 201); f.replay(); assert.equal((await f.routes.POST(request(input), context)).status, 200); assert.equal(f.calls.filter(c => c === "kick").length, 1);
});
