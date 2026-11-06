import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import { prisma } from "../src/services/prisma/client";
import { parseAccessAction, setPlatformCompanyAccess, setPlatformUserAccess } from "../src/domains/admin/account-access.service";

function stub(t: TestContext, model: string, value: Record<string, unknown>) {
  Object.defineProperty(prisma, model, { configurable: true, value });
  t.after(() => { Reflect.deleteProperty(prisma, model); });
}

test("COUPER : un compte actif est coupé puis rétabli ; super admin et autre statut refusés", async (t) => {
  const writes: unknown[] = [];
  let current: Record<string, unknown> | null = { id: "u1", status: "ACTIVE", role: { systemRole: "DRIVER" }, company: { id: "c" } };
  stub(t, "user", {
    findUnique: async () => current,
    updateMany: async (args: unknown) => { writes.push(args); return { count: 1 }; },
  });
  assert.deepEqual(await setPlatformUserAccess("u1", "suspend"), { ok: true, status: "SUSPENDED" });
  assert.deepEqual(writes[0], { where: { id: "u1", status: "ACTIVE" }, data: { status: "SUSPENDED" } });
  assert.deepEqual(await setPlatformUserAccess("u1", "restore"), { ok: false, code: "INVALID_STATE" }, "rétablir un compte actif");
  current = { ...current, status: "SUSPENDED" };
  assert.deepEqual(await setPlatformUserAccess("u1", "restore"), { ok: true, status: "ACTIVE" });
  current = { id: "s", status: "ACTIVE", role: { systemRole: "SUPER_ADMIN" }, company: null };
  assert.deepEqual(await setPlatformUserAccess("s", "suspend"), { ok: false, code: "PROTECTED" });
  current = { id: "p", status: "PENDING_VERIFICATION", role: { systemRole: "DRIVER" }, company: { id: "c" } };
  assert.deepEqual(await setPlatformUserAccess("p", "suspend"), { ok: false, code: "INVALID_STATE" });
  current = null;
  assert.deepEqual(await setPlatformUserAccess("x", "suspend"), { ok: false, code: "NOT_FOUND" });
  assert.equal(writes.length, 2);
});

test("COUPER : une entreprise en essai est suspendue puis rendue en essai", async (t) => {
  const writes: Array<{ where: unknown; data: { status: string; settings: Record<string, unknown> } }> = [];
  let current: Record<string, unknown> = { id: "c1", status: "TRIAL", settings: { theme: "x" } };
  stub(t, "company", {
    findUnique: async () => current,
    updateMany: async (args: (typeof writes)[number]) => { writes.push(args); return { count: 1 }; },
  });
  assert.deepEqual(await setPlatformCompanyAccess("c1", "suspend"), { ok: true, status: "SUSPENDED" });
  assert.deepEqual(writes[0]!.where, { id: "c1", status: "TRIAL", settings: { equals: { theme: "x" } } });
  assert.deepEqual(writes[0]!.data.settings, { theme: "x", platformSuspendedFromStatus: "TRIAL" });
  current = { ...current, status: "SUSPENDED", settings: writes[0]!.data.settings };
  assert.deepEqual(await setPlatformCompanyAccess("c1", "restore"), { ok: true, status: "TRIAL" });
  assert.deepEqual(writes[1]!.data, { status: "TRIAL", settings: { theme: "x" } });
  current = { id: "c2", status: "SUSPENDED", settings: null };
  assert.deepEqual(await setPlatformCompanyAccess("c2", "restore"), { ok: true, status: "ACTIVE" }, "sans repère : active");
});

test("COUPER : action validée, routes POST protégées", () => {
  assert.equal(parseAccessAction({ action: "suspend" }), "suspend");
  assert.equal(parseAccessAction({ action: "delete" }), null);
  assert.equal(parseAccessAction(null), null);
  for (const file of ["users", "companies"] as const) {
    const route = readFileSync(`src/app/api/admin/${file}/[id]/access/route.ts`, "utf8");
    assert.match(route, /requireRole\(auth\.context, \["SUPER_ADMIN"\]\)/);
    assert.match(route, /if \(denied\) return denied;/);
  }
});
