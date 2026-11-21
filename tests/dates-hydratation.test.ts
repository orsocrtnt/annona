import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useMounted } from "../src/hooks/use-mounted";

// Recette du 20 novembre : les pages du back-office sont précalculées au build. Un « aujourd'hui » calculé au rendu
// y restait figé à la date du déploiement ; le lendemain, React voyait un autre texte dans le navigateur (erreur
// n° 418 sur « Envois aux boutiques » et l'accueil du super-administrateur).

function Probe() {
  return createElement("span", null, useMounted() ? "monté" : "serveur");
}

test("useMounted : faux au rendu serveur (et donc à l'hydratation)", () => {
  assert.equal(renderToStaticMarkup(createElement(Probe)), "<span>serveur</span>");
});

test("les textes datés du jour attendent que la page soit montée", () => {
  const shipments = readFileSync("src/features/lab/shipments-content.tsx", "utf8");
  assert.match(shipments, /const mounted = useMounted\(\);/);
  assert.match(shipments, /\{mounted \? \(/);
  const home = readFileSync("src/features/admin/home/admin-home-panel.tsx", "utf8");
  assert.match(home, /mounted \? todayFormat\.format\(new Date\(\)\)/);
  assert.doesNotMatch(home.replace(/mounted \? todayFormat\.format\(new Date\(\)\)/, ""), /todayFormat\.format\(new Date\(\)\)/);
});
