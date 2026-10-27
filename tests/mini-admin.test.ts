import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextResponse } from "next/server";
import { prisma } from "../src/services/prisma/client";
import * as users from "../src/domains/user/user.service";
import * as validation from "../src/lib/validations/user";
import { MINI_ADMIN_MODULES, parseMiniAdminSettings, filterMiniAdminPermissions, canManageMiniAdmins } from "../src/lib/permissions/mini-admin";
import type { SystemRole } from "@prisma/client";

function replaceMethod(t: TestContext, target: object, key: string, fn: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, fn);
  t.after(() => { Reflect.set(target, key, original); });
}
const input = { firstName: "Test", lastName: "Local", email: "local@example.com", roleSlug: "mini-admin" as const, miniAdminTitle: "Comptes", miniAdminModules: ["accounts" as const] };
const roles: SystemRole[] = ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "CLIENT", "DRIVER"];
function fixture(t: TestContext, companyId: string | null = "a", targetRole = "MINI_ADMIN") {
  const writes: unknown[] = [];
  replaceMethod(t, prisma.user, "findUnique", async () => ({ id: "target", authId: "auth-target", companyId, roleId: "role", email: "local@example.com", settings: { locale: "fr", miniAdmin: { modules: ["accounts"] } } }));
  replaceMethod(t, prisma.user, "update", async (args: unknown) => { writes.push(args); return {}; });
  t.mock.method(prisma, "$queryRaw", async () => [{ id: "role", system_role: targetRole, slug: "mini-admin" }]);
  // Any unexpected write path fails before contacting external services.
  t.mock.method(prisma, "$transaction", async () => { assert.fail("unexpected transaction"); });
  return writes;
}

test("réglages absents, vides ou invalides : aucun droit ni module implicite", () => {
  const allPermissions = MINI_ADMIN_MODULES.flatMap((m) => m.permissions);
  for (const settings of [undefined, null, {}, [], { miniAdmin: null }, { miniAdmin: {} }, { miniAdmin: [] }, { miniAdmin: { modules: [] } }, { miniAdmin: { modules: "accounts" } }, { miniAdmin: { modules: ["unknown", null] } }]) {
    assert.deepEqual(parseMiniAdminSettings(settings).modules, []);
    assert.deepEqual(filterMiniAdminPermissions(allPermissions, settings), []);
  }
  const settings = { miniAdmin: { title: " Ops ", modules: ["orders", "unknown", "orders"] } };
  assert.deepEqual(parseMiniAdminSettings(settings), { title: "Ops", modules: ["orders"] });
  assert.deepEqual(filterMiniAdminPermissions(["orders:read", "users:update", "companies:update"], settings), ["orders:read"]);
});

for (const actorRole of roles) {
  test(`matrice de délégation : ${actorRole}`, async (t) => {
    const writes = fixture(t);
    assert.equal(canManageMiniAdmins(actorRole), actorRole === "SUPER_ADMIN" || actorRole === "COMPANY_ADMIN");
    if (actorRole === "SUPER_ADMIN") {
      await assert.rejects(users.updateMiniAdminByAdmin("target", input, "a", actorRole), /PLATFORM_USER_MUTATION_FORBIDDEN/);
      await assert.rejects(users.createUserByAdmin(input, "a", actorRole), /PLATFORM_USER_MUTATION_FORBIDDEN/);
      await assert.rejects(users.deleteUserByAdmin("target", "self", "a", actorRole), /PLATFORM_USER_MUTATION_FORBIDDEN/);
      assert.deepEqual(writes, []);
    } else if (actorRole === "COMPANY_ADMIN") {
      await users.updateMiniAdminByAdmin("target", input, "a", actorRole);
      assert.deepEqual(writes, [{ where: { id: "target" }, data: { settings: { locale: "fr", miniAdmin: { title: "Comptes", modules: ["accounts"] } } } }]);
      // Authorized creation reaches the existing-account check, without creating an account.
      await assert.rejects(users.createUserByAdmin(input, "a", actorRole), /EMAIL_EXISTS/);
    } else {
      // Same policy for self and other target, even if the caller has users:update.
      for (const target of ["self", "peer"]) {
        await assert.rejects(users.updateMiniAdminByAdmin(target, input, "a", actorRole), /MINI_ADMIN_MANAGEMENT_FORBIDDEN/);
      }
      await assert.rejects(users.createUserByAdmin(input, "a", actorRole), /MINI_ADMIN_MANAGEMENT_FORBIDDEN/);
      await assert.rejects(users.deleteUserByAdmin("target", "self", "a", actorRole), /MINI_ADMIN_MANAGEMENT_FORBIDDEN/);
      assert.deepEqual(writes, []);
    }
  });
}

