/**
 * ADM-1 — critère de recette 10 (PLA-01) : un utilisateur d'une entreprise A ne voit aucune donnée d'une
 * entreprise B.
 *
 * 1. Inventaire systématique de TOUTES les routes API (`src/app/api/**\/route.ts`) : chaque méthode exportée
 *    doit appliquer une garde reconnue (entreprise ou rôle prise dans la session, plateforme réservée au
 *    super-administrateur, secret des crons, ou route publique listée avec sa raison) et ne jamais lire
 *    l'entreprise dans la requête. Une nouvelle route sans garde fait échouer ce test.
 * 2. Intégration au niveau des services (base en mémoire) : avec des identifiants de B, un administrateur,
 *    un client ou un livreur de A obtient 404 et ne modifie rien (commandes, clients, produits, prix,
 *    créneaux, tournées, arrêts, factures, comptes, paramètres) ; les listes de A ne contiennent rien de B.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { getMerchantForAdmin, listMerchantsForAdmin, updateMerchantForAdmin, type MerchantAdminDb } from "../src/domains/merchant/merchant-admin.service";
import { updateCompanyAccount, type AccountAdminDb } from "../src/domains/user/account-admin.service";
import { deleteZoneForAdmin, listZonesForAdmin, updateZoneForAdmin, type ZoneAdminDb } from "../src/domains/company/delivery-zone.service";
import { getCompanySettings, updateCompanySettings, type CompanySettingsDb } from "../src/domains/company/company-settings.service";
import { deleteMerchantPrice, listMerchantPrices, listProducts, updateProduct, upsertMerchantPrice, type CatalogDb } from "../src/domains/catalog/catalog.service";
import { cancelAdminOrder, correctAdminOrder, getAdminOrder, type AdminOrderDb } from "../src/domains/order/admin-order.service";
import { cancelMerchantOrder, getMerchantOrder, type OrderDb } from "../src/domains/order/merchant-order.service";
import { assignRoundDriver, moveStop, reorderRoundStops, type RoundDb } from "../src/domains/round/round-admin.service";
import { getDriverRounds, markStopDelivered, type DriverRoundDb } from "../src/domains/round/round-driver.service";
import { getAdminInvoice, listMerchantInvoices, type InvoiceQueryDb } from "../src/domains/invoice/invoice-query.service";
import { createMemoryDb } from "./helpers/memory-db";

// ---------------------------------------------------------------------------
// 1. Inventaire des routes
// ---------------------------------------------------------------------------

/** Routes sans session d'entreprise, chacune avec sa raison. */
const PUBLIC_ROUTES: Record<string, string> = {
  "auth/login/route.ts": "connexion (identifiants ; l'entreprise et le statut du compte sont relus ensuite)",
  "auth/password-link/route.ts": "lien d'invitation ou de réinitialisation à usage unique",
  "auth/password-recovery/route.ts": "demande de réinitialisation (réponse identique, compte existant ou non)",
  "auth/sync/route.ts": "synchronisation du compte de la session Supabase vérifiée",
  "auth/session/route.ts": "contexte de la session courante seulement (getServerAuth)",
  "auth/signup/route.ts": "AUTH-GOOGLE : inscription d'une boulangerie par e-mail (nouvelle entreprise « Essai », réponse identique, compte existant ou non)",
  "auth/signup/google/route.ts": "AUTH-GOOGLE : fin d'inscription avec Google (adresse et identifiant relus dans la session Supabase, nouvelle entreprise seulement)",
  "health/route.ts": "état du service, sans donnée",
  "addresses/search/route.ts": "géocodage d'une adresse saisie (base nationale), sans donnée d'entreprise",
};

