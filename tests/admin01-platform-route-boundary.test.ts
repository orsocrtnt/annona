import assert from "node:assert/strict";
import test from "node:test";
import type { SystemRole } from "@prisma/client";
import { adminNavItems } from "../src/features/navigation/nav-config";
import { getAllowedRolesForPath } from "../src/lib/permissions/rbac";
import { canOpenPage, getRoleHomePath } from "../src/lib/permissions/page-access";

const ROLES: SystemRole[] = ["SUPER_ADMIN", "ADMIN", "BAKER", "DRIVER", "MERCHANT"];

const expected: Record<string, SystemRole[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/companies": ["SUPER_ADMIN"],
  "/dashboard": ["ADMIN"],
  "/support": ["ADMIN"],
  "/settings": ["ADMIN"],
  "/users": ["ADMIN"],
  "/bakery": ["BAKER"],
  "/driver": ["DRIVER"],
  "/portal": ["MERCHANT"],
};

const permissionFor: Record<string, string> = {
  "/admin": "dashboard:admin",
  "/companies": "companies:read",
  "/dashboard": "dashboard:company",
  "/support": "support:read",
  "/settings": "settings:read",
  "/users": "users:read",
  "/bakery": "dashboard:baker",
  "/driver": "dashboard:driver",
  "/portal": "dashboard:merchant",
};

test("ADMIN-1 routes : le super-admin reste dans l'espace plateforme", () => {
  assert.equal(getRoleHomePath("SUPER_ADMIN"), "/admin");
  for (const [path, roles] of Object.entries(expected)) {
    assert.deepEqual([...getAllowedRolesForPath(path)].sort(), [...roles].sort(), path);
    for (const role of ROLES) {
      const permission = permissionFor[path];
      const allowed = canOpenPage(path, { role, permissions: permission ? [permission] : [] });
      assert.equal(allowed, roles.includes(role), `guard ${role} ${path}`);
    }
  }
  for (const item of adminNavItems) {
    assert.equal(item.href === "/companies" || item.href.startsWith("/admin"), true, item.href);
  }
});
