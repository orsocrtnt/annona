import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server";
import { isCrossOriginMutation, isOriginCheckExempt } from "../src/lib/security/origin-check";

// SEC-6 : une mutation (POST, PUT, PATCH, DELETE) venue d'une autre origine est refusée
// par le middleware, sauf webhook Stripe et crons authentifiés par secret.
const APP = "https://app.tutelliv.test";
const req = (method: string, path: string, headers: Record<string, string> = {}) =>
  new Request(`${APP}${path}`, { method, headers });

test("même origine acceptée, autre origine refusée pour chaque méthode de mutation", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(isCrossOriginMutation(req(method, "/api/orders", { origin: APP })), false, method);
    assert.equal(isCrossOriginMutation(req(method, "/api/orders", { origin: "https://evil.test" })), true, method);
  }
});

test("lectures (GET, HEAD, OPTIONS) jamais bloquées, même depuis une autre origine", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.equal(isCrossOriginMutation(req(method, "/api/orders", { origin: "https://evil.test" })), false, method);
  }
});

test("origines voisines refusées : sous-domaine, schéma, port, null et valeur invalide", () => {
  for (const origin of ["https://evil.app.tutelliv.test", "http://app.tutelliv.test", "https://app.tutelliv.test:8443", "null", "pas une url"]) {
    assert.equal(isCrossOriginMutation(req("POST", "/api/orders", { origin })), true, origin);
  }
});

test("sans Origin : client non navigateur accepté, mais Sec-Fetch-Site cross-site refusé", () => {
  assert.equal(isCrossOriginMutation(req("POST", "/api/auth/login")), false);
  assert.equal(isCrossOriginMutation(req("POST", "/api/auth/login", { "sec-fetch-site": "same-origin" })), false);
  assert.equal(isCrossOriginMutation(req("POST", "/api/auth/login", { "sec-fetch-site": "cross-site" })), true);
  assert.equal(isCrossOriginMutation(req("POST", "/api/auth/login", { "sec-fetch-site": "same-site" })), true);
});

test("origine publique configurée acceptée derrière un proxy qui réécrit l'hôte", () => {
  const internal = new Request("http://internal:3000/api/orders", { method: "POST", headers: { origin: APP } });
  assert.equal(isCrossOriginMutation(internal, { appUrl: "" }), true);
  assert.equal(isCrossOriginMutation(internal, { appUrl: APP }), false);
  assert.equal(isCrossOriginMutation(internal, { appUrl: "invalide" }), true);
});

test("webhook Stripe et crons exemptés ; chemins proches non exemptés", () => {
  const evil = { origin: "https://evil.test" };
  assert.equal(isCrossOriginMutation(req("POST", "/api/billing/webhook", evil)), false);
  assert.equal(isCrossOriginMutation(req("POST", "/api/cron/operations", evil)), false);
  assert.equal(isCrossOriginMutation(req("POST", "/api/billing/webhook-other", evil)), true);
  assert.equal(isCrossOriginMutation(req("POST", "/api/billing", evil)), true);
  assert.equal(isCrossOriginMutation(req("POST", "/api/cronjob", evil)), true);
});

function loadMiddleware(calls: string[]) {
  const module = { exports: {} as { middleware: (request: NextRequest) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/middleware.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/services/supabase/middleware": { updateSession: async () => { calls.push("session"); return { supabaseResponse: NextResponse.next(), user: null }; } },
    "@/lib/constants": { AUTH_ROUTES: ["/login"] },
    "@/lib/security/origin-check": { isCrossOriginMutation, isOriginCheckExempt },
  };
  runInNewContext(source, { exports: module.exports, module, process, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id];
  } });
  return module.exports.middleware;
}

test("middleware : mutation d'une autre origine -> 403 en français, avant toute session Supabase", async () => {
  const calls: string[] = [];
  const middleware = loadMiddleware(calls);
  const blocked = await middleware(new NextRequest(`${APP}/api/orders`, { method: "POST", headers: { origin: "https://evil.test" } }));
  assert.equal(blocked.status, 403);
  assert.match((await blocked.json()).error, /origine/i);
  assert.deepEqual(calls, []);
  const allowed = await middleware(new NextRequest(`${APP}/api/orders`, { method: "POST", headers: { origin: APP } }));
  assert.notEqual(allowed.status, 403);
  assert.deepEqual(calls, ["session"]);
  const webhook = await middleware(new NextRequest(`${APP}/api/billing/webhook`, { method: "POST", headers: { origin: "https://stripe.test" } }));
  assert.notEqual(webhook.status, 403);
  assert.deepEqual(calls, ["session"]);
});
