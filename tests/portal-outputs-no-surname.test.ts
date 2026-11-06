import assert from "node:assert/strict";
import test from "node:test";
import { getClientOrderById } from "../src/domains/order/order.service";
import { getClientDeliveryById } from "../src/domains/delivery/delivery.service";
import { getClientDeliveriesMap, getDispatchMapDeliveries } from "../src/domains/delivery/dispatch-map.service";
import { getSupportContactsForClient } from "../src/domains/client-portal/support-contacts.service";
import { getOrderTracking } from "../src/domains/tracking/tracking.service";
import type { OrderActor } from "../src/domains/order/order-access";
import { redactClientTimeline } from "../src/domains/delivery/client-driver";
import { prisma } from "../src/services/prisma/client";

// C2 : un livreur « Karim Benali » et des événements qui citent son nom complet (et celui d'un ancien livreur).
const DRIVER = { firstName: "Karim", lastName: "Benali", phone: "+33611223344" };
const NOW = new Date("2026-10-29T08:00:00Z");
const EVENTS = [
  { id: "e1", label: "Information", description: "Karim Benali a confirmé la prise en charge", occurredAt: NOW, latitude: null, longitude: null },
  { id: "e2", label: "Prise en charge confirmée", description: "Livreur Karim Benali a confirmé la prise en charge, avant le départ.", occurredAt: NOW, latitude: null, longitude: null },
  { id: "e3", label: "Livreur réassigné", description: "Livreur Awa Diallo → Livreur Karim Benali", occurredAt: NOW, latitude: null, longitude: null },
  // C3 : anciens livreurs (particule, inactif, trait d'union, majuscules), hors des libellés connus.
  { id: "e4", label: "Assignée automatiquement", description: "Livraison confiée à Livreur Jean de La Fontaine — choix automatique", occurredAt: NOW, latitude: null, longitude: null },
  { id: "e5", label: "Information", description: "Relais prévu : le livreur jean de la fontaine passe le colis à MARIE-CLAIRE DUPONT-MARTIN", occurredAt: NOW, latitude: null, longitude: null },
];

function stub(t: import("node:test").TestContext, delegate: object, key: string, fn: unknown) {
  const target = delegate as Record<string, unknown>;
  const original = target[key];
  target[key] = fn;
  t.after(() => { target[key] = original; });
}
const pick = (row: Record<string, unknown>, select?: Record<string, unknown>) =>
  select ? Object.fromEntries(Object.entries(select).filter(([, on]) => on).map(([k]) => [k, row[k]])) : row;
type Args = { include?: { driver?: { select?: Record<string, unknown> }; order?: { include?: unknown } }; select?: { driver?: { select?: Record<string, unknown> } } };

function delivery(args: Args) {
  return {
    id: "d1", reference: "LIV-1", status: "IN_DELIVERY", companyId: "company-a", customerId: "client-a", deliveryCategory: "STANDARD",
    address: "1 rue A", city: "Paris", postalCode: "75001", pickupAddress: null, pickupCity: null, pickupPostalCode: null,
    latitude: 48.85, longitude: 2.35, pickupLatitude: null, pickupLongitude: null, estimatedArrival: null,
    driverId: "drv1", driverName: "Karim Benali", missionStartedAt: NOW, missionAcceptedAt: NOW, completedAt: null, createdAt: NOW, updatedAt: NOW,
    driver: pick(DRIVER, (args.include ?? args.select)?.driver?.select), trackingEvents: EVENTS,
    customer: { firstName: "Cli", lastName: "Ent" },
    order: { id: "o1", reference: "CMD-1", requestedDeliveryDate: null, customerEmail: null, customer: { firstName: "Cli", lastName: "Ent" }, items: [], stops: [] },
  };
}

