import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(file: string, role: string, calls: string[], fail?: string) {
  const module = { exports: {} as {
    PATCH?: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
  } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
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
    "@/domains/delivery/delivery.service": {
      getCompanyDeliveryById: async () => { calls.push("get"); return null; },
      adminUpdateDelivery: async () => {
        calls.push("update");
        if (fail) throw new Error(fail);
        return { id: "delivery-1" };
      },
      assignDeliveryToDriver: async () => {
        calls.push("assign");
        if (fail) throw new Error(fail);
        return { id: "delivery-1" };
      },
    },
    "@/lib/validations/delivery": {
      adminUpdateDeliverySchema: { safeParse: () => { calls.push("parse"); return { success: true, data: { status: "CANCELLED" } }; } },
      assignDeliverySchema: { safeParse: () => { calls.push("parse"); return { success: true, data: { driverId: "driver-1", force: false } }; } },
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
        return Promise.resolve({ id: "delivery-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

function bodyRequest(calls: string[]) {
  const request = new Request("http://local/api/deliveries/delivery-1", { method: "PATCH", body: "{}" });
  const read = request.json.bind(request);
  Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
  return request;
}

test("ADMIN-1 livraisons : mutation refusée avant corps, entreprise et paramètres", async () => {
  const updateCalls: string[] = [];
  const update = load("src/app/api/deliveries/[id]/route.ts", "SUPER_ADMIN", updateCalls);
  assert.equal((await update.PATCH!(bodyRequest(updateCalls), context(updateCalls))).status, 403);
  assert.deepEqual(updateCalls, ["staff:deliveries:update", "role"]);

  const assignCalls: string[] = [];
  const assign = load("src/app/api/deliveries/[id]/assign/route.ts", "SUPER_ADMIN", assignCalls);
  assert.equal((await assign.PATCH!(bodyRequest(assignCalls), context(assignCalls))).status, 403);
  assert.deepEqual(assignCalls, ["staff:deliveries:dispatch", "role"]);
});

test("ADMIN-1 livraisons : les trois rôles passent et un conflit 409 reste par route", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const updateCalls: string[] = [];
    const update = await load("src/app/api/deliveries/[id]/route.ts", role, updateCalls).PATCH!(
      bodyRequest(updateCalls),
      context(updateCalls)
    );
    assert.equal(update.status, 200);
    assert.equal(updateCalls.includes("update"), true);

    const assignCalls: string[] = [];
    const assign = await load("src/app/api/deliveries/[id]/assign/route.ts", role, assignCalls).PATCH!(
      bodyRequest(assignCalls),
      context(assignCalls)
    );
    assert.equal(assign.status, 200);
    assert.equal(assignCalls.includes("assign"), true);
  }

  const statusConflict = await load("src/app/api/deliveries/[id]/route.ts", "COMPANY_ADMIN", [], "DELIVERY_STATUS_CONFLICT").PATCH!(
    new Request("http://local/api/deliveries/delivery-1", { method: "PATCH", body: "{}" }),
    context([])
  );
  assert.equal(statusConflict.status, 409);
  assert.equal((await statusConflict.json()).error, "L’état de cette livraison a changé. Actualisez la page.");

  const assignConflict = await load("src/app/api/deliveries/[id]/assign/route.ts", "DISPATCHER", [], "DELIVERY_ASSIGNMENT_CONFLICT").PATCH!(
    new Request("http://local/api/deliveries/delivery-1/assign", { method: "PATCH", body: "{}" }),
    context([])
  );
  assert.equal(assignConflict.status, 409);
  assert.equal((await assignConflict.json()).error, "Cette livraison vient d’être modifiée par un autre dispatcher. Actualisez la page.");
});
