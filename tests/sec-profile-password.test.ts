import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";

// SEC-2/SEC-3 : la vérification du mot de passe actuel est un second chemin
// signInWithPassword ; même limite que la connexion, et aucune erreur Supabase brute.
type Options = { blocked?: number; verify: "ok" | "invalid" | "down"; update?: { message: string; status?: number; code?: string } | null };
function load(options: Options) {
  const calls: string[] = [];
  const deps: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler, readJsonBody: async (request: Request) => request.json() },
    "@/lib/api/auth-guard": { requireAuth: async () => ({ context: { authId: "auth-1", user: { email: "user@example.test" } } }) },
    "@/lib/validations/auth": { changePasswordSchema: { safeParse: (body: unknown) => ({ success: true, data: body }) } },
    "@/lib/security/request-source": { requestSourceFromHeaders: () => "203.0.113.10" },
    "@/domains/auth/login-rate-limit.service": {
      startLoginAttempt: async (input: { email: string; trackEmail: boolean }) => {
        calls.push(`begin:${input.email}:${input.trackEmail}`);
        return options.blocked ? { allowed: false, retryAfterSeconds: options.blocked } : { allowed: true, attempt: { ids: ["r1"] } };
      },
      settleLoginAttempt: async (_attempt: unknown, outcome: string) => { calls.push(`settle:${outcome}`); },
    },
    "@supabase/supabase-js": { createClient: () => ({ auth: { signInWithPassword: async () => {
      calls.push("verify");
      if (options.verify === "down") return { error: { name: "AuthRetryableFetchError", status: 0 } };
      return { error: options.verify === "invalid" ? { name: "AuthApiError", status: 400 } : null };
    } } }) },
    "@/services/supabase/admin": { createAdminClient: () => ({ auth: { admin: { updateUserById: async () => { calls.push("update"); return { error: options.update ?? null }; } } } }) },
  };
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync("src/app/api/profile/password/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  runInNewContext(source, { exports: module.exports, module, console: { error() {} }, process, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id];
  } });
  return { POST: module.exports.POST, calls };
}
const request = () => new Request("http://local/api/profile/password", { method: "POST", body: JSON.stringify({ currentPassword: "old-test-only", newPassword: "New-test-only-1" }) });

test("bloqué : 429 avec Retry-After, mot de passe actuel jamais vérifié", async () => {
  const route = load({ blocked: 120, verify: "ok" });
  const response = await route.POST(request());
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "120");
  assert.deepEqual(route.calls, ["begin:user@example.test:true"]);
});

test("mot de passe actuel incorrect : échec compté ; panne fournisseur annulée", async () => {
  const invalid = load({ verify: "invalid" });
  assert.equal((await invalid.POST(request())).status, 400);
  assert.deepEqual(invalid.calls.slice(1), ["verify", "settle:failure"]);
  const down = load({ verify: "down" });
  assert.equal((await down.POST(request())).status, 503);
  assert.deepEqual(down.calls.slice(1), ["verify", "settle:cancelled"]);
});

test("succès : réservation soldée puis mot de passe mis à jour", async () => {
  const route = load({ verify: "ok" });
  assert.equal((await route.POST(request())).status, 200);
  assert.deepEqual(route.calls.slice(1), ["verify", "settle:success", "update"]);
});

test("erreur Supabase à la mise à jour : jamais renvoyée brute", async () => {
  const internal = load({ verify: "ok", update: { message: "Database error updating user: connection to 10.0.0.5 refused", status: 500 } });
  const response = await internal.POST(request());
  assert.equal(response.status, 500);
  assert.doesNotMatch(JSON.stringify(await response.json()), /Database|10\.0|connection/);
  const weak = load({ verify: "ok", update: { message: "Password should be at least 12 characters.", status: 422, code: "weak_password" } });
  const weakResponse = await weak.POST(request());
  assert.equal(weakResponse.status, 400);
  assert.doesNotMatch(JSON.stringify(await weakResponse.json()), /Password should/);
});