type OrderArgs = { select?: unknown; include?: { deliveries?: { include?: Args["include"] } } };
function order(args: OrderArgs) {
  const base = { id: "o1", reference: "CMD-1", status: "IN_DELIVERY", deliveryCategory: "STANDARD", companyId: "company-a", customerId: "client-a", updatedAt: NOW };
  // Suivi partagé (select), fiche commande du portail (include.deliveries.include), échanges (include simple).
  if (args.select) return { ...base, company: { settings: {} }, stops: [], deliveries: [delivery({ select: { driver: { select: { companyId: true } } } })] };
  if (args.include?.deliveries?.include) {
    return { ...base, items: [], stops: [], invoices: [], company: { name: "Acme" }, deliveries: [delivery({ include: args.include.deliveries.include })] };
  }
  return { ...base, deliveries: [{ id: "d1", status: "IN_DELIVERY", completedAt: null, companyId: "company-a", driverId: "drv1", updatedAt: NOW }] };
}

// Livreurs de l'entreprise, y compris un inactif : tous sont masqués côté client.
const COMPANY_DRIVERS = [
  { firstName: "Karim", lastName: "Benali", status: "ACTIVE" },
  { firstName: "Jean", lastName: "de La Fontaine", status: "INACTIVE" },
  { firstName: "Marie-Claire", lastName: "Dupont-Martin", status: "ACTIVE" },
  { firstName: "Awa", lastName: "Diallo", status: "INACTIVE" },
];
const driverQueries: Array<{ where?: Record<string, unknown> }> = [];

