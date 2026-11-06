import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";

// SEC-4 : les corps JSON sont validés par Zod .strict() ; tout champ inconnu,
// type inattendu ou JSON mal formé reçoit une réponse 400 claire, sans appel métier.
type Handler = (request: Request, context?: unknown) => Promise<Response>;
type Handlers = { GET: Handler; POST: Handler; PATCH: Handler };
function load(file: string, dependencies: Record<string, unknown>): Handlers {
  const module = { exports: {} as Handlers };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const deps: Record<string, unknown> = { "next/server": { NextResponse }, zod, "@/lib/api/route-handler": { withApiHandler }, ...dependencies };
  runInNewContext(source, { exports: module.exports, module, console, Error, require: (id: string) => {
    assert.ok(id in deps, `Unexpected dependency ${id}`);
    return deps[id];
  } });
  return module.exports;
}
const json = (body: unknown, method = "POST") =>
  new Request("http://local", { method, headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
const clientAuth = { requireMerchantRole: async () => ({ context: { user: { id: "client-1", companyId: "company-1" } } }) };

test("notifications portail : ids facultatifs, champ inconnu ou id non texte refusé", async () => {
  const marked: unknown[] = [];
  const { PATCH } = load("src/app/api/portal/notifications/route.ts", {
    "@/lib/api/auth-guard": clientAuth,
    "@/domains/client-portal/notify.service": {
      listClientNotifications: async () => [],
      markClientNotificationsRead: async (userId: string, ids?: string[]) => { marked.push([userId, ids]); },
    },
  });
  assert.equal((await PATCH(json({}, "PATCH"))).status, 200);
  assert.equal((await PATCH(json({ ids: ["n1", "n2"] }, "PATCH"))).status, 200);
  assert.equal((marked[0] as unknown[])[1], undefined);
  assert.deepEqual([...(marked[1] as [string, string[]])[1]], ["n1", "n2"]);
  for (const body of [{ ids: ["n1"], userId: "other" }, { ids: [1] }, { ids: "n1" }, "not-json"]) {
    assert.equal((await PATCH(json(body, "PATCH"))).status, 400, JSON.stringify(body));
  }
  assert.equal(marked.length, 2);
});

