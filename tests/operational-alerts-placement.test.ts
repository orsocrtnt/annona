import assert from "node:assert/strict";
import test from "node:test";
import { alertAccessLabel, alertModeForPath, alertSummaryLine, splitAlertsForMode } from "../src/lib/operational-alerts-placement";
import { isMissionInProgress } from "../src/domains/operational-alerts/operational-alerts.policy";

test("le résumé n'apparaît que sur les vues de supervision, l'accès « Alertes » ailleurs", () => {
  assert.equal(alertModeForPath("staff", "/dashboard"), "summary");
  assert.equal(alertModeForPath("staff", "/dispatch/"), "summary");
  assert.equal(alertModeForPath("staff", "/dashboard/orders"), "summary");
  assert.equal(alertModeForPath("staff", "/dashboard/clients"), "floating");
  assert.equal(alertModeForPath("staff", "/dispatch/map"), "floating");
  assert.equal(alertModeForPath("client", "/portal"), "summary");
  assert.equal(alertModeForPath("client", "/portal/settings"), "floating");
  assert.equal(alertModeForPath("driver", "/driver"), "mission");
});

const rows = [{ id: "a", missionActive: true }, { id: "b", missionActive: false }, { id: "c" }];
test("sans alerte, rien n'est affiché ni caché", () => {
  for (const mode of ["summary", "floating", "mission"] as const) assert.deepEqual(splitAlertsForMode([], mode), { top: [], behindAccess: [] });
});
test("aucune alerte n'est perdue : chaque mode les place en haut ou derrière l'accès", () => {
  for (const mode of ["summary", "floating", "mission"] as const) {
    const { top, behindAccess } = splitAlertsForMode(rows, mode);
    assert.equal(top.length + behindAccess.length, rows.length);
  }
  assert.deepEqual(splitAlertsForMode(rows, "summary").top.length, 3);
  assert.deepEqual(splitAlertsForMode(rows, "floating").top.length, 0);
});
test("livreur : seule la mission en cours reste en haut", () => {
  const { top, behindAccess } = splitAlertsForMode(rows, "mission");
  assert.deepEqual(top.map(r => r.id), ["a"]);
  assert.deepEqual(behindAccess.map(r => r.id), ["b", "c"]);
});
test("libellés : avertissement (une alerte) et urgence (plusieurs)", () => {
  assert.equal(alertAccessLabel(1), "Alertes, 1 à suivre");
  assert.equal(alertAccessLabel(4), "Alertes, 4 à suivre");
  assert.equal(alertSummaryLine("Retard · Claire", 1), "Retard · Claire");
  assert.equal(alertSummaryLine("Retard · Claire", 2), "Retard · Claire · +1 autre");
  assert.equal(alertSummaryLine("Retard · Claire", 3), "Retard · Claire · +2 autres");
});
test("mission en cours = achat ou livraison en cours, pas une mission seulement affectée", () => {
  const order = { deliveries: [{ id: "d1", status: "IN_DELIVERY" }, { id: "d2", status: "ASSIGNED" }, { id: "d3", status: "PURCHASING" }] };
  assert.equal(isMissionInProgress(order, "d1"), true);
  assert.equal(isMissionInProgress(order, "d3"), true);
  assert.equal(isMissionInProgress(order, "d2"), false);
  assert.equal(isMissionInProgress(order, null), false);
  assert.equal(isMissionInProgress(order, "inconnue"), false);
});
