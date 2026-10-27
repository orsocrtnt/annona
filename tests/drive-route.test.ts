import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as config from "../src/lib/maps/provider-config";
import * as routeProgress from "../src/lib/maps/route-progress";
import { slicePath, buildRouteTrack } from "../src/lib/maps/route-progress";

function moduleAt(path: string, deps: Record<string, unknown>) {
  const exportsObject = {};
  const sandbox = { module: { exports: exportsObject }, exports: exportsObject, Date, Math, Error, Map, Set, Promise, setTimeout, clearTimeout, Number, console, process: { env: {} }, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } };
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return sandbox.module.exports as any;
}

// Rue droite de ≈ 1 112 m vers le nord ; un grand carrefour à mi-chemin.
const from = { latitude: 48.85, longitude: 2.35 }, target = { latitude: 48.86, longitude: 2.35 };
const route = { points: [[48.85, 2.35], [48.855, 2.35], [48.86, 2.35]], lights: [[48.855, 2.35]] };
function loadRoutes(fetchDriveRoute: (...args: any[]) => Promise<any>) {
  const calls: any[] = [];
  const service = moduleAt("src/domains/tracking/drive-route.service.ts", {
    "@/lib/maps/drive-route-provider": { fetchDriveRoute: async (...args: any[]) => { calls.push(args); return fetchDriveRoute(...args); } },
    "@/lib/maps/route-progress": routeProgress,
  });
  return { service, calls };
}

test("itinéraire serveur : un appel, puis réutilisé tant que le livreur reste sur la route", async () => {
  const { service, calls } = loadRoutes(async () => route);
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value)); // objets du bac à sable comparables
  const first = plain(await service.getDriveRoute("driver", from, target));
  assert.equal(calls.length, 1);
  assert.deepEqual(first.points[0], [48.85, 2.35]);
  assert.equal(first.lights.length, 1);
  const further = plain(await service.getDriveRoute("driver", { latitude: 48.857, longitude: 2.3501 }, target));
  assert.equal(calls.length, 1, "relevé sur la route : aucun nouvel appel");
  assert.deepEqual(further.points[0], [48.857, 2.35], "repart de la projection du relevé sur la route");
  assert.equal(further.lights.length, 0, "carrefour déjà franchi retiré");
});

test("itinéraire serveur : recalculé si le livreur quitte la route ou change de cible", async () => {
  const { service, calls } = loadRoutes(async () => route);
  await service.getDriveRoute("driver", from, target);
  await service.getDriveRoute("driver", { latitude: 48.855, longitude: 2.352 }, target, 3000); // ≈ 147 m à l'est
  assert.equal(calls.length, 2);
  await service.getDriveRoute("driver", from, { latitude: 48.87, longitude: 2.36 }, 3000);
  assert.equal(calls.length, 3);
});

test("itinéraire serveur : lectures simultanées regroupées, attente bornée puis servi à la lecture suivante", async () => {
  let release!: () => void;
  const { service, calls } = loadRoutes(() => new Promise((resolve) => { release = () => resolve(route); }));
  const [a, b] = await Promise.all([service.getDriveRoute("driver", from, target, 30), service.getDriveRoute("driver", from, target, 30)]);
  assert.equal(calls.length, 1, "un seul appel pour deux lectures");
  assert.equal(a, null); assert.equal(b, null, "pas prêt dans le budget : le livreur reste à son dernier point");
  release();
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(await service.getDriveRoute("driver", from, target, 30), "prêt à la lecture suivante");
  assert.equal(calls.length, 1);
});

test("itinéraire serveur : échec des fournisseurs, pas de nouvel essai avant 30 s", async () => {
  const { service, calls } = loadRoutes(async () => null);
  assert.equal(await service.getDriveRoute("driver", from, target), null);
  assert.equal(await service.getDriveRoute("driver", from, target), null);
  assert.equal(calls.length, 1);
});

function loadProvider(responses: Record<string, unknown>) {
  const urls: string[] = [];
  const provider = moduleAt("src/lib/maps/drive-route-provider.ts", {
    "@/lib/maps/provider-config": config,
    "@/lib/maps/provider-request": { fetchProviderJson: async (url: string) => { urls.push(url); const key = Object.keys(responses).find((k) => url.includes(k)); const response = key === undefined ? undefined : responses[key]; if (response === undefined || response instanceof Error) throw response ?? new Error("HTTP 503"); return response; } },
  });
  return { provider, urls };
}

test("fournisseur : OSRM avec grands carrefours (au moins quatre branches)", async () => {
  const osrm = { code: "Ok", routes: [{ geometry: { coordinates: [[2.35, 48.85], [2.35, 48.86]] }, legs: [{ steps: [{ intersections: [{ location: [2.35, 48.852], bearings: [0, 90, 180] }, { location: [2.35, 48.855], bearings: [0, 90, 180, 270] }] }] }] }] };
  const { provider, urls } = loadProvider({ "/route/v1/driving/": osrm });
  const result = JSON.parse(JSON.stringify(await provider.fetchDriveRoute(from, target)));
  assert.deepEqual(result.points, [[48.85, 2.35], [48.86, 2.35]]);
  assert.deepEqual(result.lights, [[48.855, 2.35]], "le carrefour à trois branches n'a pas de feu");
  assert.equal(urls.length, 1);
});

test("fournisseur : OSRM indisponible, secours IGN ; tous indisponibles, null (jamais de ligne droite)", async () => {
  const ign = { geometry: { coordinates: [[2.35, 48.85], [2.351, 48.855], [2.35, 48.86]] }, distance: 1200 };
  const { provider, urls } = loadProvider({ "/route/v1/driving/": new Error("HTTP 429"), "navigation/itineraire": ign });
  const result = JSON.parse(JSON.stringify(await provider.fetchDriveRoute(from, target)));
  assert.equal(result.points.length, 3); assert.deepEqual(result.lights, []);
  assert.match(urls[1]!, /resource=bdtopo-valhalla/);
  const none = loadProvider({});
  assert.equal(await none.provider.fetchDriveRoute(from, target), null);
  const invalid = loadProvider({ "/route/v1/driving/": { code: "Ok", routes: [{ geometry: { coordinates: [[2.35, 948.85], [2.35, 48.86]] } }] } });
  assert.equal(await invalid.provider.fetchDriveRoute(from, target), null, "coordonnée invalide refusée");
});

test("tronçon de route entre deux distances", () => {
  const track = buildRouteTrack([[48.85, 2.35], [48.86, 2.35], [48.86, 2.36]]);
  const middle = slicePath(track, 100, track.cumulative[1]! + 100);
  assert.equal(middle.length, 3, "départ, angle, arrivée");
  assert.deepEqual(middle[1], [48.86, 2.35]);
  assert.ok(Math.abs(buildRouteTrack(middle).length - track.cumulative[1]!) < 0.5);
});
