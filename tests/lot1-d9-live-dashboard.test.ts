/**
 * LOT1-D9 — tableau de bord de l'administrateur (ADM-04, ADM-08) plus rapide : deux vagues de lectures en
 * parallèle au lieu de quatre à la suite. L'entreprise vient du compte connecté ; lignes et commerces des
 * commandes du jour sont lus avec les arrêts. Le contenu affiché ne change pas.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getLiveDashboard, liveCompanyFrom, type LiveDb } from "../src/domains/round/round-live.service";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const J = "2026-11-10";
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
/** 10 novembre 2026, 8 h à Paris. */
const NOW = new Date("2026-11-10T07:00:00.000Z");
const STARTED = new Date("2026-11-10T05:00:00.000Z");

const merchant = (id: string, companyId: string, name: string) => ({
  id, companyId, name, tradeName: null, address: `${id} rue de Test`, postalCode: "75011", city: "Paris",
  latitude: 48.86, longitude: 2.37, accessInstructions: null, contactPhone: null, active: true,
});
const order = (id: string, companyId: string, merchantId: string, status = "LOCKED") => ({
  id, companyId, merchantId, reference: `C-${id}`, deliveryDate: day(J), slotId: "s6", status, origin: "MANUAL", deliveredAt: null,
});
const line = (id: string, orderId: string, quantityOrdered: number, companyId = "A") => ({
  id, companyId, orderId, productId: "baguette", quantityOrdered, quantityDelivered: null,
});
const stop = (id: string, roundId: string, orderId: string, sequence: number, extra: Row = {}) => ({
  id, companyId: "A", roundId, orderId, sequence, status: "PENDING", estimatedArrivalAt: null, deliveredAt: null,
  incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null, createdAt: new Date(0), ...extra,
});

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", depotLatitude: 48.8547, depotLongitude: 2.3725 },
      { id: "B", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", depotLatitude: null, depotLongitude: null },
    ],
    user: [
      { id: "driver1", companyId: "A", firstName: "Mathis", lastName: "Livreur" },
      { id: "driverB", companyId: "B", firstName: "Bea", lastName: "Livreur" },
    ],
    merchant: [merchant("M1", "A", "Café Un"), merchant("M2", "A", "Bistrot Deux"), merchant("M3", "A", "Sans tournée"), merchant("MB", "B", "Hôtel B")],
    slot: [{ id: "s6", companyId: "A", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 }],
    // o3 : commande du jour sans arrêt (brouillon) ; oB : autre entreprise.
    order: [order("o1", "A", "M1"), order("o2", "A", "M2"), order("o3", "A", "M3", "DRAFT"), order("oB", "B", "MB")],
    orderLine: [line("l1", "o1", 30), line("l2", "o2", 15), line("l3", "o3", 4), line("lB", "oB", 3, "B")],
    round: [
      { id: "rA", companyId: "A", date: day(J), slotId: "s6", name: "Tournée A", status: "IN_PROGRESS", driverId: "driver1", startedAt: STARTED, completedAt: null, createdAt: new Date(0) },
      { id: "rX", companyId: "B", date: day(J), slotId: "sB", name: "Tournée B", status: "DRAFT", driverId: "driverB", startedAt: null, completedAt: null, createdAt: new Date(0) },
    ],
    stop: [
      stop("st1", "rA", "o1", 1, { status: "DELIVERED", deliveredAt: new Date("2026-11-10T05:30:00.000Z") }),
      stop("st2", "rA", "o2", 2, { status: "INCIDENT", incidentCode: "CLOSED", incidentAt: new Date("2026-11-10T06:00:00.000Z") }),
      { ...stop("stB", "rX", "oB", 1), companyId: "B" },
    ],
    driverLocation: [
      { driverId: "driver1", companyId: "A", latitude: 48.861, longitude: 2.371, updatedAt: new Date("2026-11-10T06:30:00.000Z") },
    ],
  };
  return createMemoryDb(tables) as unknown as LiveDb;
}

/** Compte les vagues de lectures : une vague = des lectures lancées pendant qu'une autre est encore en cours. */
function traced(db: LiveDb) {
  const calls: string[] = [];
  let pending = 0;
  let waves = 0;
  const wrap = (model: string, target: Record<string, unknown>) =>
    new Proxy(target, {
      get(object, method) {
        const value = Reflect.get(object, method);
        if (typeof value !== "function") return value;
        return (...args: unknown[]) => {
          if (pending === 0) waves += 1;
          pending += 1;
          calls.push(`${model}.${String(method)}`);
          return Promise.resolve(value.apply(object, args)).finally(() => {
            pending -= 1;
          });
        };
      },
    });
  const proxy = new Proxy(db as unknown as Record<string, Record<string, unknown>>, {
    get: (object, model) => wrap(String(model), Reflect.get(object, model)),
  }) as unknown as LiveDb;
  return { db: proxy, calls, waves: () => waves };
}

