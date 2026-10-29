import assert from "node:assert/strict";
import test from "node:test";
import type { StyleSpecification } from "maplibre-gl";
import type { LiveDriverLocation } from "../src/domains/driver/driver-location.service";
import type { DispatchMapDelivery } from "../src/domains/delivery/dispatch-map.service";
import { toMentheStyle } from "../src/lib/maps/menthe-style";
import { readMapTheme } from "../src/hooks/use-map-theme";
import { MAP_PIN_BODY, MAP_STATUS_STYLE } from "../src/lib/maps/map-status-style";
import { mapPalette, mapRouteStyle, MAP_VISUAL_THEME_DARK } from "../src/lib/maps/map-visual-theme";
import {
  allowedMapViews,
  dashboardMapEmptyKind,
  mapViewShows,
  nextDashboardMapView,
  resolveMapView,
  sceneViewAction,
  shouldDropSelection,
  summarizeDelivery,
  summarizeDriver,
} from "../src/features/back-office/dashboard-map-model";
import {
  DASHBOARD_WIDGET_CATALOG,
  getVisibleDashboardWidgets,
  mergeMapWidgets,
  normalizeDashboardLayout,
  type DashboardWidgetLayout,
} from "../src/lib/dashboard/dashboard-layout";
import { getNavItemsForRole } from "../src/features/navigation/get-nav-items";
import { buildMiniAdminSettings } from "../src/lib/permissions/mini-admin";

