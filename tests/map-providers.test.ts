import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverNavigationHud } from "../src/features/driver/driver-navigation-hud";
import * as config from "../src/lib/maps/provider-config";
import { fetchProviderJson } from "../src/lib/maps/provider-request";

function moduleAt(path: string, deps: Record<string, unknown>) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, Date, Error, console, URL, process, setTimeout, clearTimeout, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return module.exports as any;
}
const waypoints = [{ latitude: 48.856, longitude: 2.35 }, { latitude: 48.86, longitude: 2.36 }];
const goodRoute = { code: "Ok", routes: [{ distance: 900, duration: 180, geometry: { coordinates: [[2.35, 48.856], [2.36, 48.86]] }, legs: [{ steps: [{ distance: 900, name: "Rue de test", maneuver: { type: "depart", location: [2.35, 48.856] } }] }] }] };
function routeModule(response: unknown | Error) {
  let requests = 0;
  const module = moduleAt("src/lib/maps/osrm-route.ts", {
    "@/lib/maps/provider-config": config,
    "@/lib/maps/navigation-utils": { buildManeuverInstruction: () => "Continuer" },
    "@/lib/maps/provider-request": { fetchProviderJson: async () => { requests++; if (response instanceof Error) throw response; return response; } },
  });
  return { module, requests: () => requests };
}
function geocoder(response: unknown | Error) {
  let calls = 0; let url = "";
  const module = moduleAt("src/lib/geocoding.ts", {
    "@/lib/maps/provider-config": config,
    "@/lib/maps/provider-request": { fetchProviderJson: async (value: string) => { calls++; url = value; if (response instanceof Error) throw response; return response; } },
  });
  return { module, calls: () => calls, url: () => url };
}

