import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { withApiHandler } from "../src/lib/api/route-handler";

const files = [
  "src/app/api/orders/route.ts",
  "src/app/api/orders/stats/route.ts",
  "src/app/api/orders/dashboard/route.ts",
  "src/app/api/orders/export/route.ts",
  "src/app/api/orders/[id]/route.ts",
];

function load(file: string, role: string, calls: string[]) {
  const module = { exports: {} as { GET?: (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response> } };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const sink = new Proxy({}, {
    get: (_target, key) => {
      if (key === "parseOrderHistoryQuery") {
        return () => { calls.push("down"); return { success: true, data: {} }; };
      }
      return () => { calls.push("down"); return Promise.resolve("csv"); };
    },
  });
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/route-handler": { withApiHandler },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => {
        calls.push("staff");
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
    "@/domains/order/order.service": sink,
    "@/lib/validations/order-history": sink,
    "@/lib/validations/order": sink,
    "@/lib/storage/pod": sink,
    "@/domains/delivery/proof-links": sink,
  };
  runInNewContext(source, {
    Error, URL, console, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 commandes : cinq lectures refusées avant entreprise et export", async () => {
  const calls: string[] = [];
  for (const file of files) {
    const route = load(file, "SUPER_ADMIN", calls);
    const response = await route.GET!(new Request("http://local/api/orders"), { params: Promise.resolve({ id: "order-1" }) });
    assert.equal(response.status, 403, file);
  }
  assert.equal(calls.includes("company"), false);
  assert.equal(calls.includes("down"), false);
  assert.equal(calls.filter((call) => call === "role").length, 5);
});

test("ADMIN-1 commandes : les trois rôles autorisés passent une lecture", async () => {
  const samples = [
    ["COMPANY_ADMIN", "src/app/api/orders/stats/route.ts"],
    ["MINI_ADMIN", "src/app/api/orders/dashboard/route.ts"],
    ["DISPATCHER", "src/app/api/orders/route.ts"],
  ] as const;
  for (const [role, file] of samples) {
    const calls: string[] = [];
    const response = await load(file, role, calls).GET!(new Request("http://local/api/orders"));
    assert.equal(response.status, 200, role);
    assert.equal(calls[0], "staff");
    assert.equal(calls[1], "role");
    assert.equal(calls.includes("company"), true);
    assert.equal(calls.includes("down"), true);
  }
  const detail = readFileSync("src/app/api/orders/[id]/route.ts", "utf8");
  assert.equal(detail.includes("updateCompanyOrderStatus"), true);
  assert.equal(detail.includes("deleteCompanyOrder"), true);
});

test("ADMIN-1 commandes : aucune création n'est exportée sur la liste", () => {
  const source = readFileSync("src/app/api/orders/route.ts", "utf8");
  assert.equal(source.includes("export async function GET"), true);
  assert.equal(source.includes("export async function POST"), false);
  const body = source.slice(source.indexOf("export async function GET"));
  const guard = body.indexOf('requireRole(auth.context, ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"])');
  assert.equal(guard > body.indexOf("requireStaffRole(") && guard < body.indexOf("getCompanyId("), true);
});
