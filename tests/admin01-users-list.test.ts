import assert from "node:assert/strict";
import * as miniAdminModule from "../src/lib/permissions/mini-admin";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { adminNavItems, companyNavItems } from "../src/features/navigation/nav-config";
import { getAllowedRolesForPath } from "../src/lib/permissions/rbac";
import {
  listPlatformUsers,
  parsePlatformUserListParams,
  platformUserSelect,
  type PlatformUserListParams,
} from "../src/domains/admin/users.service";

const now = new Date("2026-10-25T12:00:00.000Z");

function load(file: string, dependencies: Record<string, unknown>) {
  const module = { exports: {} as Record<string, (request?: Request) => Promise<Response>> };
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(source, {
    Error, Date, URL, exports: module.exports, module,
    require: (id: string) => {
      // Lot 1, demande 4 : règles des mini admins, module pur réel.
      if (id === "@/lib/permissions/mini-admin") return miniAdminModule;
      assert.ok(id in dependencies, `Unexpected dependency ${id}`);
      return dependencies[id];
    },
  });
  return module.exports;
}

test("ADMIN-1 comptes plateforme : filtres, pagination et select minimal", async () => {
  assert.equal((parsePlatformUserListParams(new URLSearchParams(`page=${"9".repeat(400)}`)) as { error: string }).error, "Page invalide");
  assert.equal((parsePlatformUserListParams(new URLSearchParams("role=OWNER")) as { error: string }).error, "Rôle invalide");
  const parsed = parsePlatformUserListParams(new URLSearchParams("q=Ada&role=DRIVER&status=ACTIVE&page=2&pageSize=25"));
  assert.ok("query" in parsed);
  const calls: string[] = [];
  const page = await listPlatformUsers(parsed.query as PlatformUserListParams, {
    user: {
      count: async () => { calls.push("count"); return 1; },
      findMany: async (args) => {
        calls.push("findMany");
        assert.deepEqual(args.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
        assert.equal(args.skip, 25);
        const where = args.where as { status: string; role: { systemRole: string }; OR: Array<Record<string, unknown>> };
        assert.equal(where.status, "ACTIVE");
        assert.equal(where.role.systemRole, "DRIVER");
        assert.equal(where.OR.length, 3);
        return [{
          id: "user-1",
          firstName: "Ada",
          lastName: "Lovelace",
          status: "ACTIVE" as const,
          createdAt: now,
          company: null,
          role: { systemRole: "DRIVER" as const },
        }];
      },
    },
  });
  assert.deepEqual(calls, ["count", "findMany"]);
  assert.equal(page.rows[0]?.name, "Livreur Ada Lovelace");
  assert.equal(page.rows[0]?.company, null);
  const select = platformUserSelect();
  for (const forbidden of ["email", "phone", "authId", "settings", "avatarUrl", "lastLoginAt"]) {
    assert.equal(forbidden in select, false);
  }
  const screen = readFileSync("src/app/(back-office)/admin/users/page.tsx", "utf8");
  assert.equal(screen.includes("DeleteUserButton"), false);
  assert.equal(screen.includes("CreateUserDialog"), false);
  assert.equal(adminNavItems.find((item) => item.title === "Utilisateurs")?.href, "/admin/users");
  assert.equal(companyNavItems.some((item) => item.href === "/users"), true);
  assert.equal(getAllowedRolesForPath("/users").includes("SUPER_ADMIN"), false);
  assert.equal(getAllowedRolesForPath("/admin/users").includes("SUPER_ADMIN"), true);
});

test("ADMIN-1 comptes plateforme : autorisation avant lecture et ancien GET refusé", async () => {
  let allowed = false;
  const reads: string[] = [];
  const admin = load("src/app/api/admin/users/route.ts", {
    "next/server": { NextResponse },
    "@/lib/config-messages": require("../src/lib/config-messages"),
    "@/lib/api/auth-guard": {
      requireStaffRole: async (permission: string) => {
        assert.equal(permission, "dashboard:admin");
        return allowed ? { context: {} } : { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
      },
      requireRole: () => null,
    },
    "@/lib/api/platform-access": { gatePlatformRead: async (_context: unknown, denied: Response | null) => denied },
    "@/domains/admin/users.service": {
      parsePlatformUserListParams,
      listPlatformUsers: async () => { reads.push("read"); return { page: 1, pageSize: 25, total: 0, rows: [] }; },
    },
  });
  assert.equal((await admin.GET!(new Request("http://local/api/admin/users"))).status, 403);
  assert.equal(reads.length, 0);
  allowed = true;
  assert.equal((await admin.GET!(new Request("http://local/api/admin/users?email=a@b.c"))).status, 400);
  assert.equal(reads.length, 0);
  const ok = await admin.GET!(new Request("http://local/api/admin/users"));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("cache-control"), "no-store");

  const legacy = load("src/app/api/users/route.ts", {
    "next/server": { NextResponse },
    "@/lib/config-messages": require("../src/lib/config-messages"),
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => ({ context: { user: { companyId: null, role: { systemRole: "SUPER_ADMIN" } } } }),
      requireRole: () => NextResponse.json({ error: "Accès refusé" }, { status: 403 }),
    },
    "@/lib/validations/user": { createUserSchema: {} },
    "@/domains/user/user.service": {
      listUsersForCompany: async () => { reads.push("legacy"); return []; },
      createUserByAdmin: async () => { reads.push("create"); },
    },
  });
  assert.equal((await legacy.GET!()).status, 403);
  assert.equal(reads.includes("legacy"), false);
});