const COMPANY_GUARD = /\brequire(CompanyAdmin|CompanyAdminAny|CompanyRole|CompanyMember|MerchantActor|MerchantRole|DriverRole|SupportStaff)\(/;
const COMPANY_FROM_REQUEST = /searchParams\.get\(\s*["']companyId["']\)|(?:body|input|payload|parsed\.data)\.companyId|companyId:\s*(?:body|input|params)\b/;

type Kind = "entreprise" | "plateforme" | "compte" | "cron" | "public";

function functionBodies(source: string) {
  const bodies = new Map<string, string>();
  for (const match of source.matchAll(/(?:async )?function (\w+)\(/g)) {
    const start = source.indexOf("{", source.indexOf(")", match.index ?? 0));
    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      else if (source[index] === "}" && (depth -= 1) === 0) {
        bodies.set(match[1]!, source.slice(start, index));
        break;
      }
    }
  }
  return bodies;
}

function classify(file: string, body: string): Kind | null {
  if (/process\.env\.CRON_SECRET/.test(body) && /authorization/i.test(body)) return "cron";
  const roles = body.match(/requireRole\([^)]*\[([^\]]*)\]/)?.[1] ?? "";
  if (/requireStaffRole\(/.test(body) && /"SUPER_ADMIN"/.test(roles) && !/"ADMIN"/.test(roles)) return "plateforme";
  if (COMPANY_GUARD.test(body)) return "entreprise";
  if (/requireStaffRole\(/.test(body) && /"ADMIN"/.test(roles)) return "entreprise";
  if (/\brequireAuth\(/.test(body)) return "compte";
  if (PUBLIC_ROUTES[file]) return "public";
  return null;
}

function inventory() {
  const files = readdirSync("src/app/api", { recursive: true })
    .map((entry) => entry.toString().split("\\").join("/"))
    .filter((entry) => entry.endsWith("route.ts"))
    .sort();
  const rows: Array<{ file: string; method: string; kind: Kind | null }> = [];
  for (const file of files) {
    const source = readFileSync(join("src/app/api", file), "utf8");
    const helpers = functionBodies(source);
    const parts = source.split(/export (?:async )?function (GET|POST|PATCH|PUT|DELETE)\b/);
    for (let index = 1; index < parts.length; index += 2) {
      const own = parts[index + 1] ?? "";
      const body = own.split(/\nexport /)[0]!;
      let scan = body;
      for (const [name, helper] of helpers) if (new RegExp(`\\b${name}\\s*\\(`).test(body)) scan += `\n${helper}`;
      rows.push({ file, method: parts[index]!, kind: classify(file, scan) });
    }
  }
  return { files, rows };
}

test("Critère 10 : chaque méthode de chaque route API applique une garde reconnue", () => {
  const { files, rows } = inventory();
  const unguarded = rows.filter((row) => row.kind === null).map((row) => `${row.file} ${row.method}`);
  assert.deepEqual(unguarded, [], `routes sans garde reconnue : ${unguarded.join(", ")}`);
  // Tout le dossier est parcouru (97 fichiers au 7 novembre 2026) : aucune route n'est oubliée.
  assert.ok(files.length >= 97, `${files.length} fichiers de route`);
  assert.equal(new Set(rows.map((row) => row.file)).size, files.length, "chaque fichier exporte au moins une méthode");
  const counts = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.kind!]: (acc[row.kind!] ?? 0) + 1 }), {});
  // Compteurs visibles au rapport de test.
  console.log(`[critère 10] ${files.length} fichiers de route, ${rows.length} méthodes : ${JSON.stringify(counts)}`);
  // Les routes publiques sont exactement celles de la liste (aucune garde manquante n'est acceptée en silence).
  const publicFiles = [...new Set(rows.filter((row) => row.kind === "public").map((row) => row.file))].sort();
  assert.deepEqual(publicFiles, Object.keys(PUBLIC_ROUTES).sort());
});

test("Critère 10 : aucune route d'entreprise ou de compte ne lit l'entreprise dans la requête", () => {
  const { rows } = inventory();
  for (const file of new Set(rows.filter((row) => row.kind === "entreprise" || row.kind === "compte").map((row) => row.file))) {
    const source = readFileSync(join("src/app/api", file), "utf8");
    assert.doesNotMatch(source, COMPANY_FROM_REQUEST, file);
  }
  // Les gardes d'entreprise prennent l'entreprise dans la session et refusent un compte sans entreprise.
  const guard = readFileSync("src/lib/api/tenant-auth.ts", "utf8");
  assert.equal((guard.match(/companyId: user\.companyId/g) ?? []).length >= 4, true);
  assert.equal((guard.match(/if \(!user\.companyId\)/g) ?? []).length >= 4, true);
  // Compte désactivé ou entreprise suspendue : aucune session, donc aucune garde ne passe.
  const access = readFileSync("src/lib/auth/account-access.ts", "utf8");
  assert.match(access, /user\.status !== "ACTIVE"/);
  assert.match(access, /company\.status === "ACTIVE" \|\| user\.company\.status === "TRIAL"/);
});

test("Critère 10 : les routes de la plateforme sont réservées au super-administrateur", () => {
  const { rows } = inventory();
  const platform = rows.filter((row) => row.file.startsWith("admin/"));
  assert.ok(platform.length >= 13);
  for (const row of platform) assert.equal(row.kind, "plateforme", `${row.file} ${row.method}`);
});

// ---------------------------------------------------------------------------
// 2. Services : identifiants de B depuis A
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
const J = "2026-11-10";
/** Lundi 9 novembre 2026, 10 h à Paris : avant l'heure limite de la livraison du 10. */
const MORNING = new Date("2026-11-09T09:00:00.000Z");
/** 10 novembre, 5 h 30 à Paris : jour de la tournée. */
const ROUND_DAY = new Date("2026-11-10T04:30:00.000Z");

function fixture() {
  const company = (id: string) => ({ id, name: `Boulangerie ${id}`, slug: id.toLowerCase(), status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120, settings: {}, updatedAt: new Date(0), depotLatitude: 48.85, depotLongitude: 2.35 });
  const merchant = (id: string, companyId: string) => ({ id, companyId, name: `Client ${id}`, tradeName: null, siren: null, vatNumber: null, address: `${id} rue`, postalCode: "75011", city: "Paris", latitude: 48.86, longitude: 2.37, accessInstructions: null, contactName: null, contactPhone: null, contactEmail: null, billingEmail: null, billingAddress: null, billingPostalCode: null, billingCity: null, billingPeriod: "MONTHLY", paymentMethod: null, active: true, createdAt: new Date(0) });
  const user = (id: string, companyId: string, roleId: string, merchantId: string | null = null) => ({ id, companyId, roleId, merchantId, email: `${id}@exemple.test`, firstName: "Prénom", lastName: id, phone: null, status: "ACTIVE", settings: {}, updatedAt: new Date(0) });
  const order = (id: string, companyId: string, merchantId: string, status = "VALIDATED") => ({ id, companyId, merchantId, reference: `C-${id}`, deliveryDate: day(J), slotId: `slot${companyId}`, status, origin: "MANUAL", notes: null, createdById: null, invoiceId: null, lockedAt: null, preparedAt: null, createdAt: new Date(0) });
  const tables: Record<string, Row[]> = {
    company: [company("A"), company("B")],
    role: [
      { id: "rAdmin", slug: "admin", name: "Administrateur", systemRole: "ADMIN" },
      { id: "rDriver", slug: "driver", name: "Livreur", systemRole: "DRIVER" },
      { id: "rMerchant", slug: "merchant", name: "Client", systemRole: "MERCHANT" },
    ],
    user: [
      user("adminA", "A", "rAdmin"), user("driverA", "A", "rDriver"), user("clientA", "A", "rMerchant", "mA"),
      user("adminB", "B", "rAdmin"), user("driverB", "B", "rDriver"), user("clientB", "B", "rMerchant", "mB"),
    ],
    merchant: [merchant("mA", "A"), merchant("mB", "B")],
    category: [
      { id: "catA", companyId: "A", name: "Pains", sortOrder: 0, active: true },
      { id: "catB", companyId: "B", name: "Pains", sortOrder: 0, active: true },
    ],
    product: [
      { id: "pA", companyId: "A", categoryId: "catA", name: "Baguette", unit: "pièce", basePriceCents: 100, vatRateBasisPoints: 550, sortOrder: 0, active: true, photoUrl: null, description: null },
      { id: "pB", companyId: "B", categoryId: "catB", name: "Baguette", unit: "pièce", basePriceCents: 110, vatRateBasisPoints: 550, sortOrder: 0, active: true, photoUrl: null, description: null },
    ],
    merchantPrice: [
      { id: "mpA", companyId: "A", merchantId: "mA", productId: "pA", priceCents: 90 },
      { id: "mpB", companyId: "B", merchantId: "mB", productId: "pB", priceCents: 95 },
    ],
    deliveryZone: [
      { id: "zoneA", companyId: "A", name: "Sud", morningStart: "06:00", morningEnd: "07:00", eveningStart: "16:00", eveningEnd: "19:00", active: true, sortOrder: 0 },
      { id: "zoneB", companyId: "B", name: "Sud", morningStart: "06:00", morningEnd: "07:00", eveningStart: "16:00", eveningEnd: "19:00", active: true, sortOrder: 0 },
    ],
    slot: [
      { id: "slotA", companyId: "A", zoneId: "zoneA", period: "MORNING", label: "Sud matin", startTime: "06:00", endTime: "07:00", active: true, sortOrder: 0 },
      { id: "slotB", companyId: "B", zoneId: "zoneB", period: "MORNING", label: "Sud matin", startTime: "06:00", endTime: "07:00", active: true, sortOrder: 0 },
    ],
    order: [order("oA", "A", "mA"), order("oB", "B", "mB"), order("oA2", "A", "mA", "LOCKED"), order("oB2", "B", "mB", "LOCKED")],
    orderLine: [
      { id: "lA", companyId: "A", orderId: "oA", productId: "pA", quantityOrdered: 5, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(0) },
      { id: "lB", companyId: "B", orderId: "oB", productId: "pB", quantityOrdered: 5, quantityDelivered: null, unitPriceFrozenCents: null, createdAt: new Date(0) },
      { id: "lA2", companyId: "A", orderId: "oA2", productId: "pA", quantityOrdered: 2, quantityDelivered: null, unitPriceFrozenCents: 90, createdAt: new Date(0) },
      { id: "lB2", companyId: "B", orderId: "oB2", productId: "pB", quantityOrdered: 2, quantityDelivered: null, unitPriceFrozenCents: 95, createdAt: new Date(0) },
    ],
    recurringOrder: [],
    round: [
      { id: "rndA", companyId: "A", date: day(J), slotId: "slotA", driverId: "driverA", name: "Tournée A", status: "ASSIGNED", startedAt: null, completedAt: null, createdAt: new Date(0) },
      { id: "rndB", companyId: "B", date: day(J), slotId: "slotB", driverId: "driverB", name: "Tournée B", status: "ASSIGNED", startedAt: null, completedAt: null, createdAt: new Date(0) },
    ],
    stop: [
      { id: "sA", companyId: "A", roundId: "rndA", orderId: "oA2", sequence: 1, status: "PENDING", estimatedArrivalAt: null, deliveredAt: null, incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null, createdAt: new Date(0) },
      { id: "sB", companyId: "B", roundId: "rndB", orderId: "oB2", sequence: 1, status: "PENDING", estimatedArrivalAt: null, deliveredAt: null, incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null, createdAt: new Date(0) },
    ],
    invoice: [
      { id: "invA", companyId: "A", merchantId: "mA", number: 1, reference: "FAC-000001", periodType: "MONTHLY", periodStart: day("2026-10-01"), periodEnd: day("2026-10-31"), issuedAt: new Date(0), dueDate: null, subtotalCents: 100, vatCents: 6, totalCents: 106, status: "PENDING", paymentMethod: null, paidAt: null, notes: null, pdfUrl: null },
      { id: "invB", companyId: "B", merchantId: "mB", number: 1, reference: "FAC-000001", periodType: "MONTHLY", periodStart: day("2026-10-01"), periodEnd: day("2026-10-31"), issuedAt: new Date(0), dueDate: null, subtotalCents: 100, vatCents: 6, totalCents: 106, status: "PENDING", paymentMethod: null, paidAt: null, notes: null, pdfUrl: null },
    ],
    invoiceLine: [],
    payment: [],
    auditLog: [],
    operationJob: [],
    driverLocation: [],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      product: (row, all) => ({
        category: { active: Boolean((all.category ?? []).find((category) => category.id === row.categoryId)?.active) },
        _count: { merchantPrices: (all.merchantPrice ?? []).filter((price) => price.productId === row.id).length },
      }),
      merchantPrice: (row, all) => ({
        merchant: (all.merchant ?? []).find((merchant) => merchant.id === row.merchantId),
        product: (all.product ?? []).find((product) => product.id === row.productId),
      }),
      category: (row, all) => ({ _count: { products: (all.product ?? []).filter((product) => product.categoryId === row.id).length } }),
    },
  });
  return { tables, db };
}

