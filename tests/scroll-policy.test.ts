import assert from "node:assert/strict";
import test from "node:test";
import { shouldResetScrollOnNavigation } from "../src/lib/navigation/scroll-policy";

const base = { previousPathname: "/settings", pathname: "/settings/billing", hash: "", historyPathname: null };

test("UX-NAV-SCROLL : un clic de menu vers une autre page remonte en haut", () => {
  assert.equal(shouldResetScrollOnNavigation(base), true);
});

test("UX-NAV-SCROLL : Retour/Avancer, ancres, filtres et premier rendu ne remontent pas", () => {
  assert.equal(shouldResetScrollOnNavigation({ ...base, historyPathname: "/settings/billing" }), false);
  assert.equal(shouldResetScrollOnNavigation({ ...base, hash: "#tarifs" }), false);
  assert.equal(shouldResetScrollOnNavigation({ ...base, pathname: "/settings" }), false);
  assert.equal(shouldResetScrollOnNavigation({ ...base, previousPathname: null }), false);
});

test("UX-NAV-SCROLL : un popstate resté en attente sur un autre chemin n'empêche pas la remontée", () => {
  assert.equal(shouldResetScrollOnNavigation({ ...base, historyPathname: "/dashboard" }), true);
});
