import assert from "node:assert/strict";
import test from "node:test";
import { isRouteAllowed } from "../src/lib/permissions/route-guards";

test("un client ne peut pas accéder aux utilisateurs même avec la permission", () => {
  assert.equal(isRouteAllowed("/users", "CLIENT", ["users:read"]).allowed, false);
});
test("un mini-admin doit avoir la permission pour accéder aux utilisateurs", () => {
  assert.equal(isRouteAllowed("/users", "MINI_ADMIN", []).allowed, false);
  assert.equal(isRouteAllowed("/users", "MINI_ADMIN", ["users:read"]).allowed, true);
});
test("le portail et les missions restent séparés par rôle", () => {
  assert.equal(isRouteAllowed("/portal/orders", "CLIENT", ["dashboard:client"]).allowed, true);
  assert.equal(isRouteAllowed("/driver/missions", "CLIENT", ["dashboard:driver"]).allowed, false);
  assert.equal(isRouteAllowed("/driver/missions", "DRIVER", ["dashboard:driver"]).allowed, true);
});
test("le dashboard exige à la fois le rôle et la permission", () => {
  assert.equal(isRouteAllowed("/dashboard", "COMPANY_ADMIN", []).allowed, false);
  assert.equal(isRouteAllowed("/dashboard", "DISPATCHER", ["dashboard:company"]).allowed, false);
  assert.equal(isRouteAllowed("/dashboard", "COMPANY_ADMIN", ["dashboard:company"]).allowed, true);
});
