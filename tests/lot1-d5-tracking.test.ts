import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { clearRouteCache, getDriverTracking, routeWaypoints, ROUTE_STOPS, STALE_AFTER_MS, type TrackingDb } from "../src/domains/round/driver-tracking.service";
import { HEARTBEAT_MS } from "../src/features/driver/use-driver-live-position";
import { companyNavItems } from "../src/features/navigation/nav-config";
import { effectivePermissions, miniAdminModules, withMiniAdminModules } from "../src/lib/permissions/mini-admin";
import { canOpenPage } from "../src/lib/permissions/page-access";
import { createMemoryDb } from "./helpers/memory-db";

/**
 * Lot 1, demande 5 — suivi des livreurs. Vérifications du document :
 * 1. pendant une tournée, le livreur se déplace sur la carte quand il roule ;
 * 2. le trajet va de sa position à ses 2 ou 3 prochains arrêts, dans l'ordre de la tournée ;
 * 3. un arrêt « Livré » passe dans les livrés (avec l'heure) et le trajet avance d'un arrêt ;
 * 4. tournée terminée : sa position n'est plus suivie.
 */

type Row = Record<string, unknown>;
const TODAY = new Date("2026-11-10T00:00:00.000Z");
const NOW = new Date("2026-11-10T06:30:00.000Z"); // 7h30 à Paris
const STARTED = new Date("2026-11-10T05:00:00.000Z");

function fixture() {
  clearRouteCache();
  const merchant = (id: string, latitude: number, longitude: number, companyId = "A") => ({
    id, companyId, name: `Client ${id}`, tradeName: null, address: `${id} rue`, postalCode: "75011", city: "Paris", latitude, longitude, accessInstructions: null, contactPhone: null,
  });
  const order = (id: string, merchantId: string, companyId = "A") => ({ id, companyId, reference: `C-${id}`, status: "LOCKED", merchantId });
  const stop = (id: string, roundId: string, orderId: string, sequence: number, extra: Row = {}) => ({
    id, companyId: "A", roundId, orderId, sequence, status: "PENDING", estimatedArrivalAt: null, deliveredAt: null,
    incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null, ...extra,
  });
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", timezone: "Europe/Paris", depotLatitude: 48.85, depotLongitude: 2.37 },
      { id: "B", timezone: "Europe/Paris", depotLatitude: 45.76, depotLongitude: 4.83 },
    ],
    slot: [{ id: "s6", companyId: "A", label: "Sud matin", startTime: "05:30", endTime: "11:00" }],
    user: [
      { id: "d1", companyId: "A", firstName: "Lina", lastName: "Livreuse" },
      { id: "d2", companyId: "A", firstName: "Paul", lastName: "Pas parti" },
      { id: "d3", companyId: "A", firstName: "Zoé", lastName: "Finie" },
      { id: "dB", companyId: "B", firstName: "Bruno", lastName: "Ailleurs" },
    ],
    round: [
      { id: "r1", companyId: "A", date: TODAY, name: "Tournée Sud matin", slotId: "s6", status: "IN_PROGRESS", driverId: "d1", startedAt: STARTED },
      { id: "r2", companyId: "A", date: TODAY, name: "Tournée Nord matin", slotId: "s6", status: "ASSIGNED", driverId: "d2", startedAt: null },
      { id: "r3", companyId: "A", date: TODAY, name: "Tournée Est matin", slotId: "s6", status: "COMPLETED", driverId: "d3", startedAt: STARTED },
      { id: "rB", companyId: "B", date: TODAY, name: "Tournée B", slotId: "sB", status: "IN_PROGRESS", driverId: "dB", startedAt: STARTED },
    ],
    merchant: [merchant("m1", 48.86, 2.35), merchant("m2", 48.87, 2.36), merchant("m3", 48.88, 2.37), merchant("m4", 48.89, 2.38), merchant("m5", 48.9, 2.39), merchant("mB", 45.75, 4.85, "B")],
    order: [order("o1", "m1"), order("o2", "m2"), order("o3", "m3"), order("o4", "m4"), order("o5", "m5"), order("oB", "mB", "B")],
    orderLine: [],
    // Ordre de la tournée volontairement différent de l'ordre de création.
    stop: [
      stop("st3", "r1", "o3", 3),
      stop("st1", "r1", "o1", 1),
      stop("st2", "r1", "o2", 2),
      stop("st4", "r1", "o4", 4),
      stop("st5", "r1", "o5", 5),
      { ...stop("stB", "rB", "oB", 1), companyId: "B" },
    ],
    driverLocation: [
      { driverId: "d1", companyId: "A", latitude: 48.851, longitude: 2.371, updatedAt: new Date("2026-11-10T06:29:40.000Z") },
      // Position d'avant le démarrage de sa tournée (ou d'une autre journée) : jamais montrée.
      { driverId: "d3", companyId: "A", latitude: 48.8, longitude: 2.3, updatedAt: new Date("2026-11-10T04:00:00.000Z") },
      { driverId: "dB", companyId: "B", latitude: 45.7, longitude: 4.8, updatedAt: NOW },
    ],
  };
  const calls: Array<Array<{ latitude: number; longitude: number }>> = [];
  const fetchRoute = async (waypoints: Array<{ latitude: number; longitude: number }>) => {
    calls.push(waypoints);
    return { polyline: waypoints.map((point) => [point.latitude, point.longitude] as [number, number]).concat([[0, 0]]) };
  };
  return { tables, db: createMemoryDb(tables) as unknown as TrackingDb, calls, fetchRoute };
}

