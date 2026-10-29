import assert from "node:assert/strict";
import test from "node:test";
import type { SystemRole } from "@prisma/client";
import { adminNavItems } from "../src/features/navigation/nav-config";
import { buildMiniAdminSettings, MINI_ADMIN_MODULE_IDS } from "../src/lib/permissions/mini-admin";
import { getAllowedRolesForPath } from "../src/lib/permissions/rbac";
import { canOpenPage, getRoleHomePath } from "../src/lib/permissions/page-access";

const expected: Record<string, SystemRole[]> = {
  "/admin": ["SUPER_ADMIN"],
  "/companies": ["SUPER_ADMIN"],
  "/dashboard": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/dispatch": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/support": ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"],
  "/settings": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/users": ["COMPANY_ADMIN", "MINI_ADMIN"],
  "/onboarding": ["COMPANY_ADMIN"],
  "/driver": ["DRIVER"],
  "/portal": ["CLIENT"],
};

const permissionFor: Record<string, string> = {
  "/admin": "dashboard:admin",
  "/companies": "companies:read",
  "/dashboard": "dashboard:company",
  "/dispatch": "dashboard:dispatcher",
  "/settings": "settings:read",
  "/users": "users:read",
  "/onboarding": "settings:read",
  "/driver": "dashboard:driver",
  "/portal": "dashboard:client",
};

test("ADMIN-1 routes : le super-admin reste dans l'espace plateforme", () => {
  assert.equal(getRoleHomePath("SUPER_ADMIN"), "/admin");
  for (const [path, roles] of Object.entries(expected)) {
    assert.deepEqual([...getAllowedRolesForPath(path)].sort(), [...roles].sort(), path);
    for (const role of ["SUPER_ADMIN", "COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "DRIVER", "CLIENT"] as const) {
      const permission = permissionFor[path];
      const settings = role === "MINI_ADMIN" ? buildMiniAdminSettings("Tous", [...MINI_ADMIN_MODULE_IDS]) : {};
      const allowed = canOpenPage(path, { role, permissions: permission ? [permission] : [], settings });
      assert.equal(allowed, roles.includes(role), `guard ${role} ${path}`);
    }
  }
  for (const item of adminNavItems) {
    assert.equal(item.href === "/companies" || item.href.startsWith("/admin"), true, item.href);
  }
});