test("MAP-2 : zoom OSM borné et configuration custom plafonnée au domaine déclaré", () => {
  assert.equal(config.tileProviderConfig({}).maxZoom, 19);
  assert.equal(config.tileProviderConfig({ url: "https://tiles.test/{z}/{x}/{y}", attribution: "Test", maxNativeZoom: "16" }).maxZoom, 16);
  assert.equal(config.tileProviderConfig({ url: "https://tiles.test", attribution: "Test", maxNativeZoom: "99" }).maxZoom, 1);
  assert.match(config.tileProviderConfig({ url: "https://tiles.test" }).url, /tile.openstreetmap.org/);
});
test("MAP-2 : itinéraire valide et aucune substitution sur erreur, route absente, zéro ou JSON incomplet", async () => {
  const good = routeModule(goodRoute); const result = await good.module.fetchOsrmNavigationRoute(waypoints);
  assert.equal(result.durationSeconds, 180); assert.equal(result.polyline.length, 2);
  for (const response of [new Error("HTTP 429"), new Error("timeout"), { code: "NoRoute" }, {}, null,
    { ...goodRoute, routes: [{ ...goodRoute.routes[0], duration: 0 }] },
    { ...goodRoute, routes: [{ ...goodRoute.routes[0], legs: [] }] },
    { ...goodRoute, routes: [{ ...goodRoute.routes[0], geometry: { coordinates: [[999, 48], [2, 49]] } }] }]) {
    assert.equal(await routeModule(response).module.fetchOsrmNavigationRoute(waypoints), null);
    assert.equal(await routeModule(response).module.fetchOsrmRoute(waypoints), null);
  }
});
test("MAP-2 : coordonnées invalides et moins de deux étapes n'appellent aucun fournisseur", async () => {
  const r = routeModule(goodRoute);
  assert.equal(await r.module.fetchOsrmNavigationRoute(waypoints.slice(0, 1)), null);
  assert.equal(await r.module.fetchOsrmNavigationRoute([{ latitude: NaN, longitude: 2 }, waypoints[0]]), null);
  assert.equal(r.requests(), 0);
});
test("MAP-2 : appels d'itinéraire rapprochés plafonnés à un appel par seconde", async () => {
  const r = routeModule(goodRoute);
  await r.module.fetchOsrmNavigationRoute(waypoints); await r.module.fetchOsrmNavigationRoute(waypoints);
  assert.equal(r.requests(), 1);
});
test("MAP-2 : requête et corps JSON suspendus expirent ; HTTP 429 et JSON invalide rejetés", async (t) => {
  let aborted = false;
  t.mock.method(globalThis, "fetch", async (_: unknown, options: any) => {
    options.signal.addEventListener("abort", () => { aborted = true; });
    return { ok: true, json: () => new Promise(() => {}) };
  });
  await assert.rejects(fetchProviderJson("https://provider.test", undefined, 15), /timeout/);
  assert.equal(aborted, true);
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 429 }));
  await assert.rejects(fetchProviderJson("https://provider.test"), /429/);
  t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => { throw new Error("bad JSON"); } }));
  await assert.rejects(fetchProviderJson("https://provider.test"), /bad JSON/);
});
test("MAP-2 : géocodage IGN actuel, cache et déduplication des appels simultanés", async () => {
  const g = geocoder({ features: [{ properties: { score: 0.9 }, geometry: { coordinates: [2.35, 48.85] } }] });
  const parts = { address: "Adresse test MAP-2", postalCode: "75001", city: "Paris" };
  const results = await Promise.all([g.module.geocodeAddress(parts), g.module.geocodeAddress(parts)]);
  assert.equal(results[0].lat, 48.85); assert.equal(g.calls(), 1);
  await g.module.geocodeAddress(parts); assert.equal(g.calls(), 1);
  assert.match(g.url(), /data.geopf.fr\/geocodage\/search/); assert.match(g.url(), /index=address/);
});
test("MAP-2 : géocodage absent/faible/invalide/429 ne crée aucun point ni cache positif", async () => {
  for (const response of [new Error("HTTP 429"), null, {}, { features: [] }, { features: [{ properties: { score: 0.2 }, geometry: { coordinates: [2, 48] } }] }, { features: [{ properties: { score: 0.9 }, geometry: { coordinates: [200, 48] } }] }]) {
    const g = geocoder(response);
    assert.equal(await g.module.geocodeAddress({ address: "test", postalCode: "75001" }), null);
    assert.equal((await g.module.geocodeManyCapped([{ key: "x", parts: { address: "test" } }])).size, 0);
    assert.equal(await g.module.geocodeAddress({}), null);
  }
});
test("MAP-2 : lot géocodage plafonné à huit appels", async () => {
  const g = geocoder({ features: [] });
  await g.module.geocodeManyCapped(Array.from({ length: 20 }, (_, i) => ({ key: String(i), parts: { address: `test ${i}` } })));
  assert.equal(g.calls(), 8);
});
test("MAP-2 : panne géocodage laisse les coordonnées nulles, sans persistence inventée", async () => {
  let writes = 0;
  const m = moduleAt("src/domains/delivery/delivery-coordinates.ts", {
    "@/lib/geocoding": { geocodeAddress: async () => null },
    "@/services/prisma/client": { prisma: { delivery: { update: async () => { writes++; } }, orderStop: { update: async () => { writes++; } } } },
  });
  const result = await m.resolveDeliveryCoordinateFields({ address: "test", pickupAddress: "test" });
  assert.equal(result.latitude, null); assert.equal(result.pickupLongitude, null);
  await m.ensureDeliveryCoordinates({ id: "test", address: "test" });
  await m.ensureOrderStopCoordinates({ id: "test", address: "test" });
  assert.equal(writes, 0);
});
test("MAP-2 : adresse non localisée bloque la navigation et la première collecte ne se décale pas", async () => {
  const mission = { id: "test", reference: "MAP-2", deliveryCategory: "COURIER", status: "ASSIGNED", missionStartedAt: new Date(), order: { stops: [] } };
  let i = 0;
  const m = moduleAt("src/domains/delivery/driver-navigation.service.ts", {
    "@/lib/maps/provider-config": config,
    "@/domains/delivery/delivery.service": { getDriverMissionById: async () => mission },
    "@/lib/order/courier-pickups": { getCourierPickupStops: () => [{ address: "première" }, { address: "seconde" }] },
    "@/lib/geocoding": { formatAddressQuery: () => "test", isLegacyFakeTrackingCoord: () => false, geocodeAddress: async () => (++i === 3 ? { lat: 48, lng: 2 } : null) },
  });
  const result = await m.getDriverMissionNavigation("d", "c", "m");
  assert.equal(result.destination, null); assert.equal(result.pickup, null); assert.equal(result.canNavigate, false);
  assert.match(result.unavailableReason, /Adresse non localisée/);
});
test("MAP-2 : HUD panne et attente GPS explicites, jamais durée zéro ni calcul permanent", () => {
  const html = renderToStaticMarkup(DriverNavigationHud({ guidance: null, destinationLabel: "test", etaLabel: null, remainingLabel: null, unavailable: true }));
  assert.match(html, /Itinéraire indisponible/); assert.doesNotMatch(html, /Calcul du guidage|0 min/);
  const waiting = renderToStaticMarkup(DriverNavigationHud({ guidance: null, destinationLabel: "test", etaLabel: null, remainingLabel: null, waitingForPosition: true }));
  assert.match(waiting, /attente de la position GPS/);
});
test("MAP-2 : carte historique reste importable sans window", async () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof (await import("../src/components/maps/delivery-map")).DeliveryMap, "function");
});
test("MAP-2 : estimation tarifaire indisponible en cas de géocodage absent", async () => {
  const m = moduleAt("src/domains/company/courier-estimate.service.ts", {
    "./billing-settings.service": { getCompanyBillingSettings: async () => ({ courier: { showClientEstimate: true } }) },
    "@/lib/geocoding": { geocodeAddress: async () => null },
  });
  const result = await m.estimateCourierPrice("test", { pickup: { address: "test" }, shipping: { address: "test" } });
  assert.equal(result.enabled, true); assert.equal(result.amount, null); assert.equal(result.distanceKm, null);
});
test("MAP-2 : cible inconnue ne devient jamais proximité confirmée", async () => {
  const m = moduleAt("src/domains/delivery/driver-proximity.service.ts", {
    "@/services/prisma/client": { prisma: {} },
    "@/domains/delivery/driver-navigation.service": { getDriverMissionNavigation: async () => ({ destination: null, pickup: null, pickups: [] }) },
    "@/lib/maps/driver-proximity": { DRIVER_PROXIMITY_THRESHOLD_METERS: 150, isNearLocation: () => true },
    "@/lib/maps/navigation-utils": { haversineMeters: () => 0 },
  });
  const result = await m.checkDriverMissionProximity("d", "c", "m", "delivery");
  assert.equal(result.near, false); assert.equal(result.hasLocation, false); assert.equal(result.distanceMeters, null);
});
test("MAP-2 : destination inconnue sans marqueur ni itinéraire inventé", async () => {
  const { buildDeliveryMapMarkers, getDeliveryRouteWaypoints, getDeliveryMapPhaseHint } = await import("../src/features/back-office/dispatch-delivery-map-state");
  const delivery = { id: "test", destination: null, pickup: null, pickups: [], deliveryCategory: "STANDARD", status: "IN_DELIVERY", driverLocation: { latitude: 48, longitude: 2 }, trackingSteps: [] } as any;
  assert.equal(buildDeliveryMapMarkers(delivery).length, 0);
  assert.equal(getDeliveryRouteWaypoints(delivery), null);
  assert.equal(getDeliveryMapPhaseHint(delivery), null);
});

