/**
 * Lot 1, demande 7 — recherche d'article dans la commande récurrente : sur le nom, sans majuscules ni
 * accents, la liste se réduit pendant la frappe (aucun bouton à valider).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { foldForSearch, nameMatches } from "../src/lib/format/search";

const CATALOG = ["Baguette tradition", "Baguette viennoise", "Pain de campagne", "Éclair au chocolat", "Éclair café", "Croissant", "Sac à pain"];

test("lot 1, demande 7 : « bag » ne garde que les noms qui contiennent « bag » ; « eclair » trouve « Éclair au chocolat » ; vide = tout", () => {
  assert.deepEqual(CATALOG.filter((name) => nameMatches(name, "bag")), ["Baguette tradition", "Baguette viennoise"]);
  assert.deepEqual(CATALOG.filter((name) => nameMatches(name, "eclair")), ["Éclair au chocolat", "Éclair café"]);
  assert.deepEqual(CATALOG.filter((name) => nameMatches(name, "ÉCLAIR AU")), ["Éclair au chocolat"]);
  assert.deepEqual(CATALOG.filter((name) => nameMatches(name, "")), CATALOG);
  assert.deepEqual(CATALOG.filter((name) => nameMatches(name, "   ")), CATALOG);
  assert.equal(foldForSearch("Pâte à Choux"), "pate a choux");
});

test("lot 1, demande 7 : la fenêtre de la récurrente filtre en direct avec cette recherche, en haut de la liste", () => {
  const source = readFileSync("src/features/ordering/recurring-content.tsx", "utf8");
  assert.match(source, /nameMatches\(product\.name, search\)/);
  assert.match(source, /onChange=\{\(event\) => setSearch\(event\.target\.value\)\}/);
  assert.ok(source.indexOf('data-testid="recurring-search"') < source.indexOf('data-testid="recurring-catalog"'), "barre au-dessus de la liste");
});
