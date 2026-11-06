import assert from "node:assert/strict";
import test from "node:test";
import type { SystemRole } from "@prisma/client";
import { canOpenPage } from "../src/lib/permissions/page-access";

const open = (path: string, role: SystemRole, permissions: string[]) => canOpenPage(path, { role, permissions });

test("un client ne peut pas accéder aux utilisateurs même avec la permission", () => {
  assert.equal(open("/users", "MERCHANT", ["users:read"]), false);
});
test("l'administrateur doit avoir la permission pour accéder aux utilisateurs", () => {
  assert.equal(open("/users", "ADMIN", []), false);
  assert.equal(open("/users", "ADMIN", ["users:read"]), true);
});
test("le portail, l'espace boulanger et l'application livreur restent séparés par rôle", () => {
  assert.equal(open("/portal", "MERCHANT", ["dashboard:merchant"]), true);
  assert.equal(open("/driver", "MERCHANT", ["dashboard:driver"]), false);
  assert.equal(open("/driver", "DRIVER", ["dashboard:driver"]), true);
  assert.equal(open("/bakery", "BAKER", ["dashboard:baker"]), true);
  assert.equal(open("/bakery", "ADMIN", ["dashboard:baker"]), false);
  assert.equal(open("/dashboard", "BAKER", ["dashboard:company"]), false);
});
test("le dashboard exige à la fois le rôle et la permission", () => {
  assert.equal(open("/dashboard", "ADMIN", []), false);
  assert.equal(open("/dashboard", "ADMIN", ["dashboard:company"]), true);
});
