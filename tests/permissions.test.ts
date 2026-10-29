import assert from "node:assert/strict";
import test from "node:test";
import type { SystemRole } from "@prisma/client";
import { buildMiniAdminSettings } from "../src/lib/permissions/mini-admin";
import { canOpenPage } from "../src/lib/permissions/page-access";

const open = (path: string, role: SystemRole, permissions: string[], settings: unknown = {}) =>
  canOpenPage(path, { role, permissions, settings });

test("un client ne peut pas accéder aux utilisateurs même avec la permission", () => {
  assert.equal(open("/users", "CLIENT", ["users:read"]), false);
});
test("un mini-admin doit avoir la permission pour accéder aux utilisateurs", () => {
  const accounts = buildMiniAdminSettings("Comptes", ["accounts"]);
  assert.equal(open("/users", "MINI_ADMIN", [], accounts), false);
  assert.equal(open("/users", "MINI_ADMIN", ["users:read"], accounts), true);
  // La permission sans le module « Gestion des comptes » ne suffit pas.
  assert.equal(open("/users", "MINI_ADMIN", ["users:read"], buildMiniAdminSettings("Support", ["support"])), false);
});
test("le portail et les missions restent séparés par rôle", () => {
  assert.equal(open("/portal/orders", "CLIENT", ["dashboard:client"]), true);
  assert.equal(open("/driver/missions", "CLIENT", ["dashboard:driver"]), false);
  assert.equal(open("/driver/missions", "DRIVER", ["dashboard:driver"]), true);
});
test("le dashboard exige à la fois le rôle et la permission", () => {
  assert.equal(open("/dashboard", "COMPANY_ADMIN", []), false);
  assert.equal(open("/dashboard", "DISPATCHER", ["dashboard:company"]), false);
  assert.equal(open("/dashboard", "COMPANY_ADMIN", ["dashboard:company"]), true);
});
