/**
 * RETOURS-3 (notes du tour 2 de Théo, `outputs/notes-tour-2.md`, 24 novembre 2026) :
 * - laboratoires nommés par le gérant (deux espaces, un seul type, seul le nom change ; Paramètres) ;
 * - onglet « Par point de vente » des laboratoires, part des points de vente dans le total à produire ;
 * - flèche de retour au tableau de bord et pastille rouge des demandes de support du gérant (ADM-1) ;
 * - démo : « Laboratoire boulanger » et « Laboratoire de pâtisserie », stock du jour lisible.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DEFAULT_SPACE_NAMES, readSpaceNames, roleLabelFor, spaceNameForPath } from "../src/lib/company/space-names";
import { companySettingsSchema } from "../src/lib/validations/company-admin";
import { updateCompanySettings, type CompanySettingsDb } from "../src/domains/company/company-settings.service";
import { computeProductionTotals, getProductionDay, type ProductionDb } from "../src/domains/production/production.service";
import { saveShipment, type ShipmentDb } from "../src/domains/shop/shipment.service";
import { deliveryDateToDb } from "../src/domains/order/order-deadline";
import { applyCompanyNavBadges } from "../src/features/navigation/admin-nav-badges";
import { shouldShowBackToDashboard } from "../src/features/navigation/back-to-dashboard";
import { getNavItemsForRole } from "../src/features/navigation/get-nav-items";
import { DEMO_PERSONA_LABELS, DEMO_SPACE_NAMES } from "../src/lib/demo/demo-constants";
import { buildDemoScenario } from "../src/domains/demo/demo-scenario";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;

test("RETOURS-3 : noms des laboratoires lus dans les réglages de l'entreprise, valeurs par défaut neutres sinon", () => {
  assert.deepEqual(readSpaceNames(null), DEFAULT_SPACE_NAMES);
  assert.deepEqual(readSpaceNames({ units: ["kg"] }), DEFAULT_SPACE_NAMES);
  assert.deepEqual(readSpaceNames({ spaceNames: { production: "  Labo   boulanger ", atelier: "Labo pâtisserie" } }), {
    production: "Labo boulanger",
    atelier: "Labo pâtisserie",
  });
  // Nom vide, trop long ou d'un mauvais type : on retombe sur le nom par défaut de cet espace seulement.
  assert.deepEqual(readSpaceNames({ spaceNames: { production: "", atelier: "x".repeat(41) } }), DEFAULT_SPACE_NAMES);
  assert.deepEqual(readSpaceNames({ spaceNames: { production: 12, atelier: "Atelier découpe" } }), { production: DEFAULT_SPACE_NAMES.production, atelier: "Atelier découpe" });
  assert.deepEqual(readSpaceNames({ spaceNames: ["a", "b"] }), DEFAULT_SPACE_NAMES);

  const names = { production: "Laboratoire boulanger", atelier: "Labo pâtisserie" };
  assert.equal(roleLabelFor("BAKER", names), "Laboratoire boulanger");
  assert.equal(roleLabelFor("PASTRY_CHEF", names), "Labo pâtisserie");
  assert.equal(roleLabelFor("ADMIN", names), "Gérant");
  assert.equal(roleLabelFor("SELLER", names), "Vente");
  assert.equal(spaceNameForPath("/bakery/shipments", names), "Laboratoire boulanger");
  assert.equal(spaceNameForPath("/pastry", names), "Labo pâtisserie");
  assert.equal(spaceNameForPath("/bakeryx", names), null);

  // Menu : l'entrée d'accueil de chaque laboratoire porte son nom, le reste du menu ne change pas.
  assert.equal(getNavItemsForRole("BAKER", names)[0]!.title, "Laboratoire boulanger");
  assert.equal(getNavItemsForRole("PASTRY_CHEF", names)[0]!.title, "Labo pâtisserie");
  assert.equal(getNavItemsForRole("BAKER")[0]!.title, DEFAULT_SPACE_NAMES.production);
});

test("RETOURS-3 : Paramètres › Laboratoires — validation, enregistrement journalisé, autres réglages gardés", async () => {
  assert.equal(companySettingsSchema.safeParse({ spaceNames: { production: "Labo A", atelier: "Labo B" } }).success, true);
  assert.equal(companySettingsSchema.safeParse({ spaceNames: { production: "Labo A", atelier: " labo  a " } }).success, false, "deux noms identiques");
  assert.equal(companySettingsSchema.safeParse({ spaceNames: { production: "", atelier: "Labo B" } }).success, false, "nom vide");
  assert.equal(companySettingsSchema.safeParse({ spaceNames: { production: "x".repeat(41), atelier: "Labo B" } }).success, false, "41 caractères");
  assert.equal(companySettingsSchema.safeParse({ spaceNames: { production: "Labo A", atelier: "Labo B", extra: "x" } }).success, false, "champ inconnu");

  const company: Row = {
    id: "A",
    name: "Entreprise A",
    cutoffTime: "17:00",
    timezone: "Europe/Paris",
    reminderLeadMinutes: 120,
    settings: { units: ["kg"], billing: { keep: true } },
    updatedAt: new Date("2026-11-24T10:00:00Z"),
  };
  const audits: Row[] = [];
  const db = {
    company: {
      findFirst: async ({ where }: { where: { id: string } }) => (where.id === company.id ? { ...company } : null),
      updateMany: async ({ where, data }: { where: { id: string; updatedAt: Date }; data: Row }) => {
        if (where.id !== company.id || where.updatedAt !== company.updatedAt) return { count: 0 };
        Object.assign(company, data, { updatedAt: new Date("2026-11-24T10:05:00Z") });
        return { count: 1 };
      },
    },
    auditLog: { create: async ({ data }: { data: Row }) => audits.push(data) },
  } as unknown as CompanySettingsDb;
  const input = companySettingsSchema.parse({ spaceNames: { production: "Laboratoire  boulanger", atelier: "Labo pâtisserie" } });
  // Défaut corrigé au passage (présent depuis ADM-1) : un enregistrement sans « units » ne vide plus les unités.
  assert.equal("units" in companySettingsSchema.parse({ name: "Entreprise A" }), false);
  assert.equal("units" in input, false);
  const view = await updateCompanySettings({ companyId: "A", userId: "gerant" }, input, db);
  assert.deepEqual(view.spaceNames, { production: "Laboratoire boulanger", atelier: "Labo pâtisserie" });
  assert.deepEqual(company.settings, { units: ["kg"], billing: { keep: true }, spaceNames: { production: "Laboratoire boulanger", atelier: "Labo pâtisserie" } });
  assert.equal(audits.length, 1);
  assert.equal(audits[0]!.entityType, "CompanySettings");
  assert.deepEqual((audits[0]!.after as { spaceNames: unknown }).spaceNames, view.spaceNames);
  await assert.rejects(updateCompanySettings({ companyId: "B", userId: "gerant" }, input, db), { status: 404 }, "une autre entreprise");
});

function productionFixture() {
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", depotLatitude: 48.8547, depotLongitude: 2.3725 }],
    deliveryZone: [{ id: "zCentre", companyId: "A", name: "Centre" }],
    slot: [{ id: "sMatin", companyId: "A", zoneId: "zCentre", period: "MORNING", label: "Centre matin", startTime: "06:00", endTime: "08:00", active: true, sortOrder: 0 }],
    merchant: [
      { id: "centre", companyId: "A", kind: "SHOP", name: "Centre-ville", address: "3 place", active: true, zoneId: "zCentre", latitude: 48.86, longitude: 2.34 },
      { id: "bastille", companyId: "A", kind: "SHOP", name: "Bastille", address: "5 rue", active: true, zoneId: "zCentre", latitude: 48.85, longitude: 2.37 },
      { id: "client1", companyId: "A", kind: "CLIENT", name: "Bistrot", address: "1 rue", active: true, zoneId: "zCentre", latitude: 48.87, longitude: 2.35 },
      // Point de vente d'une autre entreprise : jamais lu.
      { id: "autre", companyId: "B", kind: "SHOP", name: "Autre entreprise", address: "9 rue", active: true, zoneId: "zB", latitude: 48.8, longitude: 2.3 },
    ],
    category: [
      { id: "catPat", companyId: "A", name: "Pâtisseries", sortOrder: 0, active: true, family: "PASTRY" },
      { id: "catPain", companyId: "A", name: "Pains", sortOrder: 1, active: true, family: "BREAD" },
    ],
    product: [
      { id: "eclair", companyId: "A", categoryId: "catPat", name: "Éclair", unit: "pièce", sortOrder: 0, active: true, pastryFormat: "SMALL", basePriceCents: 250, vatRateBasisPoints: 550 },
      { id: "baguette", companyId: "A", categoryId: "catPain", name: "Baguette", unit: "pièce", sortOrder: 0, active: true, pastryFormat: null, basePriceCents: 110, vatRateBasisPoints: 550 },
    ],
    productSize: [],
    cakeOrder: [],
    order: [],
    orderLine: [],
    merchantPrice: [],
    recurringOrder: [],
    recurringOrderLine: [],
    round: [],
    stop: [],
    auditLog: [],
  };
  const db = createMemoryDb(tables, {
    decorate: { product: (row, all) => ({ category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) } }) },
  });
  return { tables, db };
}

const J = "2026-11-20";
const BEFORE = new Date("2026-11-19T10:00:00.000Z");
const CUTOFF = new Date("2026-11-19T16:00:00.000Z");

test("RETOURS-3 : la production des points de vente est dans le total, signalée à part, et détaillée par point de vente", async () => {
  const { tables, db } = productionFixture();
  const PASTRY = { companyId: "A", userId: "atelier", family: "PASTRY" as const };
  const BAKER = { companyId: "A", userId: "production", family: "BREAD" as const };
  const none = async () => undefined;
  await saveShipment(PASTRY, { date: J, shopId: "centre", lines: [{ productId: "eclair", quantity: 12 }] }, { db: db as unknown as ShipmentDb, now: BEFORE, addToRounds: none });
  await saveShipment(PASTRY, { date: J, shopId: "bastille", lines: [{ productId: "eclair", quantity: 6 }] }, { db: db as unknown as ShipmentDb, now: BEFORE, addToRounds: none });
  await saveShipment(BAKER, { date: J, shopId: "centre", lines: [{ productId: "baguette", quantity: 20 }] }, { db: db as unknown as ShipmentDb, now: BEFORE, addToRounds: none });
  // Commande d'un client pour le même jour (verrouillée : comptée avant et après l'heure limite).
  tables.order!.push({ id: "o1", companyId: "A", merchantId: "client1", slotId: "sMatin", status: "LOCKED", deliveryDate: deliveryDateToDb(J), reference: "C1", origin: "MANUAL" });
  tables.orderLine!.push({ id: "l1", companyId: "A", orderId: "o1", productId: "eclair", quantityOrdered: 5, quantityDelivered: null });
  tables.orderLine!.push({ id: "l2", companyId: "A", orderId: "o1", productId: "baguette", quantityOrdered: 30, quantityDelivered: null });

  // Avant l'heure limite : total provisoire, mais les envois (déjà décidés) se lisent par point de vente.
  const open = await getProductionDay("A", { date: J, cutoffAt: CUTOFF, closed: false, lockedAt: null }, db as unknown as ProductionDb, "PASTRY");
  const eclair = open.totals.flatMap((category) => category.products).find((product) => product.name === "Éclair")!;
  assert.deepEqual([eclair.quantity, eclair.shopQuantity], [23, 18], "5 pour le client + 12 et 6 pour les points de vente");
  assert.deepEqual(
    open.shops.map((shop) => [shop.name, shop.itemCount, shop.lines.map((line) => `${line.name} ${line.quantity}`)]),
    [
      ["Bastille", 6, ["Éclair 6"]],
      ["Centre-ville", 12, ["Éclair 12"]],
    ],
    "seulement la famille du laboratoire, triés par nom, sans le client"
  );

  const bread = await getProductionDay("A", { date: J, cutoffAt: CUTOFF, closed: true, lockedAt: CUTOFF }, db as unknown as ProductionDb, "BREAD");
  const baguette = bread.totals.flatMap((category) => category.products).find((product) => product.name === "Baguette")!;
  assert.deepEqual([baguette.quantity, baguette.shopQuantity], [50, 20]);
  assert.deepEqual(bread.shops.map((shop) => [shop.name, shop.itemCount]), [["Centre-ville", 20]], "Bastille n'a pas de pain ce jour-là");
  assert.equal(bread.shops.some((shop) => shop.name === "Autre entreprise"), false);

  // Règle pure : sans envoi, aucune part « points de vente ».
  const totals = computeProductionTotals([{ productId: "eclair", quantityOrdered: 3, orderId: "o1" }], tables.product as never, tables.category as never);
  assert.equal(totals[0]!.products[0]!.shopQuantity, undefined);
});

test("RETOURS-3 : flèche de retour et pastille rouge du support, pour le gérant seulement", () => {
  assert.equal(shouldShowBackToDashboard("ADMIN", "/dashboard"), false);
  assert.equal(shouldShowBackToDashboard("ADMIN", "/dashboard/orders"), true);
  assert.equal(shouldShowBackToDashboard("ADMIN", "/support"), true);
  assert.equal(shouldShowBackToDashboard("ADMIN", "/settings/billing"), true);
  assert.equal(shouldShowBackToDashboard("BAKER", "/bakery/stock"), false);
  assert.equal(shouldShowBackToDashboard("SUPER_ADMIN", "/admin/support"), false);

  const items = [
    { title: "Tableau de bord", href: "/dashboard" },
    { title: "Support", href: "/support" },
  ];
  assert.deepEqual(applyCompanyNavBadges(items, { openTickets: 0 }), items, "aucune pastille à zéro");
  assert.deepEqual(applyCompanyNavBadges(items, null), items);
  const withBadge = applyCompanyNavBadges(items, { openTickets: 3 });
  assert.deepEqual(withBadge[1], { title: "Support", href: "/support", badge: 3, badgeLabel: "3 nouvelles demandes de support", badgeTone: "alert" });
  assert.equal(withBadge[0]!.badge, undefined);
  assert.equal(applyCompanyNavBadges(items, { openTickets: 150 })[1]!.badge, "99+");

  // Même garde que la liste du support : gérant avec support:read, entreprise de la session ; demandes « Ouvertes ».
  const route = readFileSync("src/app/api/support/summary/route.ts", "utf8");
  assert.match(route, /requireSupportStaff\(\)/);
  assert.match(route, /countNewStaffTickets\(auth\.companyId\)/);
  const service = readFileSync("src/domains/support/support.service.ts", "utf8");
  assert.match(service, /count\(\{ where: \{ \.\.\.staffTicketScope\(companyId\), status: "OPEN" \} \}\)/);
});

test("RETOURS-3 : démo — deux laboratoires nommés, même type de compte, stock du jour lisible au second point de vente", () => {
  assert.equal(DEMO_PERSONA_LABELS.baker.title, "Laboratoire boulanger");
  assert.equal(DEMO_PERSONA_LABELS.pastry.title, "Laboratoire de pâtisserie");
  assert.equal(DEMO_PERSONA_LABELS.admin.title, "Gérant");
  const scenario = buildDemoScenario({ slot: 2, now: new Date("2026-11-24T09:00:00Z") });
  assert.deepEqual(readSpaceNames(scenario.company.settings), DEMO_SPACE_NAMES);
  const demoShopId = scenario.users.find((user) => user.persona === "seller")!.merchantId;
  const today = Date.UTC(2026, 10, 24);
  const stockToday = (shopId: string) =>
    scenario.shopStockLots
      .filter((lot) => lot.shopId === shopId && new Date(lot.receivedOn as Date).getTime() === today)
      .reduce((sum, lot) => sum + Number(lot.quantity), 0);
  const otherShop = scenario.merchants.find((merchant) => merchant.kind === "SHOP" && merchant.id !== demoShopId)!;
  assert.ok(stockToday(otherShop.id as string) > 0, "le second point de vente a son stock du jour");
  assert.equal(stockToday(demoShopId as string), 0, "la réception du jour reste à faire sur la tablette du compte de démo");
});