const COMPANY_A = { id: "A", timezone: "Europe/Paris", depotLatitude: 48.8547, depotLongitude: 2.3725 };

test("LOT1-D9 tableau de bord : entreprise du compte connecté → deux vagues de lectures, sans relire l'entreprise", async () => {
  const run = traced(fixture());
  const live = await getLiveDashboard("A", { db: run.db, now: NOW, company: COMPANY_A });
  assert.equal(run.waves(), 2);
  assert.ok(!run.calls.includes("company.findUnique"));
  // Lignes et commerces lus une seule fois, avec les arrêts.
  assert.equal(run.calls.filter((call) => call === "orderLine.findMany").length, 1);
  assert.equal(run.calls.filter((call) => call === "merchant.findMany").length, 1);
  assert.deepEqual(live.depot, { latitude: 48.8547, longitude: 2.3725 });
});

test("LOT1-D9 tableau de bord : même contenu qu'en relisant l'entreprise (ADM-04, ADM-08, ENF-04)", async () => {
  const fast = await getLiveDashboard("A", { db: fixture(), now: NOW, company: COMPANY_A });
  const slowRun = traced(fixture());
  const slow = await getLiveDashboard("A", { db: slowRun.db, now: NOW });
  assert.equal(slowRun.waves(), 3);
  assert.deepEqual(fast, slow);
  const round = fast.rounds[0]!;
  assert.deepEqual(round.stops.map((row) => row.merchantName), ["Café Un", "Bistrot Deux"]);
  assert.equal(round.driverName, "Mathis Livreur");
  assert.ok(round.driverPosition, "position montrée pendant la tournée, reçue après son démarrage");
  assert.deepEqual(fast.incidents.map((row) => row.merchantName), ["Bistrot Deux"]);
  assert.deepEqual(fast.totals, { rounds: 1, inProgress: 1, completed: 0, stops: 2, delivered: 1, incidents: 1, remaining: 0 });
  assert.equal(fast.orders.total, 2);
});

test("LOT1-D9 tableau de bord : une entreprise fournie qui n'est pas la bonne est ignorée (isolation)", async () => {
  const run = traced(fixture());
  const live = await getLiveDashboard("A", { db: run.db, now: NOW, company: { ...COMPANY_A, id: "B", depotLatitude: 1, depotLongitude: 1 } });
  assert.ok(run.calls.includes("company.findUnique"));
  assert.deepEqual(live.depot, { latitude: 48.8547, longitude: 2.3725 });
  assert.ok(!JSON.stringify(live).includes("Hôtel B"));
});

test("LOT1-D9 tableau de bord : aucune tournée → une seule vague après l'entreprise, ni lignes ni commerces lus", async () => {
  const run = traced(fixture());
  const live = await getLiveDashboard("A", { db: run.db, now: new Date("2026-11-12T07:00:00.000Z"), company: COMPANY_A });
  assert.equal(live.rounds.length, 0);
  assert.ok(!run.calls.includes("orderLine.findMany"));
  assert.ok(!run.calls.includes("merchant.findMany"));
});

test("LOT1-D9 liveCompanyFrom : entreprise du garde acceptée seulement complète et bien typée", () => {
  assert.deepEqual(liveCompanyFrom({ ...COMPANY_A, name: "Boulangerie", status: "ACTIVE" }), COMPANY_A);
  assert.deepEqual(liveCompanyFrom({ ...COMPANY_A, depotLatitude: null, depotLongitude: null }), { ...COMPANY_A, depotLatitude: null, depotLongitude: null });
  assert.equal(liveCompanyFrom(null), null);
  assert.equal(liveCompanyFrom(undefined), null);
  assert.equal(liveCompanyFrom({ ...COMPANY_A, timezone: undefined }), null);
  assert.equal(liveCompanyFrom({ ...COMPANY_A, timezone: "" }), null);
  assert.equal(liveCompanyFrom({ ...COMPANY_A, depotLatitude: "48.85" }), null);
  assert.equal(liveCompanyFrom({ ...COMPANY_A, depotLongitude: undefined }), null);
});
