import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(role: string, calls: string[], fail?: string) {
  const module = { exports: {} as {
    PATCH?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
    DELETE?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  } };
  const source = ts.transpileModule(readFileSync("src/app/api/orders/[id]/route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        calls.push(`staff:${permission}`);
        return { context: { user: { role: { systemRole: role } } } };
      },
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        calls.push("role");
        assert.equal([...roles].join(","), "COMPANY_ADMIN,MINI_ADMIN,DISPATCHER");
        return roles.includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    },
    "@/domains/order/order.service": {
      getCompanyOrderById: async () => { calls.push("get"); return null; },
      updateCompanyOrderStatus: async () => {
        calls.push("update");
        if (fail) throw new Error(fail);
        return { id: "order-1" };
      },
      deleteCompanyOrder: async () => { calls.push("delete"); return { id: "order-1" }; },
    },
    "@/lib/validations/order": {
      updateOrderStatusSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: { status: "CANCELLED" } }; } },
    },
    "@/lib/storage/pod": { getPodPhotoSignedUrl: async () => { calls.push("sign"); return null; } },
  };
  runInNewContext(source, {
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
        return Promise.resolve({ id: "order-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

test("ADMIN-1 commande : mutation refusée avant entreprise, corps et paramètres", async () => {
  const calls: string[] = [];
  const route = load("SUPER_ADMIN", calls);
  const request = new Request("http://local/api/orders/order-1", { method: "PATCH", body: "{}" });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  assert.equal((await route.PATCH!(request, context(calls))).status, 403);
  assert.equal((await route.DELETE!(new Request("http://local/api/orders/order-1"), context(calls))).status, 403);
  assert.deepEqual(calls, ["staff:orders:update", "role", "staff:orders:update", "role"]);
});

test("ADMIN-1 commande : les trois rôles passent et le conflit de statut reste", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const calls: string[] = [];
    const route = load(role, calls);
    assert.equal((await route.PATCH!(new Request("http://local/api/orders/order-1", { method: "PATCH", body: "{}" }), context(calls))).status, 200);
    assert.equal(calls.includes("update"), true);
  }
  const calls: string[] = [];
  const conflict = await load("COMPANY_ADMIN", calls, "ORDER_STATUS_CONFLICT").PATCH!(
    new Request("http://local/api/orders/order-1", { method: "PATCH", body: "{}" }),
    context(calls)
  );
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error, "Le statut vient d’être modifié. Rechargez la commande.");
});
