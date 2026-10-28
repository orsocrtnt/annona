import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { getClientDeliveryById } from "../src/domains/delivery/delivery.service";
import { getSupportContactsForClient } from "../src/domains/client-portal/support-contacts.service";
import { prisma } from "../src/services/prisma/client";

const DRIVER = { firstName: "Karim", lastName: "Benali", phone: "+33611223344" };

// Noms des livreurs de l'entreprise (masquage C3) : aucun ici, sans base.
const userDelegate = prisma.user as unknown as Record<string, unknown>;
const originalUserFindMany = userDelegate.findMany;
before(() => { userDelegate.findMany = async () => []; });
after(() => { userDelegate.findMany = originalUserFindMany; });

/** Simule Prisma : applique le `select` demandé sur la ligne complète, comme la vraie base. */
function pick(row: Record<string, unknown>, select: Record<string, unknown> | undefined) {
  if (!select) return row;
  return Object.fromEntries(Object.entries(select).filter(([, on]) => on).map(([key]) => [key, row[key]]));
}

/** Remplace une méthode du delegate Prisma (assignation directe, comme les autres tests) et la restaure. */
function stub(t: import("node:test").TestContext, delegate: object, key: string, fn: unknown) {
  const target = delegate as Record<string, unknown>;
  const original = target[key];
  target[key] = fn;
  t.after(() => { target[key] = original; });
}

function mockPortal(t: import("node:test").TestContext, settings: unknown, sentWhere: unknown[] = []) {
  stub(t, prisma.company, "findUnique", async () => ({ settings }));
  stub(t, prisma.delivery, "findFirst", async (args: { where: Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown> }) => {
    // Lecture de réparation (courier) : sans objet ici.
    if ((args.include?.order as { include?: unknown } | undefined)?.include) return null;
    sentWhere.push(args.where);
    if (args.where.customerId !== "client-a" || args.where.companyId !== "company-a") return null;
    const driverSelect = (args.include?.driver as { select?: Record<string, unknown> } | undefined)?.select;
    return {
      id: "d1", reference: "LIV-1", status: "IN_DELIVERY", driverId: "drv1", driverName: "Karim Benali",
      driver: pick(DRIVER, driverSelect), order: { reference: "CMD-1", requestedDeliveryDate: null },
      trackingEvents: [],
    };
  });
  return sentWhere;
}

test("I2 : réglage par défaut → prénom et téléphone, jamais le nom de famille", async (t) => {
  mockPortal(t, {});
  const delivery = (await getClientDeliveryById("client-a", "company-a", "d1")) as unknown as Record<string, unknown>;
  assert.deepEqual(delivery.driver, { firstName: "Karim", phone: "+33611223344" });
  assert.equal(JSON.stringify(delivery).includes("Benali"), false, "aucun nom de famille dans la sortie");
  assert.equal("driverName" in delivery, false, "le nom complet stocké n'est pas renvoyé");
});

test("I2 : réglage désactivé → prénom seul, téléphone absent de la requête et de la sortie", async (t) => {
  mockPortal(t, { portalShowDriverPhone: false, dispatch: { x: 1 } });
  const queries: Array<{ include?: { driver?: unknown } }> = [];
  const inner = prisma.delivery.findFirst as unknown as (args: { include?: { driver?: unknown } }) => Promise<unknown>;
  stub(t, prisma.delivery, "findFirst", async (args: { include?: { driver?: unknown } }) => { queries.push(args); return inner(args); });
  const delivery = (await getClientDeliveryById("client-a", "company-a", "d1")) as unknown as Record<string, unknown>;
  assert.deepEqual(delivery.driver, { firstName: "Karim" });
  assert.equal(JSON.stringify(delivery).includes("33611223344"), false);
  assert.equal(JSON.stringify(delivery).includes("Benali"), false);
  const queried = queries.find((args) => args.include?.driver);
  assert.equal(JSON.stringify(queried?.include?.driver).includes("phone"), false, "masqué dans la requête, pas seulement l'interface");
  assert.equal(JSON.stringify(queried?.include?.driver).includes("lastName"), false);
});

test("I2 : client d'une autre entreprise ou d'un autre compte → refus (null) comme avant", async (t) => {
  const where = mockPortal(t, {});
  assert.equal(await getClientDeliveryById("client-b", "company-a", "d1"), null);
  assert.equal(await getClientDeliveryById("client-a", "company-z", "d1"), null);
  assert.deepEqual(where.map((w) => (w as { customerId: string }).customerId), ["client-b", "client-a"]);
});

test("I2 : livraison sans livreur → driver null", async (t) => {
  mockPortal(t, {});
  stub(t, prisma.delivery, "findFirst", async (args: { include?: { order?: { include?: unknown } } }) =>
    args.include?.order?.include ? null : { id: "d1", status: "PENDING", driverId: null, driverName: null, driver: null, order: {}, trackingEvents: [] });
  const delivery = (await getClientDeliveryById("client-a", "company-a", "d1")) as unknown as Record<string, unknown>;
  assert.equal(delivery.driver, null);
});

test("I2 : contacts d'assistance → prénom, téléphone selon le réglage", async (t) => {
  const row = { id: "d1", reference: "LIV-1", status: "IN_DELIVERY", completedAt: null, driverName: "Karim Benali" };
  for (const [settings, phone] of [[{}, "+33611223344"], [{ portalShowDriverPhone: false }, null]] as const) {
    stub(t, prisma.company, "findUnique", async (args: { select?: Record<string, unknown> }) =>
      args.select?.users ? { name: "Acme", email: null, phone: null, users: [], settings } : { settings });
    stub(t, prisma.delivery, "findFirst", async (args: { select: { driver?: { select: Record<string, unknown> } } }) =>
      ({ ...row, driver: pick(DRIVER, args.select.driver?.select) }));
    const contacts = await getSupportContactsForClient("client-a", "company-a", "d1");
    assert.equal(contacts.driver?.name, "Karim");
    assert.equal(contacts.driver?.phone ?? null, phone);
    assert.equal(JSON.stringify(contacts).includes("Benali"), false);
  }
});

test("I2 : la carte du portail ne montre que « Livreur Prénom »", async (t) => {
  const { getClientDeliveriesMap } = await import("../src/domains/delivery/dispatch-map.service");
  const record = {
    id: "d1", reference: "LIV-1", status: "IN_DELIVERY", deliveryCategory: "STANDARD",
    address: "1 rue A", city: "Paris", postalCode: "75001", pickupAddress: null, pickupCity: null, pickupPostalCode: null,
    latitude: 48.85, longitude: 2.35, pickupLatitude: null, pickupLongitude: null,
    driverId: "drv1", driverName: "Karim Benali", missionStartedAt: new Date(), missionAcceptedAt: new Date(), completedAt: null, createdAt: new Date(),
    customer: { firstName: "Cli", lastName: "Ent" }, driver: null, trackingEvents: [], estimatedArrival: null,
    order: { id: "o1", requestedDeliveryDate: null, customerEmail: null, customer: { firstName: "Cli", lastName: "Ent" }, items: [], stops: [] },
  };
  stub(t, prisma.delivery, "findMany", async () => [record]);
  const map = await getClientDeliveriesMap("client-a", "company-a");
  const serialized = JSON.stringify(map);
  assert.equal(serialized.includes("Benali"), false);
  assert.equal(map.active[0]?.driverName, "Livreur Karim");
});
