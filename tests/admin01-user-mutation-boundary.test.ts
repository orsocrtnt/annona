import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { prisma } from "../src/services/prisma/client";
import {
  createUserByAdmin,
  deleteUserByAdmin,
  resolveCompanyIdForUserCreation,
} from "../src/domains/user/user.service";

const input = {
  firstName: "Test",
  lastName: "Local",
  email: "local@example.com",
  roleSlug: "driver" as const,
};

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (request?: Request, context?: { params: Promise<{ id: string }> }) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, exports: module.exports, module,
    require: (id: string) => {
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 comptes : super-admin refusé avant Prisma et sans entreprise implicite", async () => {
  let lookups = 0;
  const original = prisma.company.findFirst;
  prisma.company.findFirst = (async () => { lookups += 1; return null; }) as typeof prisma.company.findFirst;
  try {
    await assert.rejects(resolveCompanyIdForUserCreation(null), /COMPANY_REQUIRED/);
    await assert.rejects(resolveCompanyIdForUserCreation(undefined), /COMPANY_REQUIRED/);
    assert.equal(await resolveCompanyIdForUserCreation("company-1"), "company-1");
    assert.equal(lookups, 0);
    await assert.rejects(createUserByAdmin(input, "company-1", "SUPER_ADMIN"), /PLATFORM_USER_MUTATION_FORBIDDEN/);
    await assert.rejects(deleteUserByAdmin("user-1", "admin-1", "company-1", "SUPER_ADMIN"), /PLATFORM_USER_MUTATION_FORBIDDEN/);
  } finally {
    prisma.company.findFirst = original;
  }
});

test("ADMIN-1 comptes : routes refusées avant entreprise, paramètres, corps et métier", async () => {
  const calls: string[] = [];
  function auth(role: string) {
    return {
      requireStaffRole: async () => ({
        context: {
          user: {
            id: "admin",
            get companyId() { calls.push("company"); return "company-1"; },
            role: { systemRole: role },
          },
        },
      }),
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => {
        assert.equal([...roles].join(","), "ADMIN");
        return ["ADMIN"].includes(context.user.role.systemRole)
          ? null
          : NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      },
      getCompanyId: () => { calls.push("company"); return "company-1"; },
    };
  }
  const service = {
    createUserByAdmin: async () => { calls.push("create"); return { user: { id: "user-1" }, invitationSent: true }; },
    deleteUserByAdmin: async () => { calls.push("delete"); },
    listUsersForCompany: async () => { calls.push("list"); return []; },
  };
  const validation = {
    createUserSchema: { safeParse: () => { calls.push("parse"); return { success: true, data: input }; } },
  };
  function tracked(url: string, method: string) {
    const request = new Request(url, { method, body: JSON.stringify(input) });
    const read = request.json.bind(request);
    Object.defineProperty(request, "json", { value: async () => { calls.push("body"); return read(); } });
    return request;
  }
  function pendingParams() {
    const params = Promise.resolve({ id: "user-1" });
    const original = params.then.bind(params);
    params.then = ((onFulfilled, onRejected) => {
      calls.push("params");
      return original(onFulfilled, onRejected);
    }) as typeof params.then;
    return params;
  }
  for (const role of ["SUPER_ADMIN", "BAKER", "DRIVER", "MERCHANT"]) {
    const users = load("src/app/api/users/route.ts", {
      "next/server": { NextResponse },
      "@/lib/config-messages": require("../src/lib/config-messages"),
      "@/lib/api/auth-guard": auth(role),
      "@/lib/validations/user": validation,
      "@/domains/user/user.service": service,
    });
    const item = load("src/app/api/users/[id]/route.ts", {
      "next/server": { NextResponse },
      "@/lib/config-messages": require("../src/lib/config-messages"),
      "@/lib/api/auth-guard": auth(role),
      "@/lib/validations/user": validation,
      "@/domains/user/user.service": service,
    });
    for (const response of [
      await users.GET!(),
      await users.POST!(tracked("http://local/api/users", "POST")),
      await item.DELETE!(new Request("http://local/api/users/user-1", { method: "DELETE" }), { params: pendingParams() }),
    ]) {
      assert.equal(response.status, 403);
    }
  }
  assert.deepEqual(calls, []);

  const allowed = load("src/app/api/users/route.ts", {
    "next/server": { NextResponse },
    "@/lib/config-messages": require("../src/lib/config-messages"),
    "@/lib/api/auth-guard": auth("ADMIN"),
    "@/lib/validations/user": validation,
    "@/domains/user/user.service": service,
  });
  const listed = await allowed.GET!();
  const created = await allowed.POST!(tracked("http://local/api/users", "POST"));
  assert.equal(listed.status, 200);
  assert.equal(created.status, 201);
  assert.deepEqual(calls, ["company", "list", "body", "parse", "company", "create"]);

  const screen = readFileSync("src/app/(back-office)/users/page.tsx", "utf8");
  assert.equal(screen.includes("platformReadOnly ? null : <CreateUserDialog"), true);
  assert.equal(screen.includes("platformReadOnly ? null : ("), true);
  assert.equal(readFileSync("src/app/api/users/route.ts", "utf8").includes("listAllUsers"), false);
});
