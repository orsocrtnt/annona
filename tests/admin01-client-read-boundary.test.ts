import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";

function load(file: string, role: string, calls: string[]) {
  const module = { exports: {} as {
    GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>;
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
    "@/lib/api/route-handler": {
      withApiHandler: async (handler: () => Promise<Response>) => handler(),
    },
    "@/domains/client-portal/client-admin.service": {
      getCompanyClients: async () => { calls.push("list"); return [{ id: "client-1" }]; },
      getCompanyClientDetail: async () => { calls.push("detail"); return { id: "client-1" }; },
    },
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
        return Promise.resolve({ id: "client-1" }).then(onFulfilled);
      },
    } as Promise<{ id: string }>,
  };
}

test("ADMIN-1 clients : lecture refusée avant entreprise et paramètres", async () => {
  const listCalls: string[] = [];
  const list = load("src/app/api/clients/route.ts", "SUPER_ADMIN", listCalls);
  assert.equal((await list.GET!()).status, 403);
  assert.deepEqual(listCalls, ["staff:orders:read", "role"]);

  const detailCalls: string[] = [];
  const detail = load("src/app/api/clients/[id]/route.ts", "SUPER_ADMIN", detailCalls);
  assert.equal((await detail.GET!(new Request("http://local/api/clients/client-1"), context(detailCalls))).status, 403);
  assert.deepEqual(detailCalls, ["staff:orders:read", "role"]);
});

test("ADMIN-1 clients : les trois rôles conservent la réponse", async () => {
  for (const role of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]) {
    const listCalls: string[] = [];
    const list = await load("src/app/api/clients/route.ts", role, listCalls).GET!();
    assert.equal(list.status, 200);
    assert.deepEqual(await list.json(), { data: [{ id: "client-1" }], success: true });

    const detailCalls: string[] = [];
    const detail = await load("src/app/api/clients/[id]/route.ts", role, detailCalls).GET!(
      new Request("http://local/api/clients/client-1"),
      context(detailCalls)
    );
    assert.equal(detail.status, 200);
    assert.equal(detailCalls.includes("detail"), true);
    assert.deepEqual(await detail.json(), { data: { id: "client-1" }, success: true });
  }
});

test("ADMIN-1 clients : aucune mutation n'est exportée", () => {
  for (const file of ["src/app/api/clients/route.ts", "src/app/api/clients/[id]/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes("export async function GET"), true);
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      assert.equal(source.includes(`export async function ${method}`), false, `${file} ${method}`);
    }
    const body = source.slice(source.indexOf("export async function GET"));
    const guard = body.indexOf('requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"])');
    assert.equal(guard > body.indexOf("requireStaffRole(") && guard < body.indexOf("getCompanyId("), true);
  }
});