test("LOT1-D5 : seuls les livreurs en tournée démarrée du jour sont suivis, entreprise bornée", async () => {
  const { db, fetchRoute } = fixture();
  const tracking = await getDriverTracking("A", { now: NOW, db, fetchRoute });
  assert.deepEqual(tracking.drivers.map((driver) => driver.driverName), ["Lina Livreuse"], "ni tournée non démarrée, ni terminée, ni autre entreprise");
  const lina = tracking.drivers[0]!;
  assert.equal(lina.remainingCount, 5);
  assert.deepEqual(lina.nextStops.map((stop) => stop.merchantName), ["Client m1", "Client m2", "Client m3", "Client m4", "Client m5"], "ordre de la tournée");
  assert.deepEqual(tracking.depot, { latitude: 48.85, longitude: 2.37 });
});

test("LOT1-D5 vérification 1 : le livreur se déplace sur la carte quand il roule", async () => {
  const { tables, db, fetchRoute } = fixture();
  const first = (await getDriverTracking("A", { now: NOW, db, fetchRoute })).drivers[0]!;
  assert.deepEqual([first.position?.latitude, first.position?.longitude, first.position?.stale], [48.851, 2.371, false]);
  // Nouvelle position envoyée par le téléphone (au moins toutes les 30 s).
  Object.assign(tables.driverLocation![0]!, { latitude: 48.858, longitude: 2.349, updatedAt: new Date("2026-11-10T06:30:10.000Z") });
  const later = (await getDriverTracking("A", { now: new Date("2026-11-10T06:30:15.000Z"), db, fetchRoute })).drivers[0]!;
  assert.deepEqual([later.position?.latitude, later.position?.longitude], [48.858, 2.349]);
  assert.equal(later.route.waypoints[0]?.latitude, 48.858, "le trajet part de la nouvelle position");
  assert.ok(HEARTBEAT_MS <= 30_000, "le téléphone renvoie sa position au moins toutes les 30 s");
});

test("LOT1-D5 vérification 2 : trajet de sa position à ses 3 prochains arrêts, dans l'ordre", async () => {
  const { db, calls, fetchRoute } = fixture();
  const lina = (await getDriverTracking("A", { now: NOW, db, fetchRoute })).drivers[0]!;
  assert.equal(ROUTE_STOPS, 3);
  assert.equal(lina.route.from, "driver");
  assert.deepEqual(lina.route.waypoints.map((point) => point.label ?? "position"), ["position", "Client m1", "Client m2", "Client m3"]);
  assert.deepEqual(calls[0]?.map((point) => point.latitude), [48.851, 48.86, 48.87, 48.88], "itinéraire demandé au serveur");
  assert.equal(lina.route.approximate, false);
  assert.equal(lina.route.polyline?.length, 5);
  // Itinéraire indisponible : segments droits, marqués approximatifs.
  const { db: db2 } = fixture();
  const fallback = (await getDriverTracking("A", { now: new Date("2026-11-10T06:31:00.000Z"), db: db2, fetchRoute: async () => null })).drivers[0]!;
  assert.equal(fallback.route.approximate, true);
  assert.deepEqual(fallback.route.polyline, [[48.851, 2.371], [48.86, 2.35], [48.87, 2.36], [48.88, 2.37]]);
  // Pas encore de position : le trajet part du laboratoire.
  assert.deepEqual(routeWaypoints(null, lina.nextStops), []);
});