const notFound = (error: Error & { status?: number }) => error.status === 404;
const ADMIN_A = { companyId: "A", userId: "adminA" };
const snapshot = (tables: Record<string, Row[]>) => JSON.stringify(Object.fromEntries(Object.entries(tables).map(([key, rows]) => [key, rows.filter((row) => row.companyId === "B" || (key === "company" && row.id === "B"))])));

test("Critère 10 : clients, comptes, créneaux et paramètres de B introuvables depuis A, rien de B modifié", async () => {
  const { tables, db } = fixture();
  const before = snapshot(tables);
  const merchants = db as unknown as MerchantAdminDb;
  assert.deepEqual((await listMerchantsForAdmin("A", {}, merchants)).map((row) => row.id), ["mA"]);
  await assert.rejects(getMerchantForAdmin("A", "mB", merchants), notFound);
  await assert.rejects(updateMerchantForAdmin(ADMIN_A, "mB", { active: false }, merchants), notFound);
  assert.deepEqual((await getMerchantForAdmin("A", "mA", merchants)).users.map((user) => user.id), ["clientA"]);

  const accounts = db as unknown as AccountAdminDb;
  await assert.rejects(updateCompanyAccount(ADMIN_A, "adminB", { active: false }, accounts), notFound);
  await assert.rejects(updateCompanyAccount(ADMIN_A, "clientB", { firstName: "Pirate" }, accounts), notFound);
  // Rattacher un compte de A à un client de B : refusé.
  await assert.rejects(updateCompanyAccount(ADMIN_A, "clientA", { merchantId: "mB" }, accounts), { code: "MERCHANT_REQUIRED" });

  // Lot 1, demande 1 : la tournée d'une autre entreprise est introuvable.
  const zones = db as unknown as ZoneAdminDb;
  assert.deepEqual((await listZonesForAdmin("A", zones)).map((zone) => zone.id), ["zoneA"]);
  await assert.rejects(updateZoneForAdmin("A", "zoneB", { active: false }, zones), { status: 404, code: "ZONE_NOT_FOUND" });
  await assert.rejects(deleteZoneForAdmin("A", "zoneB", zones), { status: 404, code: "ZONE_NOT_FOUND" });

  const settings = db as unknown as CompanySettingsDb;
  await updateCompanySettings({ companyId: "A", userId: "adminA" }, { cutoffTime: "16:00", name: "A renommée" }, settings);
  assert.equal((await getCompanySettings("B", settings)).cutoffTime, "17:00");
  assert.equal(snapshot(tables), before);
});

