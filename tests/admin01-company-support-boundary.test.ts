import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };

function transpile(file: string) {
  return ts.transpileModule(readFileSync(file, "utf8"), options).outputText;
}

function loadStaff(role: string, permissions: string[], calls: string[]) {
  const module = { exports: {} as { requireSupportStaff?: () => Promise<{ error?: Response; companyId?: string; context?: { user: { id: string } } }> } };
  const dependencies: Record<string, unknown> = {
    "server-only": {},
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => {
        calls.push("staff");
        return { context: { user: { id: "user-1", role: { systemRole: role } }, permissions } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "ADMIN");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
  };
  runInNewContext(transpile("src/lib/api/support-staff-auth.ts"), {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function loadRoute(file: string, staff: object, calls: string[]) {
  const module = { exports: {} as {
    GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;
    POST?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    PATCH?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  } };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/support-staff-auth": staff,
    "@/lib/api/route-handler": { withApiHandler: async (handler: () => Promise<Response>) => handler() },
    "@/domains/support/support.service": {
      getStaffTickets: async () => { calls.push("list"); return [{ id: "ticket-1" }]; },
      getStaffTicketById: async () => { calls.push("detail"); return { id: "ticket-1" }; },
      addStaffTicketMessage: async () => { calls.push("message"); return { ticket: { id: "ticket-1" } }; },
      updateStaffTicketStatus: async () => { calls.push("status"); return { id: "ticket-1" }; },
    },
    "@/lib/validations/support": {
      supportMessageSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: { body: "Bonjour" } }; } },
      updateSupportTicketStatusSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: { status: "OPEN" } }; } },
    },
  };
  runInNewContext(transpile(file), {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

function context(calls: string[]) {
  return {
    params: {
      then(onFulfilled: (value: { id: string }) => unknown) {
        calls.push("params");
        return Promise.resolve({ id: "ticket-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

function bodyRequest(calls: string[]) {
  const request = new Request("http://local/api/support/ticket-1", { method: "POST", body: "{}" });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  return request;
}

async function callAll(role: string, permissions: string[], calls: string[]) {
  const staff = loadStaff(role, permissions, calls);
  const list = loadRoute("src/app/api/support/route.ts", staff, calls);
  const detail = loadRoute("src/app/api/support/[id]/route.ts", staff, calls);
  return {
    list: await list.GET!(),
    detail: await detail.GET!(new Request("http://local/api/support/ticket-1"), context(calls)),
    post: await detail.POST!(bodyRequest(calls), context(calls)),
    patch: await detail.PATCH!(bodyRequest(calls), context(calls)),
  };
}

test("ADMIN-1 support entreprise : quatre méthodes refusées avant entreprise, corps et paramètres", async () => {
  const calls: string[] = [];
  const responses = await callAll("SUPER_ADMIN", ["support:read"], calls);
  assert.equal(responses.list.status, 403);
  assert.equal(responses.detail.status, 403);
  assert.equal(responses.post.status, 403);
  assert.equal(responses.patch.status, 403);
  assert.deepEqual(calls, ["staff", "role", "staff", "role", "staff", "role", "staff", "role"]);
});

test("ADMIN-1 support entreprise : administrateur sans support:read refusé avant l'entreprise", async () => {
  const calls: string[] = [];
  const responses = await callAll("ADMIN", [], calls);
  assert.equal(responses.list.status, 403);
  assert.equal(responses.detail.status, 403);
  assert.equal(responses.post.status, 403);
  assert.equal(responses.patch.status, 403);
  assert.equal(calls.includes("company"), false);
  assert.equal(calls.filter((call) => call === "role").length, 4);
});

test("ADMIN-1 support entreprise : l'administrateur conserve les réponses", async () => {
  for (const role of ["ADMIN"]) {
    const calls: string[] = [];
    const responses = await callAll(role, ["support:read"], calls);
    assert.equal(responses.list.status, 200);
    assert.deepEqual(await responses.list.json(), { data: [{ id: "ticket-1" }], success: true });
    assert.equal(responses.detail.status, 200);
    assert.equal(responses.post.status, 201);
    assert.equal(responses.patch.status, 200);
    assert.equal(calls.includes("list") && calls.includes("detail") && calls.includes("message") && calls.includes("status"), true);
  }
});
