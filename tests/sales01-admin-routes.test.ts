import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { PLATFORM_ACCESS_UNAVAILABLE, gatePlatformWrite } from "../src/lib/api/platform-access";
import type { PlatformAccessEvent } from "../src/domains/admin/platform-access.service";

type Outcome = Record<string, unknown>;
type Handler = (request: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;

function load(file: string, role: string, calls: string[], journal: "ok" | "fail", outcome: Outcome = {}) {
  const module = { exports: {} as Record<string, Handler> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const gate = (kind: string) => async (_context: unknown, denied: Response | null, resource: string, method = "GET") => {
    calls.push(`audit:${kind}:${resource}:${method}:${denied ? "DENIED" : "ALLOWED"}`);
    if (journal === "fail" && !denied) return NextResponse.json({ error: PLATFORM_ACCESS_UNAVAILABLE }, { status: 503 });
    return denied;
  };
  runInNewContext(source, {
    URL, console, exports: module.exports, module,
    require: (id: string) => {
      if (id === "next/server") return { NextResponse };
      if (id === "@/lib/api/auth-guard") return {
        requireStaffRole: async () => {
          calls.push("staff");
          return role === "ANONYMOUS" ? { error: NextResponse.json({}, { status: 401 }) } : { context: { user: { id: "platform-1", role: { systemRole: role } } } };
        },
        requireRole: (_context: unknown, roles: string[]) => {
          calls.push("role");
          return roles.includes(role) ? null : NextResponse.json({}, { status: 403 });
        },
      };
      if (id === "@/lib/api/platform-access") return { gatePlatformRead: gate("read"), gatePlatformWrite: gate("write") };
      if (id === "@/domains/sales/sales-code.service") return {
        parseSalesCodeListParams: () => ({ query: { page: 1, pageSize: 25 } }),
        listSalesCodes: async () => { calls.push("service:list"); return { items: [] }; },
        createSalesCode: async (body: unknown, actorId: string) => { calls.push(`service:create:${actorId}:${JSON.stringify(body)}`); return outcome.create ?? { status: "created", salesCode: { id: "code-1" } }; },
        disableSalesCode: async (id: string, actorId: string) => { calls.push(`service:disable:${id}:${actorId}`); return outcome.disable ?? { status: "disabled" }; },
      };
      throw new Error(id);
    },
  });
  return module.exports;
}

function bodyWatched(calls: string[], url: string, body: unknown) {
  const request = new Request(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  return new Proxy(request, {
    get(target, prop, receiver) {
      if (prop === "json") calls.push("body");
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

const LIST = "src/app/api/admin/sales-codes/route.ts";
const DETAIL = "src/app/api/admin/sales-codes/[id]/route.ts";
const params = { params: Promise.resolve({ id: "code-1" }) };

test("SALES-1 admin : création réservée au super-administrateur, journalisée avant le corps et le service", async () => {
  const input = { sellerName: "Camille Roy", sellerEmail: "camille@example.invalid", level: "ASSISTED" };
  const calls: string[] = [];
  const created = await load(LIST, "SUPER_ADMIN", calls, "ok").POST!(bodyWatched(calls, "http://local/api/admin/sales-codes", input));
  assert.equal(created.status, 201);
  assert.equal(created.headers.get("cache-control"), "no-store");
  assert.deepEqual(calls, ["staff", "role", "audit:write:SALES_CODES:POST:ALLOWED", "body", `service:create:platform-1:${JSON.stringify(input)}`], "l'auteur vient de la session, jamais du corps");

  for (const [role, status] of [["COMPANY_ADMIN", 403], ["DISPATCHER", 403]] as const) {
    const deniedCalls: string[] = [];
    const denied = await load(LIST, role, deniedCalls, "ok").POST!(bodyWatched(deniedCalls, "http://local/api/admin/sales-codes", input));
    assert.equal(denied.status, status);
    assert.deepEqual(deniedCalls, ["staff", "role", "audit:write:SALES_CODES:POST:DENIED"], "refus journalisé, corps jamais lu");
  }

  const failedCalls: string[] = [];
  const failed = await load(LIST, "SUPER_ADMIN", failedCalls, "fail").POST!(bodyWatched(failedCalls, "http://local/api/admin/sales-codes", input));
  assert.equal(failed.status, 503, "sans journal, aucune écriture");
  assert.equal(failedCalls.some((call) => call === "body" || call.startsWith("service")), false);

  const anonymousCalls: string[] = [];
  assert.equal((await load(LIST, "ANONYMOUS", anonymousCalls, "ok").POST!(bodyWatched(anonymousCalls, "http://local/api/admin/sales-codes", input))).status, 401);
  assert.deepEqual(anonymousCalls, ["staff"]);

  const invalid = await load(LIST, "SUPER_ADMIN", [], "ok", { create: { status: "invalid", field: "sellerEmail" } }).POST!(bodyWatched([], "http://local/api/admin/sales-codes", {}));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).field, "sellerEmail");
  const duplicate = await load(LIST, "SUPER_ADMIN", [], "ok", { create: { status: "seller_has_code" } }).POST!(bodyWatched([], "http://local/api/admin/sales-codes", input));
  assert.equal(duplicate.status, 409);
});

test("SALES-1 admin : la liste suit le même contrôle que les autres lectures plateforme", async () => {
  const calls: string[] = [];
  const response = await load(LIST, "SUPER_ADMIN", calls, "ok").GET!(new Request("http://local/api/admin/sales-codes?page=1"));
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ["staff", "role", "audit:read:SALES_CODES:GET:ALLOWED", "service:list"]);
});

test("SALES-1 admin : désactivation explicite, idempotente et sans autre action possible", async () => {
  const calls: string[] = [];
  const ok = await load(DETAIL, "SUPER_ADMIN", calls, "ok").PATCH!(bodyWatched(calls, "http://local/api/admin/sales-codes/code-1", { action: "disable" }), params);
  assert.equal(ok.status, 200);
  assert.deepEqual(calls, ["staff", "role", "audit:write:SALES_CODES:PATCH:ALLOWED", "body", "service:disable:code-1:platform-1"]);

  for (const [outcome, status] of [[{ status: "not_found" }, 404], [{ status: "already_disabled" }, 409]] as const) {
    const response = await load(DETAIL, "SUPER_ADMIN", [], "ok", { disable: outcome }).PATCH!(bodyWatched([], "http://local/x", { action: "disable" }), params);
    assert.equal(response.status, status);
  }
  for (const body of [{ action: "enable" }, { action: "delete" }, {}, null]) {
    const bodyCalls: string[] = [];
    const response = await load(DETAIL, "SUPER_ADMIN", bodyCalls, "ok").PATCH!(bodyWatched(bodyCalls, "http://local/x", body), params);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(bodyCalls.some((call) => call.startsWith("service")), false, "aucune réactivation ni suppression");
  }
  const deniedCalls: string[] = [];
  const denied = await load(DETAIL, "MINI_ADMIN", deniedCalls, "ok").PATCH!(bodyWatched(deniedCalls, "http://local/x", { action: "disable" }), params);
  assert.equal(denied.status, 403);
  assert.deepEqual(deniedCalls, ["staff", "role", "audit:write:SALES_CODES:PATCH:DENIED"]);
});

test("SALES-1 admin : le journal enregistre la méthode d'écriture et bloque si indisponible", async () => {
  const stored: PlatformAccessEvent[] = [];
  const repository = { record: async (entry: PlatformAccessEvent) => { stored.push(entry); }, listActive: async () => [], listPage: async () => ({ total: 0, rows: [] }) };
  const context = { user: { id: "platform-1", role: { systemRole: "SUPER_ADMIN" as const } } };
  assert.equal(await gatePlatformWrite(context, null, "SALES_CODES", "POST", { repository, createId: () => "event-1", now: () => new Date("2026-10-27T00:00:00.000Z") }), null);
  assert.equal(stored[0]?.method, "POST");
  assert.equal(stored[0]?.resource, "SALES_CODES");
  const failing = { ...repository, record: async () => { throw new Error("down"); } };
  const blocked = await gatePlatformWrite(context, null, "SALES_CODES", "PATCH", { repository: failing });
  assert.equal(blocked?.status, 503);
});

test("SALES-1 admin : écran et lien réservés à la plateforme, sans montant ni client", async () => {
  const { adminNavItems, companyNavItems, miniAdminNavItems } = await import("../src/features/navigation/nav-config");
  assert.equal(adminNavItems.find((item) => item.title === "Codes commerciaux")?.href, "/admin/sales");
  assert.equal([...companyNavItems, ...miniAdminNavItems].some((item) => item.href === "/admin/sales"), false);
  const page = readFileSync("src/app/(back-office)/admin/sales/page.tsx", "utf8");
  const fields = [...page.matchAll(/row\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(fields)].sort(), ["attributions", "code", "createdAt", "disabledAt", "id", "level", "sellerEmail", "sellerName"]);
  for (const absent of ["companyId", "commissionCents", "rateBps", "Réactiver", "Supprimer"]) assert.equal(page.includes(absent), false, absent);
  const client = readFileSync("src/features/admin/sales-codes.ts", "utf8");
  assert.equal(client.includes('fetch(`/api/admin/sales-codes?${params.toString()}`, { cache: "no-store" })'), true);
  assert.equal(client.includes('JSON.stringify({ action: "disable" })'), true, "seule action de modification");
});
