import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(file: string, role: string, calls: string[], mode: "ok" | "missing" | "fail" = "ok") {
  const module = { exports: {} as {
    GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;
  } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const dependencies: Record<string, unknown> = {
    "@/domains/delivery/proof-links": { omitStoragePaths: (value: unknown) => value },
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
    "@/lib/api/route-handler": {
      withApiHandler: async (handler: () => Promise<Response>) => handler(),
    },
    "@/domains/delivery/delivery.service": {
      getCompanyDriversWithActivity: async () => {
        calls.push("list");
        if (mode === "fail") throw new Error("db");
        return [{ id: "driver-1" }];
      },
      getCompanyDriverDetail: async () => {
        calls.push("detail");
        return mode === "missing" ? null : { id: "driver-1" };
      },
    },
  };
  runInNewContext(source, {
    Error, exports: module.exports, module, console,
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
        return Promise.resolve({ id: "driver-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

test("ADMIN-1 chauffeurs : lecture refusée avant entreprise et paramètres", async () => {
  const listCalls: string[] = [];
  const list = load("src/app/api/drivers/route.ts", "SUPER_ADMIN", listCalls);
  assert.equal((await list.GET!()).status, 403);
  assert.deepEqual(listCalls, ["staff:drivers:read", "role"]);

  const detailCalls: string[] = [];
  const detail = load("src/app/api/drivers/[id]/route.ts", "SUPER_ADMIN", detailCalls);
  assert.equal((await detail.GET!(new Request("http://local/api/drivers/driver-1"), context(detailCalls))).status, 403);
  assert.deepEqual(detailCalls, ["staff:drivers:read", "role"]);
});

test("ADMIN-1 chauffeurs : les trois rôles conservent réponses et erreurs", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const list = await load("src/app/api/drivers/route.ts", role, []).GET!();
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { data: [{ id: "driver-1" }], success: true });

    const detailCalls: string[] = [];
    const detail = await load("src/app/api/drivers/[id]/route.ts", role, detailCalls).GET!(
      new Request("http://local/api/drivers/driver-1"),
      context(detailCalls)
    );
    assert.equal(detail.status, 200);
    assert.deepEqual(await detail.json(), { data: { id: "driver-1" }, success: true });
  }

  const failed = await load("src/app/api/drivers/route.ts", "COMPANY_ADMIN", [], "fail").GET!();
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error, "Impossible de charger les chauffeurs");

  const missing = await load("src/app/api/drivers/[id]/route.ts", "DISPATCHER", [], "missing").GET!(
    new Request("http://local/api/drivers/driver-1"),
    context([])
  );
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, "Chauffeur introuvable");
});
