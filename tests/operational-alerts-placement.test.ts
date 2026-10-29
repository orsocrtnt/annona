import assert from "node:assert/strict";
import test from "node:test";
import { alertAccessLabel, alertBannerState, alertModeForPath, alertPlacementForPath, alertSeverity, alertSeverityLabel, alertSummaryLine, alertToggleLabel, splitAlertsForMode } from "../src/lib/operational-alerts-placement";
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

test("incident sans livraison : il remonte pour le livreur qui a une livraison en cours sur la commande", () => {
  const order = { deliveries: [{ id: "d1", status: "IN_DELIVERY", driverId: "moi" }, { id: "d2", status: "IN_DELIVERY", driverId: "autre" }, { id: "d3", status: "ASSIGNED", driverId: "moi" }] };
  assert.equal(isMissionInProgress(order, null, "moi"), true);
  assert.equal(isMissionInProgress(order, null, "autre"), true);
  assert.equal(isMissionInProgress(order, null, "inconnu"), false);
  assert.equal(isMissionInProgress(order, null), false, "hors livreur : jamais prioritaire");
  assert.equal(isMissionInProgress({ deliveries: [{ id: "d3", status: "ASSIGNED", driverId: "moi" }] }, null, "moi"), false, "affectée mais pas démarrée");
});
test("fiches détaillées : les alertes de la commande ou livraison de la page remontent", () => {
  assert.deepEqual(alertPlacementForPath("staff", "/dashboard/orders/o1"), { mode: "context", context: { orderId: "o1" } });
  assert.deepEqual(alertPlacementForPath("staff", "/dashboard/deliveries/d1/"), { mode: "context", context: { deliveryId: "d1" } });
  assert.deepEqual(alertPlacementForPath("client", "/portal/orders/o2"), { mode: "context", context: { orderId: "o2" } });
  assert.deepEqual(alertPlacementForPath("client", "/portal/deliveries/d2"), { mode: "context", context: { deliveryId: "d2" } });
  assert.equal(alertModeForPath("staff", "/dashboard/orders/new"), "floating");
  const all = [{ orderId: "o1", deliveryId: "d1" }, { orderId: "o1", deliveryId: null }, { orderId: "o9", deliveryId: "d9" }];
  assert.equal(splitAlertsForMode(all, "context", { orderId: "o1" }).top.length, 2);
  assert.equal(splitAlertsForMode(all, "context", { deliveryId: "d9" }).top.length, 1);
  assert.equal(splitAlertsForMode(all, "context", { orderId: "zz" }).behindAccess.length, 3);
});
test("profil livreur : pas de mission en haut", () => {
  assert.equal(alertModeForPath("driver", "/driver/profile"), "floating");
  assert.equal(alertModeForPath("driver", "/driver/missions"), "mission");
});
test("états sans alerte, avertissement, urgence, erreur", () => {
  assert.equal(alertBannerState({ error: false, rows: [] }), "none");
  assert.equal(alertBannerState({ error: false, rows: [{ state: "ACKNOWLEDGED" }] }), "warning");
  assert.equal(alertBannerState({ error: false, rows: [{ state: "ACKNOWLEDGED" }, { state: "OPEN" }] }), "urgent");
  assert.equal(alertBannerState({ error: true, rows: [{ state: "OPEN" }] }), "error", "l'erreur de chargement prime et reste visible");
  assert.equal(alertSeverityLabel(alertSeverity({ state: "OPEN" })), "Urgent");
  assert.equal(alertSeverityLabel(alertSeverity({ state: "ACKNOWLEDGED" })), "Pris en compte");
  assert.equal(alertToggleLabel(4), "Voir les 4 alertes");
});
