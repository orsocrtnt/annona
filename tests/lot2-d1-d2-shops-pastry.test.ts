/**
 * Lot 2, demandes 1 et 2 (18 novembre 2026) : boutiques de l'entreprise et comptes vendeuse ; compte pâtissier
 * et séparation pain / pâtisserie par la catégorie (décision de Théo).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createShop, getSellerShop, getShop, listShops, updateShop, type ShopDb } from "../src/domains/shop/shop.service";
import { listMerchantsForAdmin, getMerchantForAdmin, type MerchantAdminDb } from "../src/domains/merchant/merchant-admin.service";
import { getProductionDay, type ProductionDb } from "../src/domains/production/production.service";
import type { DayLockState } from "../src/domains/order/order-lock.service";
import { canOpenPage, getPageAccessRule, getRoleHomePath } from "../src/lib/permissions/page-access";
import { ROLE_PERMISSIONS, ROLES } from "../prisma/reference-data";
import { createUserSchema } from "../src/lib/validations/user";
import { createShopSchema } from "../src/lib/validations/shop";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;

function shopTables() {
  const tables: Record<string, Row[]> = {
    deliveryZone: [
      { id: "zoneA", companyId: "A", name: "Centre" },
      { id: "zoneB", companyId: "B", name: "Sud" },
    ],
    merchant: [
      { id: "client1", companyId: "A", name: "Bistrot", address: "1 rue", active: true },
      { id: "shopB", companyId: "B", kind: "SHOP", name: "Point de vente B", address: "2 rue", active: true, zoneId: "zoneB" },
    ],
    user: [],
    auditLog: [],
  };
  const db = createMemoryDb(tables) as unknown as ShopDb & MerchantAdminDb;
  return { tables, db };
}

const ACTOR_A = { companyId: "A", userId: "adminA" };
const CENTRE_VILLE = {
  name: "Centre-ville", address: "3 place de la Mairie", postalCode: "75001", city: "Paris", latitude: 48.86, longitude: 2.34,
  accessInstructions: "Porte de service", zoneId: "zoneA", managerCode: "4821",
};

test("LOT2-D1 vérification 1 : l'admin crée le point de vente « Centre-ville », rattachée à une tournée, journalisée ; ce n'est pas un client", async () => {
  const { tables, db } = shopTables();
  const shop = await createShop(ACTOR_A, createShopSchema.parse(CENTRE_VILLE), db);
  assert.equal(shop.name, "Centre-ville");
  assert.equal(shop.zoneName, "Centre");
  assert.equal(shop.accessInstructions, "Porte de service");
  const row = tables.merchant!.find((merchant) => merchant.id === shop.id)!;
  assert.deepEqual([row.kind, row.companyId], ["SHOP", "A"]);
  assert.deepEqual((await listShops("A", db)).map((item) => item.name), ["Centre-ville"]);
  // Pas un client : absente de la liste et de la fiche des clients.
  assert.deepEqual((await listMerchantsForAdmin("A", {}, db)).map((item) => item.id), ["client1"]);
  await assert.rejects(getMerchantForAdmin("A", shop.id, db), { status: 404 });
  assert.equal(tables.auditLog!.some((log) => log.entityType === "Shop" && log.action === "CREATE"), true);
  // Tournée obligatoire et de l'entreprise.
  assert.equal(createShopSchema.safeParse({ ...CENTRE_VILLE, zoneId: "" }).success, false);
  await assert.rejects(createShop(ACTOR_A, { ...CENTRE_VILLE, zoneId: "zoneB" }, db), { status: 400 });
});

test("LOT2-D1 : un point de vente d'une autre entreprise est introuvable ; désactivation journalisée", async () => {
  const { tables, db } = shopTables();
  await assert.rejects(getShop("A", "shopB", db), { status: 404 });
  await assert.rejects(updateShop(ACTOR_A, "shopB", { name: "Piratée" }, db), { status: 404 });
  assert.equal(tables.merchant!.find((row) => row.id === "shopB")!.name, "Point de vente B");
  const shop = await createShop(ACTOR_A, CENTRE_VILLE, db);
  const off = await updateShop(ACTOR_A, shop.id, { active: false }, db);
  assert.equal(off.active, false);
  assert.equal(tables.auditLog!.some((log) => log.entityId === shop.id && log.action === "DEACTIVATE"), true);
  // Un client ne passe jamais par l'écran des boutiques.
  await assert.rejects(updateShop(ACTOR_A, "client1", { name: "X" }, db), { status: 404 });
});

test("LOT2-D1 vérification 2 : la vendeuse ne voit que sa point de vente ; sans point de vente ou rattachée à un client : refusé", async () => {
  const { db } = shopTables();
  const shop = await createShop(ACTOR_A, CENTRE_VILLE, db);
  assert.equal((await getSellerShop({ companyId: "A", merchantId: shop.id }, db)).name, "Centre-ville");
  await assert.rejects(getSellerShop({ companyId: "A", merchantId: null }, db), { status: 403 });
  await assert.rejects(getSellerShop({ companyId: "A", merchantId: "client1" }, db), { status: 403 });
  await assert.rejects(getSellerShop({ companyId: "A", merchantId: "shopB" }, db), { status: 403 });
  // La route de la tablette lit la boutique dans la session, jamais dans la requête.
  const route = readFileSync("src/app/api/shop/route.ts", "utf8");
  assert.match(route, /requireCompanyRole\(\["SELLER"\], "dashboard:shop"\)/);
  assert.match(route, /merchantId: guard\.actor\.user\.merchantId/);
});

test("LOT2-D1 : un compte vendeuse est rattaché à un point de vente ; un compte client à un client", () => {
  const base = { firstName: "Léa", lastName: "Vente", email: "lea@exemple.test" };
  assert.equal(createUserSchema.safeParse({ ...base, roleSlug: "seller" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, roleSlug: "seller", merchantId: "shop1" }).success, true);
  assert.equal(createUserSchema.safeParse({ ...base, roleSlug: "pastry-chef" }).success, true);
  const service = readFileSync("src/domains/user/user.service.ts", "utf8");
  assert.match(service, /const kind = role\.systemRole === "SELLER" \? "SHOP" : "CLIENT";/);
  const accounts = readFileSync("src/domains/user/account-admin.service.ts", "utf8");
  assert.match(accounts, /kind: seller \? "SHOP" : "CLIENT"/);
});

test("LOT2-D1 : un point de vente ne reçoit jamais de facture ni de rappel, et n'apparaît pas dans les choix de clients", () => {
  const invoices = readFileSync("src/domains/invoice/invoice-generation.service.ts", "utf8");
  assert.equal((invoices.match(/kind: "CLIENT"/g) ?? []).length, 3);
  assert.match(readFileSync("src/domains/notification/merchant-notification.service.ts", "utf8"), /active: true, kind: "CLIENT"/);
  assert.match(readFileSync("src/domains/catalog/catalog.service.ts", "utf8"), /where: \{ companyId, kind: "CLIENT" \}/);
});

test("LOT2-D1 et D2 : espaces, accueil et droits des nouveaux comptes", () => {
  assert.equal(getRoleHomePath("PASTRY_CHEF"), "/pastry");
  assert.equal(getRoleHomePath("SELLER"), "/shop");
  assert.deepEqual([...(getPageAccessRule("/pastry")?.roles ?? [])], ["PASTRY_CHEF"]);
  assert.deepEqual([...(getPageAccessRule("/shop")?.roles ?? [])], ["SELLER"]);
  assert.equal(getPageAccessRule("/dashboard/shops")?.module, "shops");
  const seller = { role: "SELLER" as const, permissions: ROLE_PERMISSIONS.SELLER };
  const pastry = { role: "PASTRY_CHEF" as const, permissions: ROLE_PERMISSIONS.PASTRY_CHEF };
  const baker = { role: "BAKER" as const, permissions: ROLE_PERMISSIONS.BAKER };
  assert.equal(canOpenPage("/shop", seller), true);
  for (const path of ["/dashboard", "/dashboard/shops", "/bakery", "/pastry", "/portal", "/driver"]) assert.equal(canOpenPage(path, seller), false, path);
  assert.equal(canOpenPage("/pastry", pastry), true);
  assert.equal(canOpenPage("/bakery", pastry), false);
  assert.equal(canOpenPage("/pastry", baker), false);
  // La vendeuse n'a que sa tablette : aucune permission de catalogue, de commandes, de prix ni de production.
  assert.deepEqual([...ROLE_PERMISSIONS.SELLER], ["dashboard:shop"]);
  // Pâtissier à cette étape : lecture de la production, sans écriture ni prix.
  for (const forbidden of ["catalog:manage", "production:update", "orders:update"]) assert.equal(ROLE_PERMISSIONS.PASTRY_CHEF.includes(forbidden), false, forbidden);
  assert.deepEqual(ROLES.map((role) => role.slug).slice(-2), ["pastry-chef", "seller"]);
  const middleware = readFileSync("src/middleware.ts", "utf8");
  for (const space of ['"/pastry"', '"/shop"']) assert.ok(middleware.includes(space), space);
});

// ---------------------------------------------------------------------------
// Demande 2 : le pâtissier ne voit que la pâtisserie, le boulanger que le pain
// ---------------------------------------------------------------------------

const DAY: DayLockState = { date: "2026-11-20", cutoffAt: new Date("2026-11-19T16:00:00Z"), closed: true, lockedAt: new Date("2026-11-19T16:00:00Z") };

function productionDb() {
  const tables: Record<string, Row[]> = {
    category: [
      { id: "catPain", companyId: "A", name: "Pains", sortOrder: 0, family: "BREAD" },
      { id: "catPat", companyId: "A", name: "Pâtisseries individuelles", sortOrder: 1, family: "PASTRY" },
    ],
    product: [
      { id: "baguette", companyId: "A", categoryId: "catPain", name: "Baguette", unit: "pièce", sortOrder: 0 },
      { id: "eclair", companyId: "A", categoryId: "catPat", name: "Éclair", unit: "pièce", sortOrder: 0 },
    ],
    merchant: [
      { id: "m1", companyId: "A", name: "Bistrot", address: "1 rue" },
      { id: "m2", companyId: "A", name: "Café", address: "2 rue" },
    ],
    order: [
      { id: "o1", companyId: "A", reference: "C1", merchantId: "m1", slotId: "s1", status: "LOCKED", deliveryDate: new Date("2026-11-20T00:00:00Z") },
      { id: "o2", companyId: "A", reference: "C2", merchantId: "m2", slotId: "s1", status: "LOCKED", deliveryDate: new Date("2026-11-20T00:00:00Z") },
    ],
    orderLine: [
      { id: "l1", companyId: "A", orderId: "o1", productId: "baguette", quantityOrdered: 20, quantityDelivered: null },
      { id: "l2", companyId: "A", orderId: "o1", productId: "eclair", quantityOrdered: 12, quantityDelivered: null },
      { id: "l3", companyId: "A", orderId: "o2", productId: "baguette", quantityOrdered: 5, quantityDelivered: null },
    ],
    slot: [{ id: "s1", companyId: "A", label: "Centre matin", startTime: "07:00", endTime: "08:00" }],
    round: [],
    stop: [],
  };
  return createMemoryDb(tables) as unknown as ProductionDb;
}

const names = (day: Awaited<ReturnType<typeof getProductionDay>>) => day.totals.flatMap((category) => category.products.map((product) => product.name));

test("LOT2-D2 vérifications 2 et 3 : le pâtissier voit la pâtisserie et aucun pain ; le boulanger aucune pâtisserie", async () => {
  const db = productionDb();
  const pastry = await getProductionDay("A", DAY, db, "PASTRY");
  assert.deepEqual(names(pastry), ["Éclair"]);
  assert.deepEqual(pastry.sheets.map((sheet) => sheet.reference), ["C1"], "une commande sans pâtisserie n'a pas de bon chez le pâtissier");
  assert.deepEqual(pastry.sheets[0]!.lines.map((line) => line.name), ["Éclair"]);
  assert.equal(pastry.itemCount, 12);
  const bread = await getProductionDay("A", DAY, db, "BREAD");
  assert.deepEqual(names(bread), ["Baguette"]);
  assert.deepEqual(bread.sheets.map((sheet) => sheet.reference).sort(), ["C1", "C2"]);
  assert.equal(bread.sheets.every((sheet) => sheet.lines.every((line) => line.name === "Baguette")), true);
  // Sans famille (lecture de l'administrateur) : tout.
  assert.deepEqual(names(await getProductionDay("A", DAY, db)).sort(), ["Baguette", "Éclair"]);
  const route = readFileSync("src/app/api/production/route.ts", "utf8");
  assert.match(route, /systemRole === "PASTRY_CHEF" \? "PASTRY" : "BREAD"/);
});

test("LOT2-D2 : la famille se règle par catégorie ; les catégories de pâtisserie existantes passent côté pâtissier", () => {
  const migration = readFileSync("prisma/migrations/20261118100000_lot2_roles_shops/migration.sql", "utf8");
  assert.match(migration, /ALTER TABLE "categories" ADD COLUMN "family" "ProductFamily" NOT NULL DEFAULT 'BREAD'/);
  assert.match(migration, /UPDATE "categories" SET "family" = 'PASTRY'/);
  assert.match(migration, /'%gâteau%'/);
  // Les nouvelles valeurs de rôle sont utilisées dans une migration séparée (PostgreSQL).
  assert.doesNotMatch(migration, /INSERT INTO "roles"/);
  const data = readFileSync("prisma/migrations/20261118100100_lot2_roles_data/migration.sql", "utf8");
  assert.match(data, /'rbac_role_pastry_chef', 'Pâtissier', 'pastry-chef'/);
  assert.match(data, /'rbac_role_seller', 'Vendeuse', 'seller'/);
});