test("TRACK-2 : la couche d'itinéraire reprend après la prochaine étape du livreur", async () => {
  const { getDeliveryRouteWaypoints, getRouteWaypointsAfterDriver } = await import("../src/features/back-office/dispatch-delivery-map-state");
  const pickup = { id: "p", latitude: 48.84, longitude: 2.37, address: "Gare", label: "Collecte" };
  const base = { id: "c", deliveryCategory: "COURIER", status: "ASSIGNED", destination: { latitude: 48.88, longitude: 2.34 }, pickup: null, pickups: [pickup], driverName: "Karim", trackingSteps: [] } as any;
  const toPickup = { ...base, driverLocation: { latitude: 48.85, longitude: 2.36, motion: { from: { latitude: 48.85, longitude: 2.36 }, target: { latitude: 48.84, longitude: 2.37 }, since: "2026-10-27T12:00:00Z" } } };
  const rest = getRouteWaypointsAfterDriver(toPickup)!;
  assert.deepEqual(rest.map((w: any) => [w.latitude, w.longitude]), [[48.84, 2.37], [48.88, 2.34]], "collecte → livraison ; le tronçon livreur → collecte est au marqueur");
  const collected = { ...toPickup, status: "IN_DELIVERY", driverLocation: { ...toPickup.driverLocation, motion: { ...toPickup.driverLocation.motion, target: { latitude: 48.88, longitude: 2.34 } } } };
  assert.equal(getRouteWaypointsAfterDriver(collected), null, "prochaine étape = livraison : rien d'autre à tracer");
  const still = { ...base, driverLocation: { latitude: 48.85, longitude: 2.36, motion: null } };
  assert.deepEqual(getRouteWaypointsAfterDriver(still), getDeliveryRouteWaypoints(still), "sans trajectoire : parcours complet inchangé");
});