test("administrateur : entreprise étrangère ou absente refusée, super-admin refusé avant écriture", async (t) => {
  const writes = fixture(t, "b");
  for (const company of ["a", null]) {
    await assert.rejects(users.updateMiniAdminByAdmin("target", input, company, "COMPANY_ADMIN"), /USER_NOT_FOUND/);
  }
  await assert.rejects(users.updateMiniAdminByAdmin("target", input, null, "SUPER_ADMIN"), /PLATFORM_USER_MUTATION_FORBIDDEN/);
  assert.deepEqual(writes, []);
});

test("deux entreprises nulles ne constituent pas un périmètre autorisé", async (t) => {
  const writes = fixture(t, null);
  await assert.rejects(users.updateMiniAdminByAdmin("target", input, null, "COMPANY_ADMIN"), /USER_NOT_FOUND/);
  assert.deepEqual(writes, []);
});

test("le mini-admin conserve la création client/livreur ; rôles supérieurs refusés", async (t) => {
  fixture(t);
  let targetRole = "CLIENT";
  t.mock.method(prisma, "$queryRaw", async () => [{ id: "role", system_role: targetRole, slug: targetRole.toLowerCase() }]);
  for (const role of ["CLIENT", "DRIVER", "COMPANY_ADMIN", "SUPER_ADMIN"]) {
    targetRole = role;
    await assert.rejects(users.createUserByAdmin({ ...input, roleSlug: role === "DRIVER" ? "driver" : "client" }, "a", "MINI_ADMIN"), role === "CLIENT" || role === "DRIVER" ? /EMAIL_EXISTS/ : /INVALID_ROLE/);
  }
});

// Execute real route source with a simulated authenticated actor and real domain services.
// No Next server, Supabase session or remote database is involved.
function route(file: string, role: SystemRole, companyId: string | null = "a") {
  const module = { exports: {} as Record<string, (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>> };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "@/lib/api/auth-guard": {
      requireStaffRole: async () => ({ context: { user: { id: "self", companyId, role: { systemRole: role } } } }),
      requireRole: (context: { user: { role: { systemRole: string } } }, roles: string[]) => (
        roles.includes(context.user.role.systemRole) ? null : NextResponse.json({ error: "Accès refusé" }, { status: 403 })
      ),
      getCompanyId: (context: { user: { companyId: string | null } }) => context.user.companyId,
    },
    "@/domains/user/user.service": users,
    "@/lib/validations/user": validation,
  };
  const source = ts.transpileModule(readFileSync(resolve(file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { Error, exports: module.exports, module, require: (id: string) => { assert.ok(id in dependencies, `Unexpected dependency ${id}`); return dependencies[id]; } });
  return module.exports;
}

test("routes réelles simulées : auto-modification, pair, création et suppression renvoient 403", async (t) => {
  const writes = fixture(t);
  const item = route("src/app/api/users/[id]/route.ts", "MINI_ADMIN");
  for (const id of ["self", "peer"]) {
    const response = await item.PATCH!(new Request("http://local/api/users/" + id, { method: "PATCH", body: JSON.stringify(input) }), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 403);
  }
  const created = await route("src/app/api/users/route.ts", "MINI_ADMIN").POST!(new Request("http://local/api/users", { method: "POST", body: JSON.stringify(input) }), { params: Promise.resolve({ id: "unused" }) });
  assert.equal(created.status, 403);
  const deleted = await item.DELETE!(new Request("http://local/api/users/peer", { method: "DELETE" }), { params: Promise.resolve({ id: "peer" }) });
  assert.equal(deleted.status, 403);
  assert.deepEqual(writes, []);
});

test("route réelle simulée : administrateur autorisé dans A, cible de B refusée", async (t) => {
  const writes = fixture(t);
  const request = () => new Request("http://local/api/users/target", { method: "PATCH", body: JSON.stringify(input) });
  const context = { params: Promise.resolve({ id: "target" }) };
  assert.equal((await route("src/app/api/users/[id]/route.ts", "COMPANY_ADMIN").PATCH!(request(), context)).status, 200);
  assert.equal((await route("src/app/api/users/[id]/route.ts", "COMPANY_ADMIN", "b").PATCH!(request(), context)).status, 404);
  assert.equal(writes.length, 1);
});