test("Critère 10 : produits, prix, commandes, tournées, arrêts et factures de B : 404 depuis A, listes sans B", async () => {
  const { tables, db } = fixture();
  const before = snapshot(tables);
  const catalog = db as unknown as CatalogDb;
  assert.deepEqual((await listProducts("A", catalog)).map((product) => product.id), ["pA"]);
  await assert.rejects(updateProduct("A", "pB", { basePriceCents: 1 }, catalog), notFound);
  assert.deepEqual((await listMerchantPrices("A", {}, catalog)).map((row) => row.id), ["mpA"]);
  await assert.rejects(upsertMerchantPrice("A", { merchantId: "mB", productId: "pA", priceCents: 1 }, catalog), notFound);
  await assert.rejects(upsertMerchantPrice("A", { merchantId: "mA", productId: "pB", priceCents: 1 }, catalog), notFound);
  await assert.rejects(deleteMerchantPrice("A", "mpB", catalog), notFound);

  const adminOrders = db as unknown as AdminOrderDb;
  await assert.rejects(getAdminOrder("A", "oB", MORNING, adminOrders), notFound);
  await assert.rejects(correctAdminOrder(ADMIN_A, "oB", { lines: [{ productId: "pB", quantity: 1 }] }, MORNING, adminOrders), notFound);
  await assert.rejects(cancelAdminOrder(ADMIN_A, "oB", { note: "essai" }, MORNING, adminOrders), notFound);

  const merchantOrders = db as unknown as OrderDb;
  const clientA = { companyId: "A", merchantId: "mA", userId: "clientA" };
  await assert.rejects(getMerchantOrder(clientA, "oB", MORNING, merchantOrders), notFound);
  await assert.rejects(cancelMerchantOrder(clientA, "oB", MORNING, merchantOrders), notFound);

  const rounds = db as unknown as RoundDb;
  await assert.rejects(assignRoundDriver(ADMIN_A, "rndB", "driverA", { db: rounds, now: ROUND_DAY, notifyDriver: async () => undefined }), notFound);
  await assert.rejects(reorderRoundStops(ADMIN_A, "rndB", ["sB"], { db: rounds, now: ROUND_DAY }), notFound);
  await assert.rejects(moveStop(ADMIN_A, "sB", { roundId: "rndA" }, { db: rounds, now: ROUND_DAY }), notFound);

  const driver = db as unknown as DriverRoundDb;
  const driverA = { companyId: "A", userId: "driverA" };
  const view = await getDriverRounds(driverA, { now: ROUND_DAY, db: driver });
  assert.deepEqual(view.rounds.map((round) => round.id), ["rndA"]);
  await assert.rejects(markStopDelivered(driverA, "sB", { now: ROUND_DAY, db: driver, kick: () => undefined }), notFound);

  const invoices = db as unknown as InvoiceQueryDb;
  await assert.rejects(getAdminInvoice("A", "invB", { now: MORNING }, invoices), notFound);
  await assert.rejects(listMerchantInvoices({ companyId: "A", merchantId: "mB" }, { periodType: "MONTHLY", date: "2026-10-15" }, MORNING, invoices), notFound);
  assert.equal(snapshot(tables), before);
});