test("LOT1-D5 vérification 3 : un arrêt « Livré » passe dans les livrés et le trajet avance d'un arrêt", async () => {
  const { tables, db, fetchRoute } = fixture();
  Object.assign(tables.stop!.find((row) => row.id === "st1")!, { status: "DELIVERED", deliveredAt: new Date("2026-11-10T06:20:00.000Z") });
  Object.assign(tables.stop!.find((row) => row.id === "st2")!, { status: "INCIDENT", incidentAt: new Date("2026-11-10T06:25:00.000Z"), incidentCode: "CLOSED" });
  const lina = (await getDriverTracking("A", { now: NOW, db, fetchRoute })).drivers[0]!;
  assert.deepEqual(lina.delivered.map((stop) => [stop.merchantName, stop.deliveredAt]), [["Client m1", "2026-11-10T06:20:00.000Z"]]);
  assert.deepEqual(lina.incidents.map((stop) => stop.merchantName), ["Client m2"]);
  assert.equal(lina.remainingCount, 3);
  assert.deepEqual(lina.route.waypoints.slice(1).map((point) => point.label), ["Client m3", "Client m4", "Client m5"]);
});

test("LOT1-D5 : réseau perdu → dernière position connue et son heure", async () => {
  const { db, fetchRoute } = fixture();
  const later = new Date(new Date("2026-11-10T06:29:40.000Z").getTime() + STALE_AFTER_MS + 1_000);
  const lina = (await getDriverTracking("A", { now: later, db, fetchRoute })).drivers[0]!;
  assert.equal(lina.position?.stale, true);
  assert.equal(lina.position?.updatedAt, "2026-11-10T06:29:40.000Z");
});

test("LOT1-D5 vérification 4 : tournée terminée → position plus suivie (ni affichée, ni enregistrée, effacée)", async () => {
  const { tables, db, fetchRoute } = fixture();
  Object.assign(tables.round![0]!, { status: "COMPLETED" });
  assert.equal((await getDriverTracking("A", { now: NOW, db, fetchRoute })).drivers.length, 0);
  // Côté serveur : aucune position écrite sans tournée démarrée, position effacée à la fin de la tournée.
  const location = readFileSync("src/domains/driver/driver-location.service.ts", "utf8");
  assert.match(location, /status: "IN_PROGRESS"/);
  assert.match(location, /Aucune tournée démarrée : position non enregistrée/);
  const driver = readFileSync("src/domains/round/round-driver.service.ts", "utf8");
  assert.match(driver, /if \(!other\) await tx\.driverLocation\.deleteMany\(\{ where: \{ driverId: actor\.userId \} \}\)/);
  // Côté téléphone : suivi actif seulement pendant une tournée démarrée.
  assert.match(readFileSync("src/features/driver/round/driver-round-content.tsx", "utf8"), /const tracking = driverLocationAllowed\(/);
});

test("LOT1-D5 : onglet « Suivi livreurs » réservé à la fonctionnalité accordée (administrateur, mini admin)", () => {
  assert.ok(companyNavItems.some((item) => item.title === "Suivi livreurs" && item.href === "/dashboard/tracking"));
  const subject = (modules: string[] | null) => {
    const settings = modules ? withMiniAdminModules({}, modules) : {};
    const granted = miniAdminModules({ settings, role: { systemRole: "ADMIN" } });
    return { role: "ADMIN" as const, permissions: effectivePermissions([...ROLE_PERMISSIONS.ADMIN], granted), modules: granted };
  };
  assert.equal(canOpenPage("/dashboard/tracking", subject(null)), true);
  assert.equal(canOpenPage("/dashboard/tracking", subject(["tracking"])), true);
  assert.equal(canOpenPage("/dashboard/tracking", subject(["orders"])), false);
  assert.match(readFileSync("src/app/api/tracking/route.ts", "utf8"), /requireCompanyAdmin\("tracking:read"\)/);
});
