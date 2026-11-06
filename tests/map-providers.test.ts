import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import * as config from "../src/lib/maps/provider-config";
import { fetchProviderJson } from "../src/lib/maps/provider-request";
import { parseIgnNavigationRoute, parseOsrmNavigationRoute, readableStreetName, validWaypoints } from "../src/lib/maps/navigation-route";
import { fetchServerNavigationRoute } from "../src/lib/maps/server-navigation-route";

function moduleAt(path: string, deps: Record<string, unknown>) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { module, exports: module.exports, Date, Error, console, URL, process, setTimeout, clearTimeout, AbortController, JSON, Array, fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args), require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return module.exports as any;
}
const waypoints = [{ latitude: 48.856, longitude: 2.35 }, { latitude: 48.86, longitude: 2.36 }];
const goodRoute = { code: "Ok", routes: [{ distance: 900, duration: 180, geometry: { coordinates: [[2.35, 48.856], [2.36, 48.86]] }, legs: [{ steps: [{ distance: 900, name: "Rue de test", maneuver: { type: "depart", location: [2.35, 48.856] } }] }] }] };
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
test("MAP-2 : itinéraire OSRM valide et aucune substitution sur route absente, zéro ou JSON incomplet", () => {
  const result = parseOsrmNavigationRoute(goodRoute)!;
  assert.equal(result.durationSeconds, 180); assert.equal(result.polyline.length, 2);
  assert.deepEqual(result.polyline[0], [48.856, 2.35], "latitude puis longitude");
  for (const response of [{ code: "NoRoute" }, {}, null,
    { ...goodRoute, routes: [{ ...goodRoute.routes[0], duration: 0 }] },
    { ...goodRoute, routes: [{ ...goodRoute.routes[0], legs: [] }] },
    { ...goodRoute, routes: [{ ...goodRoute.routes[0], geometry: { coordinates: [[999, 48], [2, 49]] } }] }]) {
    assert.equal(parseOsrmNavigationRoute(response), null);
  }
});
const ignRoute = {
  distance: 1200, duration: 240, distanceUnit: "meter", timeUnit: "second",
  geometry: { type: "LineString", coordinates: [[2.35, 48.856], [2.355, 48.858], [2.36, 48.86]] },
  portions: [{ steps: [
    { geometry: { coordinates: [[2.35, 48.856], [2.355, 48.858]] }, attributes: { name: "0230012712\", \"cpx_gestionnaire\": \"\", \"vi" }, distance: 700, instruction: { type: "depart" } },
    { geometry: { coordinates: [[2.355, 48.858], [2.36, 48.86]] }, attributes: { name: "Rue de Rivoli" }, distance: 500, instruction: { type: "turn", modifier: "right" } },
    { geometry: { coordinates: [[2.36, 48.86], [2.36, 48.86]] }, attributes: { name: "stric" }, distance: 0, instruction: { type: "arrive" } },
  ] }],
};
test("LEGAL-1 : itinéraire IGN lu, noms de voie tronqués écartés plutôt qu'affichés faux", () => {
  const route = parseIgnNavigationRoute(ignRoute)!;
  assert.equal(route.distanceMeters, 1200); assert.equal(route.durationSeconds, 240);
  assert.equal(route.polyline.length, 3); assert.deepEqual(route.polyline[0], [48.856, 2.35]);
  assert.equal(route.steps.length, 3);
  assert.equal(route.steps[0]!.streetName, null, "fragment de JSON écarté");
  assert.equal(route.steps[1]!.streetName, "Rue de Rivoli");
  assert.equal(route.steps[1]!.modifier, "right");
  assert.deepEqual([route.steps[1]!.latitude, route.steps[1]!.longitude], [48.858, 2.355], "manœuvre au début de l'étape");
  assert.equal(route.steps[2]!.streetName, null, "fragment sans espace écarté");
  for (const bad of [null, {}, { ...ignRoute, distance: 0 }, { ...ignRoute, distanceUnit: "kilometer" },
    { ...ignRoute, portions: [] }, { ...ignRoute, geometry: { coordinates: [[999, 48], [2, 49]] } },
    { ...ignRoute, portions: [{ steps: [{ ...ignRoute.portions[0]!.steps[0], instruction: {} }] }] }]) {
    assert.equal(parseIgnNavigationRoute(bad), null);
  }
  assert.equal(readableStreetName("Avenue des Champs-Élysées"), "Avenue des Champs-Élysées");
  assert.equal(readableStreetName("eu\": \"\", \"urbain\": \"t\","), null);
});
test("LEGAL-1 : serveur — fournisseur configuré seulement, OSRM privé puis IGN, aucun appel sans configuration", async () => {
  const urls: string[] = [];
  const fetchJson = async (url: string) => { urls.push(url); return url.includes("/route/v1/") ? { code: "NoRoute" } : ignRoute; };
  const three = [...waypoints, { latitude: 48.87, longitude: 2.37 }];
  assert.equal(await fetchServerNavigationRoute(waypoints, { config: null, fetchJson }), null);
  assert.equal(urls.length, 0, "aucun fournisseur par défaut");
  const route = await fetchServerNavigationRoute(three, { config: { osrmUrl: "https://osrm.prive.test", ignUrl: "https://data.geopf.fr/navigation/itineraire" }, fetchJson });
  assert.equal(route?.distanceMeters, 1200, "repli IGN quand l'OSRM privé ne trouve pas");
  assert.match(urls[0]!, /^https:\/\/osrm\.prive\.test\/route\/v1\/driving\/2\.35,48\.856;2\.36,48\.86;2\.37,48\.87\?/);
  const ign = new URL(urls[1]!);
  assert.equal(ign.searchParams.get("resource"), "bdtopo-valhalla");
  assert.equal(ign.searchParams.get("start"), "2.35,48.856");
  assert.equal(ign.searchParams.get("end"), "2.37,48.87");
  assert.equal(ign.searchParams.get("intermediates"), "2.36,48.86");
  urls.length = 0;
  assert.equal(await fetchServerNavigationRoute([waypoints[0]!], { config: { osrmUrl: null, ignUrl: "https://x.test" }, fetchJson }), null);
  assert.equal(await fetchServerNavigationRoute([{ latitude: NaN, longitude: 2 }, waypoints[0]!], { config: { osrmUrl: null, ignUrl: "https://x.test" }, fetchJson }), null);
  assert.equal(urls.length, 0, "coordonnées invalides : aucun appel");
  assert.equal(await fetchServerNavigationRoute(waypoints, { config: { osrmUrl: null, ignUrl: "https://x.test" }, fetchJson: async () => { throw new Error("HTTP 429"); } }), null);
});
test("LEGAL-1 : le navigateur n'appelle que /api/maps/route, une fois par seconde au plus", async (t) => {
  const calls: Array<{ url: string; body: string }> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: { body: string }) => {
    calls.push({ url, body: init.body });
    return { ok: true, json: async () => ({ data: parseOsrmNavigationRoute(goodRoute) }) };
  });
  const client = moduleAt("src/lib/maps/route-client.ts", {
    "@/lib/maps/provider-config": config,
    "@/lib/maps/navigation-route": { validWaypoints },
  });
  const route = await client.fetchNavigationRoute([{ ...waypoints[0], label: "Chez Mme Martin" }, waypoints[1]]);
  assert.equal(route.durationSeconds, 180);
  assert.equal(await client.fetchNavigationRoute(waypoints), null, "second appel immédiat refusé");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "/api/maps/route");
  assert.deepEqual(JSON.parse(calls[0]!.body), { waypoints: [{ latitude: 48.856, longitude: 2.35 }, { latitude: 48.86, longitude: 2.36 }] }, "aucun libellé envoyé");
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
