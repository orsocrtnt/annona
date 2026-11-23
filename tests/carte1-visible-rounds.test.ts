// CARTE-1 — carte unique du gérant : on peut afficher toutes les tournées ou n'en voir qu'une (demande d'Orso du
// 23 novembre 2026).
import assert from "node:assert/strict";
import test from "node:test";
import { isRoundVisible, normalizeVisible, soloRoundId, toggleRound } from "@/features/delivery-map/visible-rounds";

const ids = ["nord-matin", "sud-matin", "nord-soir", "sud-soir"];

test("CARTE-1 : toucher une tournée quand toutes sont affichées n'affiche plus qu'elle", () => {
  assert.deepEqual(toggleRound("all", "sud-matin", ids), ["sud-matin"]);
  assert.equal(soloRoundId(["sud-matin"], ids), "sud-matin");
  assert.equal(isRoundVisible(["sud-matin"], "nord-matin"), false);
});

test("CARTE-1 : toucher d'autres tournées les ajoute ou les retire, dans l'ordre d'affichage", () => {
  const two = toggleRound(["sud-soir"], "nord-matin", ids);
  assert.deepEqual(two, ["nord-matin", "sud-soir"]);
  assert.equal(soloRoundId(two, ids), null);
  assert.deepEqual(toggleRound(two, "sud-soir", ids), ["nord-matin"]);
});

test("CARTE-1 : retirer la dernière ou les choisir toutes revient à « Toutes »", () => {
  assert.equal(toggleRound(["nord-matin"], "nord-matin", ids), "all");
  assert.equal(toggleRound(["nord-matin", "sud-matin", "nord-soir"], "sud-soir", ids), "all");
  assert.ok(ids.every((id) => isRoundVisible("all", id)));
});

test("CARTE-1 : une tournée disparue (terminée, supprimée) sort de la sélection ; une seule tournée = sa fiche", () => {
  assert.deepEqual(normalizeVisible(["ancienne", "sud-matin"], ids), ["sud-matin"]);
  assert.equal(normalizeVisible(["ancienne"], ids), "all");
  assert.equal(toggleRound("all", "inconnue", ids), "all");
  assert.equal(toggleRound("all", "seule", ["seule"]), "all");
  assert.equal(soloRoundId("all", ["seule"]), "seule");
});
