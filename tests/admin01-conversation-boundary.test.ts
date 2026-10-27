import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { NextResponse } from "next/server";

const source = (file: string) => ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const authSource = source("src/lib/api/conversation-auth.ts");
const routes = {
  tracking: source("src/app/api/tracking/[id]/route.ts"),
  alerts: source("src/app/api/operational-alerts/route.ts"),
  alertDetail: source("src/app/api/operational-alerts/[id]/route.ts"),
  notifications: source("src/app/api/order-conversations/notifications/route.ts"),
  conversation: source("src/app/api/order-conversations/[id]/route.ts"),
};
const allowed = ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"];

function execute(code: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(code, {
    Error, URL, console, exports: module.exports, module, z,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function loadAuth(role: string, calls: string[]) {
  const permissions = ["orders:read"];
  return execute(authSource, {
    "@/lib/api/auth-guard": {
      requireAuth: async () => {
        calls.push("auth");
        return {
          context: {
            permissions,
            user: {
              id: "user-1",
              companyId: "company-1",
              role: { systemRole: role },
              get firstName() { calls.push("name"); return "Ada"; },
              lastName: "Lovelace",
            },
          },
        };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), allowed.join(","));
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
    },
  }) as { conversationAuth: () => Promise<{ error?: Response; actor?: Record<string, unknown> }> };
}

function services(calls: string[], seen: { actor?: Record<string, unknown> }) {
  const record = async (actor: Record<string, unknown>) => {
    calls.push("service");
    seen.actor = actor;
    return { id: "row-1" };
  };
  return {
    ConversationError: class ConversationError extends Error { status = 400; },
    getOrderTracking: record,
    listOperationalAlerts: record,
    getOrderOperationalAlerts: record,
    actOnOperationalAlert: async (actor: Record<string, unknown>) => {
      calls.push("service");
      seen.actor = actor;
      return { messageId: "message-1", jobId: null, replay: false };
    },
    listOrderMessageNotifications: record,
    getOrderConversation: record,
    postOrderMessage: async (actor: Record<string, unknown>) => {
      calls.push("service");
      seen.actor = actor;
      return { messageId: "message-1", jobId: null, replay: false };
    },
    markOrderConversationRead: async (actor: Record<string, unknown>) => {
      calls.push("service");
      seen.actor = actor;
    },
    kickOperationJob: () => { calls.push("kick"); },
  };
}

function dependencies(auth: object, calls: string[], seen: { actor?: Record<string, unknown> }) {
  const service = services(calls, seen);
  return {
    "next/server": { NextResponse },
    zod: { z },
    "@/lib/api/conversation-auth": auth,
    "@/domains/order-conversation/order-conversation.service": service,
    "@/domains/tracking/tracking.service": service,
    "@/domains/operational-alerts/operational-alerts.service": service,
    "@/domains/operations/operation-job.service": service,
  };
}

function params(calls: string[]) {
  return {
    params: {
      then(onFulfilled: (value: { id: string }) => unknown) {
        calls.push("params");
        return Promise.resolve({ id: "order-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

function request(url: string, body: unknown, calls: string[]) {
  const value = new Request(url, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  const read = value.json.bind(value);
  return new Proxy(value, {
    get(target, prop, receiver) {
      if (prop === "url") calls.push("url");
      if (prop === "json") return async () => { calls.push("body"); return read(); };
      return Reflect.get(target, prop, receiver);
    },
  });
}

const alertBody = { alertId: "alert-1", action: "ack", note: "Vu" };
const messageBody = { body: "Bonjour", kind: "QUESTION", internal: false, requestKey: "11111111-1111-4111-8111-111111111111" };

test("ADMIN-1 échanges : le garde conserve l’acteur et refuse la plateforme avant le nom", async () => {
  for (const role of allowed) {
    const calls: string[] = [];
    const result = await loadAuth(role, calls).conversationAuth();
    assert.equal(JSON.stringify(result.actor), JSON.stringify({
      id: "user-1", companyId: "company-1", role, permissions: ["orders:read"], name: "Ada Lovelace",
    }));
  }
  const calls: string[] = [];
  const denied = await loadAuth("SUPER_ADMIN", calls).conversationAuth();
  assert.equal(denied.error?.status, 403);
  assert.deepEqual(calls, ["auth", "role"]);
});

test("ADMIN-1 échanges : les huit méthodes refusent SUPER_ADMIN avant URL, corps, paramètres, service et job", async () => {
  const calls: string[] = [];
  const seen: { actor?: Record<string, unknown> } = {};
  const deps = dependencies(loadAuth("SUPER_ADMIN", calls), calls, seen);
  const tracking = execute(routes.tracking, deps) as { GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> };
  const alerts = execute(routes.alerts, deps) as { GET: () => Promise<Response> };
  const detail = execute(routes.alertDetail, deps) as {
    GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  const notifications = execute(routes.notifications, deps) as { GET: () => Promise<Response> };
  const conversation = execute(routes.conversation, deps) as {
    GET: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    PATCH: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  };
  const handlers = [
    () => tracking.GET(request("http://local/api/tracking/order-1", undefined, calls), params(calls)),
    () => alerts.GET(),
    () => detail.GET(request("http://local/api/operational-alerts/order-1", undefined, calls), params(calls)),
    () => detail.POST(request("http://local/api/operational-alerts/order-1", alertBody, calls), params(calls)),
    () => notifications.GET(),
    () => conversation.GET(request("http://local/api/order-conversations/order-1", undefined, calls), params(calls)),
    () => conversation.POST(request("http://local/api/order-conversations/order-1", messageBody, calls), params(calls)),
    () => conversation.PATCH(request("http://local/api/order-conversations/order-1", { messageId: "message-1" }, calls), params(calls)),
  ];
  for (const handler of handlers) {
    const before = calls.length;
    assert.equal((await handler()).status, 403);
    assert.deepEqual(calls.slice(before), ["auth", "role"]);
  }
  assert.equal(seen.actor, undefined);
});

test("ADMIN-1 échanges : un rôle autorisé atteint le service avec l’acteur exact", async () => {
  for (const role of allowed) {
    const calls: string[] = [];
    const seen: { actor?: Record<string, unknown> } = {};
    const deps = dependencies(loadAuth(role, calls), calls, seen);
    const conversation = execute(routes.conversation, deps) as { GET: Function };
    const response = await conversation.GET(request("http://local/api/order-conversations/order-1", undefined, calls), params(calls));
    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(seen.actor), JSON.stringify({
      id: "user-1", companyId: "company-1", role, permissions: ["orders:read"], name: "Ada Lovelace",
    }));
  }
});
