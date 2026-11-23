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

test("CARTE-1 : le tracé relie seulement ce qui reste à livrer, depuis le dernier arrêt fait", async () => {
  const { remainingPath } = await import("@/features/delivery-map/visible-rounds");
  const depot = { latitude: 48.85, longitude: 2.37 };
  const stop = (sequence: number, status: string) => ({ sequence, status, latitude: 48 + sequence / 100, longitude: 2 + sequence / 100 });
  // Arrêts 1 et 2 livrés, 3 en problème, 4 et 5 à livrer : départ du 3, puis 4 et 5.
  assert.deepEqual(remainingPath([stop(5, "PENDING"), stop(1, "DELIVERED"), stop(3, "INCIDENT"), stop(2, "DELIVERED"), stop(4, "PENDING")], depot), [
    [48.03, 2.03],
    [48.04, 2.04],
    [48.05, 2.05],
  ]);
  // Rien de livré : départ du laboratoire.
  assert.deepEqual(remainingPath([stop(1, "PENDING")], depot), [[48.85, 2.37], [48.01, 2.01]]);
  // Tournée terminée : aucun trait.
  assert.deepEqual(remainingPath([stop(1, "DELIVERED"), stop(2, "DELIVERED")], depot), []);
});