function stubDatabase(t: import("node:test").TestContext, settings: Record<string, unknown>) {
  driverQueries.length = 0;
  stub(t, prisma.user, "findMany", async (args: { where?: Record<string, unknown> }) => {
    driverQueries.push(args);
    return COMPANY_DRIVERS.map(({ firstName, lastName }) => ({ firstName, lastName }));
  });
  stub(t, prisma.company, "findUnique", async (args: { select?: Record<string, unknown> }) =>
    args.select?.users ? { name: "Acme", email: null, phone: null, users: [], settings } : { settings });
  stub(t, prisma.order, "findFirst", async (args: OrderArgs) => order(args));
  stub(t, prisma.delivery, "findFirst", async (args: Args) => (args.include?.order?.include ? null : delivery(args)));
  stub(t, prisma.delivery, "findMany", async () => [delivery({})]);
  stub(t, prisma, "$transaction", async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
}

const client: OrderActor = { id: "client-a", companyId: "company-a", role: "CLIENT", permissions: ["dashboard:client"], name: "Cli Ent" };
const admin: OrderActor = { id: "admin-a", companyId: "company-a", role: "COMPANY_ADMIN", permissions: ["orders:read", "deliveries:read"], name: "Ad Min" };

for (const [label, settings] of [["téléphone visible", {}], ["téléphone masqué", { portalShowDriverPhone: false }]] as const) {
  test(`C2 : aucune sortie client n'expose le nom de famille du livreur (${label})`, async (t) => {
    stubDatabase(t, settings);
    const outputs: Record<string, unknown> = {
      "portal/orders/[id]": await getClientOrderById("client-a", "company-a", "o1"),
      "portal/deliveries/[id]": await getClientDeliveryById("client-a", "company-a", "d1"),
      "portal/deliveries/map": await getClientDeliveriesMap("client-a", "company-a"),
      "portal/support/contacts": await getSupportContactsForClient("client-a", "company-a", "d1"),
      "tracking/[id] (suivi partagé)": await getOrderTracking(client, "o1"),
    };
    for (const [name, output] of Object.entries(outputs)) {
      const json = JSON.stringify(output);
      assert.equal(json.includes("Benali"), false, `${name} expose le nom de famille`);
      assert.equal(json.includes("Diallo"), false, `${name} expose le nom d'un autre livreur`);
      for (const surname of ["Fontaine", "FONTAINE", "fontaine", "DUPONT", "Dupont", "MARTIN"]) {
        assert.equal(json.includes(surname), false, `${name} expose « ${surname} » (ancien livreur)`);
      }
      const phoneExpected = label === "téléphone visible" && /orders\/\[id\]|deliveries\/\[id\]|support/.test(name);
      assert.equal(json.includes("33611223344"), phoneExpected, `${name} : téléphone selon le réglage`);
    }
    const clientOrder = outputs["portal/orders/[id]"] as { deliveries: Array<Record<string, unknown>> };
    assert.equal("driverName" in clientOrder.deliveries[0]!, false);
    assert.deepEqual(clientOrder.deliveries[0]!.driver, label === "téléphone visible" ? { firstName: "Karim", phone: "+33611223344" } : { firstName: "Karim" });
    const steps = (outputs["portal/deliveries/map"] as { active: Array<{ trackingSteps: Array<{ description: string | null }> }> }).active[0]!.trackingSteps;
    assert.equal(steps[0]!.description, "Karim a confirmé la prise en charge");
    assert.equal(steps[4]!.description, "Relais prévu : le livreur Jean passe le colis à Marie-Claire");
    // Noms des livreurs de l'entreprise, inactifs compris, limités à l'entreprise.
    assert.ok(driverQueries.length > 0);
    for (const query of driverQueries) {
      assert.equal(query.where?.companyId, "company-a");
      assert.equal("status" in (query.where ?? {}), false, "inactifs compris");
    }
  });
}

test("C2 : le back-office garde le nom complet (suivi, carte de dispatch)", async (t) => {
  stubDatabase(t, {});
  const tracking = JSON.stringify(await getOrderTracking(admin, "o1"));
  assert.ok(tracking.includes("Karim Benali a confirmé la prise en charge"));
  const dispatch = await getDispatchMapDeliveries("company-a");
  assert.equal(dispatch.deliveries[0]!.trackingSteps[0]!.description, "Karim Benali a confirmé la prise en charge");
});

test("C2 : chronologie client — nom complet connu réduit au prénom, insensible à la casse, sans toucher le reste", () => {
  const events = [
    { label: "Information", description: "KARIM BENALI est en route" },
    { label: "Livraison", description: "1 rue Benali-Martin, Paris" },
  ];
  const redacted = redactClientTimeline(events, ["Livreur Karim Benali"]);
  assert.equal(redacted[0]!.description, "Karim est en route");
  // Un nom de famille seul n'est pas un nom complet : une adresse n'est pas altérée.
  assert.equal(redacted[1]!.description, "1 rue Benali-Martin, Paris");
});

test("C3 : libellé d'affectation automatique vidé côté client (reproduction Codex)", () => {
  const [event] = redactClientTimeline(
    [{ label: "Assignée automatiquement", description: "Livraison confiée à Livreur Jean de La Fontaine — choix automatique" }],
    ["Livreur Karim Benali"]
  );
  assert.equal(event!.description, null);
});

test("C3 : filet « Livreur <Nom…> » jusqu'à la ponctuation ou au tiret, particules comprises, premier mot gardé", () => {
  const cases: Array<[string, string]> = [
    ["Livraison confiée à Livreur Jean de La Fontaine — choix automatique", "Livraison confiée à Livreur Jean — choix automatique"],
    ["Livreur Jean-Pierre d'Arc, en route", "Livreur Jean-Pierre, en route"],
    ["Livreur Anne van der Berg - retard signalé", "Livreur Anne - retard signalé"],
    ["Mission annulée — Livreur Paul du Pont — client absent", "Mission annulée — Livreur Paul — client absent"],
    ["Livreur Awa Diallo → Livreur Karim Benali", "Livreur Awa → Livreur Karim"],
    ["Pris en charge par Livreur LUC VON STEIN.", "Pris en charge par Livreur LUC."],
  ];
  for (const [description, expected] of cases) {
    assert.equal(redactClientTimeline([{ label: "Information", description }])[0]!.description, expected, description);
  }
});