function luminance(hex: string) {
  const c = hex.slice(1).match(/.{2}/g)!.map((v) => {
    const x = Number.parseInt(v, 16) / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const source = {
  version: 8,
  sources: {},
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#fff" } },
    { id: "highway_minor", type: "line", source: "x", "source-layer": "transportation", paint: { "line-color": "#000" } },
    { id: "label_city", type: "symbol", source: "x", "source-layer": "place", layout: { "text-field": ["get", "name_en"] }, paint: { "text-color": "#000", "text-halo-color": "#fff" } },
    { id: "building", type: "fill", source: "x", "source-layer": "building", paint: { "fill-color": "rgb(234, 234, 229)", "fill-outline-color": "rgb(219, 219, 218)" } },
    { id: "highway_path", type: "line", source: "x", "source-layer": "transportation", paint: { "line-color": "rgb(234, 234, 234)" } },
    { id: "railway_dashline", type: "line", source: "x", "source-layer": "transportation", paint: { "line-color": "#fafafa" } },
  ],
} as unknown as StyleSpecification;

test("carte sombre : même plan, teintes des jetons Dark, libellés lisibles", () => {
  const byId = (theme: "light" | "dark") =>
    Object.fromEntries(toMentheStyle(source, theme).layers.map((l) => [l.id, l])) as unknown as Record<string, { paint: Record<string, string>; layout?: Record<string, unknown> }>;
  const dark = byId("dark");
  const light = byId("light");
  assert.equal(dark.background!.paint["background-color"], "#181c1a");
  assert.equal(light.background!.paint["background-color"], "#eef2ef", "le Clair reste identique");
  assert.equal(dark.label_city!.paint["text-halo-color"], "#141716");
  assert.deepEqual(dark.label_city!.layout!["text-field"], ["coalesce", ["get", "name:fr"], ["get", "name"]]);
  assert.ok(contrast(dark.label_city!.paint["text-color"]!, dark.label_city!.paint["text-halo-color"]!) >= 7);
  assert.ok(contrast(dark.highway_minor!.paint["line-color"]!, dark.background!.paint["background-color"]!) >= 1.2, "routes distinctes de la terre");
  assert.equal(toMentheStyle(source).layers[0]!.id, "background");
  // De près, en Sombre : plus de contours de bâtiments clairs ni de trottoirs, plus aucun trait quasi blanc.
  assert.equal(dark.building!.paint["fill-outline-color"], dark.building!.paint["fill-color"]);
  assert.equal(dark.highway_path!.layout!.visibility, "none");
  assert.ok(contrast(dark.railway_dashline!.paint["line-color"]!, dark.background!.paint["background-color"]!) < 1.5, "pointillés de rail fondus dans l'encre");
  assert.equal(light.highway_path!.layout?.visibility, undefined, "le Clair garde tous ses détails");
  assert.equal(light.building!.paint["fill-outline-color"], "rgb(219, 219, 218)");
  assert.equal((source.layers[0] as unknown as { paint: Record<string, string> }).paint["background-color"], "#fff");
});

test("carte sombre : le thème se lit sur <html data-theme>, Clair par défaut", () => {
  assert.equal(readMapTheme({ getAttribute: () => "dark" }), "dark");
  assert.equal(readMapTheme({ getAttribute: () => "light" }), "light");
  assert.equal(readMapTheme({ getAttribute: () => null }), "light");
  assert.equal(readMapTheme(null), "light");
});

test("carte sombre : trajet, surfaces et corps d'épingle gardent 3:1 sur le plan sombre", () => {
  assert.ok(contrast(MAP_VISUAL_THEME_DARK.route, MAP_VISUAL_THEME_DARK.land) >= 3);
  assert.ok(contrast(MAP_VISUAL_THEME_DARK.route, MAP_VISUAL_THEME_DARK.routeHalo) >= 3);
  assert.ok(contrast(MAP_PIN_BODY.dark, MAP_VISUAL_THEME_DARK.land) >= 3);
  assert.equal(mapRouteStyle("dark").line.color, MAP_VISUAL_THEME_DARK.route);
  assert.equal(mapPalette("light").ink, "#0e1310");
});

test("statuts de la carte : couleur mesurée sur le corps de l'épingle, forme distincte par statut", () => {
  for (const theme of ["light", "dark"] as const) {
    const styles = Object.values(MAP_STATUS_STYLE[theme]);
    for (const style of styles) assert.ok(contrast(style.core, MAP_PIN_BODY[theme]) >= 3, `${theme} ${style.core}`);
    assert.equal(new Set(styles.map((s) => s.shape)).size, 4, "quatre formes distinctes : le sens ne dépend pas de la couleur");
    for (const style of styles) assert.ok(contrast(style.text, style.surface) >= 4.5, `${theme} pastille ${style.text}`);
  }
});

const now = Date.parse("2026-10-29T12:00:00Z");
function driver(partial: Partial<LiveDriverLocation>): LiveDriverLocation {
  return { id: "d1", name: "Livreur Jean Dupont", latitude: 48.85, longitude: 2.35, accuracy: 12.4, updatedAt: new Date(now - 5_000).toISOString(), activeMissions: 2, isOnline: true, estimated: false, motion: null, positionState: "live", ...partial };
}

test("fiche livreur : état explicite, précision seulement si relevée, lien canonique", () => {
  const live = summarizeDriver(driver({}), now);
  assert.equal(live.name, "Jean Dupont");
  assert.equal(live.state, "live");
  assert.equal(live.stateLabel, "En direct");
  assert.equal(live.missionsLabel, "2 missions actives");
  assert.equal(live.accuracyLabel, "Précision relevée : environ 12 m");
  assert.equal(live.href, "/dashboard/drivers/d1");
  const noAccuracy = summarizeDriver(driver({ accuracy: null }), now);
  assert.equal(noAccuracy.accuracyLabel, null, "aucune précision inventée");
  const stale = summarizeDriver(driver({ isOnline: false, updatedAt: new Date(now - 3_600_000).toISOString() }), now);
  assert.equal(stale.state, "lost");
  assert.match(stale.stateLabel, /Signal perdu/);
  assert.equal(stale.accuracyLabel, null, "pas de précision pour une position périmée");
  const none = summarizeDriver(driver({ latitude: null, longitude: null }), now);
  assert.equal(none.state, "unlocated");
  assert.equal(none.stateLabel, "Pas de position");
  assert.equal(summarizeDriver(driver({ activeMissions: 0 }), now).missionsLabel, "Aucune mission active");
});

function delivery(partial: Partial<DispatchMapDelivery>): DispatchMapDelivery {
  return {
    id: "m1", reference: "LIV-1", orderId: "o1", requestedDeliveryDate: null, status: "ASSIGNED", statusLabel: "Assignée", deliveryCategory: "STANDARD",
    driverId: "d1", driverName: "Livreur Jean Dupont", customerName: "Client Martin", driverLocation: null, positionState: "none", positionUpdatedAt: null,
    address: "1 rue A, Paris", pickupAddress: null, destination: { latitude: 48.8, longitude: 2.3 }, pickup: null, pickups: [], trackingSteps: [], orderItems: [],
    missionStartedAt: null, missionAcceptedAt: null, isHistorical: false, completedAt: null, createdAt: "2026-10-29T08:00:00Z", ...partial,
  } as DispatchMapDelivery;
}

test("fiche livraison : statut piloté, livreur absent explicite, lien canonique", () => {
  const assigned = summarizeDelivery(delivery({}), new Date(now));
  assert.equal(assigned.status, "pending");
  assert.equal(assigned.driver, "Jean Dupont");
  assert.equal(assigned.href, "/dashboard/deliveries/m1");
  const orphan = summarizeDelivery(delivery({ driverId: null, driverName: null, status: "PENDING" }), new Date(now));
  assert.equal(orphan.status, "unassigned");
  assert.equal(orphan.driver, "Sans livreur");
  assert.equal(summarizeDelivery(delivery({ destination: null }), new Date(now)).hasDestination, false);
});

test("états vides explicites : aucun livreur, aucune position, aucune mission, adresse non localisée", () => {
  assert.equal(dashboardMapEmptyKind("drivers", [], []), "no-driver");
  assert.equal(dashboardMapEmptyKind("drivers", [driver({ latitude: null, longitude: null })], []), "no-position");
  assert.equal(dashboardMapEmptyKind("drivers", [driver({})], []), "none");
  assert.equal(dashboardMapEmptyKind("deliveries", [], []), "no-mission");
  assert.equal(dashboardMapEmptyKind("deliveries", [], [delivery({ destination: null })]), "no-destination");
  assert.equal(dashboardMapEmptyKind("deliveries", [], [delivery({})]), "none");
  assert.equal(dashboardMapEmptyKind("all", [], []), "no-activity");
  assert.equal(dashboardMapEmptyKind("all", [driver({ latitude: null, longitude: null })], [delivery({ destination: null })]), "no-location");
  assert.equal(dashboardMapEmptyKind("all", [driver({ latitude: null, longitude: null })], [delivery({})]), "none", "une mission localisée suffit");
  assert.equal(dashboardMapEmptyKind("all", [driver({})], []), "none", "un livreur localisé suffit");
});

test("carte unique : Tout montre livreurs et livraisons, chaque bouton n'en montre qu'un", () => {
  assert.deepEqual(mapViewShows("all"), { drivers: true, deliveries: true });
  assert.deepEqual(mapViewShows("drivers"), { drivers: true, deliveries: false });
  assert.deepEqual(mapViewShows("deliveries"), { drivers: false, deliveries: true });
});

test("carte unique : vues proposées selon les droits, vue demandée ramenée aux vues permises", () => {
  assert.deepEqual(allowedMapViews(true, true), ["all", "drivers", "deliveries"]);
  assert.deepEqual(allowedMapViews(false, true), ["deliveries"], "sans accès aux livreurs : ni Tout ni Livreurs");
  assert.deepEqual(allowedMapViews(true, false), ["drivers"]);
  assert.equal(resolveMapView("drivers", allowedMapViews(true, true)), "drivers");
  assert.equal(resolveMapView(null, allowedMapViews(true, true)), "all");
  assert.equal(resolveMapView("n'importe", allowedMapViews(true, true)), "all");
  assert.equal(resolveMapView("all", allowedMapViews(false, true)), "deliveries", "un lien « Tout » ne montre pas les livreurs sans droit");
  assert.equal(resolveMapView("all", []), null);
});

test("bascule au clavier : flèches, Début, Fin, autres touches ignorées", () => {
  assert.equal(nextDashboardMapView("all", "ArrowRight"), "drivers");
  assert.equal(nextDashboardMapView("drivers", "ArrowRight"), "deliveries");
  assert.equal(nextDashboardMapView("deliveries", "ArrowRight"), "all");
  assert.equal(nextDashboardMapView("all", "ArrowLeft"), "deliveries");
  assert.equal(nextDashboardMapView("deliveries", "Home"), "all");
  assert.equal(nextDashboardMapView("all", "End"), "deliveries");
  assert.equal(nextDashboardMapView("drivers", "a"), null);
  assert.equal(nextDashboardMapView("deliveries", "ArrowRight", ["deliveries"]), "deliveries", "une seule vue permise : on y reste");
});

test("tableau de bord : un seul bloc carte proposé, les dispositions enregistrées à deux cartes sont fondues", () => {
  assert.deepEqual(DASHBOARD_WIDGET_CATALOG.filter((e) => e.category === "maps").map((e) => e.type), ["map-drivers"]);
  const stored = (widgets: Array<[string, boolean, number, number?]>) =>
    ({ widgets: widgets.map(([type, visible, order, mapHeight]) => ({ type, visible, order, ...(mapHeight ? { config: { mapHeight } } : {}) })) });
  // Les blocs absents de la disposition reprennent leur valeur par défaut : on ne regarde que ceux de l'exemple.
  const visibleTypes = (input: { widgets: { type: string }[] }) => {
    const listed = new Set(input.widgets.map((w) => w.type));
    return getVisibleDashboardWidgets(normalizeDashboardLayout(input as never)).map((w) => w.type).filter((t) => listed.has(t));
  };

  // Les deux cartes affichées : une seule reste, à la place de la première.
  assert.deepEqual(visibleTypes(stored([["alerts-row", true, 0], ["map-deliveries", true, 1], ["planning", true, 2], ["map-drivers", true, 3]])), ["alerts-row", "map-drivers", "planning"]);
  // Seule l'ancienne carte des livraisons était affichée : la carte unique la remplace, avec sa hauteur.
  const onlyDeliveriesInput = stored([["planning", true, 0], ["map-deliveries", true, 1, 420], ["map-drivers", false, 2]]);
  assert.deepEqual(visibleTypes(onlyDeliveriesInput), ["planning", "map-drivers"]);
  const onlyDeliveries = normalizeDashboardLayout(onlyDeliveriesInput as never);
  assert.equal(onlyDeliveries.widgets.find((w) => w.type === "map-drivers")?.config?.mapHeight, 420);
  // Sans carte : rien n'apparaît ; avec la seule carte unique : inchangé.
  assert.deepEqual(visibleTypes(stored([["planning", true, 0], ["map-deliveries", false, 1], ["map-drivers", false, 2]])), ["planning"]);
  assert.deepEqual(visibleTypes(stored([["map-drivers", true, 0], ["planning", true, 1]])), ["map-drivers", "planning"]);
});

test("menu : une seule entrée « Carte », y compris pour un mini-admin aux deux anciens modules carte", () => {
  const titles = (items: { title: string; href: string }[]) => items.filter((i) => i.title.startsWith("Carte")).map((i) => `${i.title} ${i.href}`);
  assert.deepEqual(titles(getNavItemsForRole("COMPANY_ADMIN")), ["Carte /dispatch/map"]);
  assert.deepEqual(titles(getNavItemsForRole("DISPATCHER")), ["Carte /dispatch/map"]);
  assert.deepEqual(titles(getNavItemsForRole("MINI_ADMIN", buildMiniAdminSettings("Ops", ["driver-map", "delivery-map"]))), ["Carte /dispatch/map"]);
  assert.deepEqual(titles(getNavItemsForRole("MINI_ADMIN", buildMiniAdminSettings("Ops", ["delivery-map"]))), ["Carte /dispatch/map"]);
  assert.deepEqual(titles(getNavItemsForRole("MINI_ADMIN", buildMiniAdminSettings("Ops", ["driver-map"]))), ["Carte /dispatch/drivers"], "l'ancien module seul garde son adresse");
  assert.deepEqual(titles(getNavItemsForRole("MINI_ADMIN", buildMiniAdminSettings("Ops", ["dispatch"]))), []);
});

test("tableau de bord : les anciennes dispositions à deux cartes n'en montrent qu'une", () => {
  const w = (type: string, order: number) => ({ type, visible: true, order }) as unknown as DashboardWidgetLayout;
  const merged = mergeMapWidgets([w("alerts-row", 0), w("map-deliveries", 1), w("map-drivers", 2), w("planning", 3)]);
  assert.deepEqual(merged.map((x) => x.type), ["alerts-row", "map-deliveries", "planning"]);
  const same = [w("planning", 0)];
  assert.equal(mergeMapWidgets(same), same);
});

test("cadrage : recentre à la sélection seulement, jamais à chaque relevé GPS", () => {
  const base = { hasTarget: true, fitKey: "a", lastFitKey: "a" };
  assert.equal(sceneViewAction({ ...base, selectedId: "d1", lastCenteredId: null }), "center");
  assert.equal(sceneViewAction({ ...base, selectedId: "d1", lastCenteredId: "d1" }), "hold", "un nouveau relevé ne déplace pas la carte");
  assert.equal(sceneViewAction({ ...base, selectedId: "d2", lastCenteredId: "d1" }), "center");
  assert.equal(sceneViewAction({ ...base, selectedId: null, lastCenteredId: "d1" }), "none");
  assert.equal(sceneViewAction({ ...base, selectedId: null, lastCenteredId: null, fitKey: "b" }), "fit");
  assert.equal(sceneViewAction({ ...base, selectedId: "d9", hasTarget: false, lastCenteredId: null, fitKey: "b" }), "fit");
});

test("sélection disparue : abandonnée seulement quand les données sont chargées", () => {
  assert.equal(shouldDropSelection("m1", false, true), true);
  assert.equal(shouldDropSelection("m1", false, false), false);
  assert.equal(shouldDropSelection("m1", true, true), false);
  assert.equal(shouldDropSelection(null, false, true), false);
});
