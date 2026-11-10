/**
 * Lot 1, D9 (décision du 10 novembre 2026) : le portail client et l'application livreur s'affichent sans
 * attendre la session du navigateur ; une fois la session connue, seul le bon rôle garde la page.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { roleGuardShowsPage } from "../src/components/auth/role-guard";

test("LOT1-D9 : page affichée pendant le chargement de la session (le middleware a déjà vérifié le rôle)", () => {
  assert.equal(roleGuardShowsPage({ role: "MERCHANT", isLoading: true, userRole: null }), true);
  assert.equal(roleGuardShowsPage({ role: "DRIVER", isLoading: true, userRole: null }), true);
});

test("LOT1-D9 : session connue du bon rôle → page affichée, autre rôle ou pas de session → rien", () => {
  assert.equal(roleGuardShowsPage({ role: "MERCHANT", isLoading: false, userRole: "MERCHANT" }), true);
  assert.equal(roleGuardShowsPage({ role: "MERCHANT", isLoading: false, userRole: "DRIVER" }), false);
  assert.equal(roleGuardShowsPage({ role: "MERCHANT", isLoading: true, userRole: "ADMIN" }), false);
  assert.equal(roleGuardShowsPage({ role: "DRIVER", isLoading: false, userRole: null }), false);
});
