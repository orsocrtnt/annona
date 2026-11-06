import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../prisma/reference-data";

// SCHEMA-1 : contraintes clés du nouveau modèle, lues dans le schéma Prisma et la migration initiale.
const schema = readFileSync("prisma/schema.prisma", "utf8");
const sql = readFileSync("prisma/migrations/20261106200000_init/migration.sql", "utf8");

const models = new Map(
  [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((match) => [match[1]!, match[2]!] as const)
);

/** Seules exceptions à « toute entité porte companyId » (PLA-01), chacune motivée en tête du schéma. */
const WITHOUT_COMPANY = new Set(["Company", "Role", "Permission", "RolePermission", "AuthLoginFailure"]);
const OPTIONAL_COMPANY = new Set(["User", "OperationJob"]);

test("PLA-01 : toutes les entités sauf l'entreprise portent companyId, indexé en tête", () => {
  assert.ok(models.size >= 29, `modèles lus : ${models.size}`);
  for (const [name, body] of models) {
    if (WITHOUT_COMPANY.has(name)) {
      assert.doesNotMatch(body, /^\s+companyId\s/m, `${name} : exception documentée, sans companyId`);
      continue;
    }
    const field = /^\s+companyId\s+(String\??)/m.exec(body);
    assert.ok(field, `${name} : companyId manquant`);
    assert.equal(field[1], OPTIONAL_COMPANY.has(name) ? "String?" : "String", `${name} : companyId ${OPTIONAL_COMPANY.has(name) ? "facultatif" : "obligatoire"}`);
    assert.match(body, /@relation\(fields: \[companyId\], references: \[id\]/, `${name} : relation vers Company`);
    const indexed =
      /@@(?:index|unique|id)\(\[companyId\b/.test(body) || /companyId\s+String\s+@id/.test(body);
    assert.ok(indexed, `${name} : aucun index qui commence par companyId`);
  }
});

test("CLI-05 : une seule commande par commerçant, date de livraison et créneau", () => {
  assert.match(models.get("Order")!, /@@unique\(\[merchantId, deliveryDate, slotId\]\)/);
  assert.match(sql, /CREATE UNIQUE INDEX "orders_merchant_id_delivery_date_slot_id_key" ON "orders"\("merchant_id", "delivery_date", "slot_id"\);/);
  // La date de livraison est un jour civil, sans heure (pas de décalage UTC / Paris possible).
  assert.match(sql, /"delivery_date" DATE NOT NULL/);
  assert.match(sql, /CREATE UNIQUE INDEX "orders_company_id_reference_key" ON "orders"\("company_id", "reference"\);/);
});

test("RG-05 : un seul prix spécifique par commerçant et produit ; prix figé vide jusqu'au verrouillage", () => {
  assert.match(sql, /CREATE UNIQUE INDEX "merchant_prices_merchant_id_product_id_key" ON "merchant_prices"\("merchant_id", "product_id"\);/);
  assert.match(sql, /"unit_price_frozen_cents" INTEGER,/);
  assert.match(sql, /"quantity_delivered" INTEGER,/);
  assert.match(sql, /CREATE UNIQUE INDEX "order_lines_order_id_product_id_key" ON "order_lines"\("order_id", "product_id"\);/);
});

test("statuts, origines, rôles et modes de règlement attendus par le cahier des charges", () => {
  const values = (name: string) => /CREATE TYPE "(\w+)" AS ENUM \(([^)]*)\)/g;
  const enums = new Map([...sql.matchAll(values(""))].map((match) => [match[1]!, [...match[2]!.matchAll(/'(\w+)'/g)].map((v) => v[1]!)]));
  assert.deepEqual(enums.get("SystemRole"), ["SUPER_ADMIN", "ADMIN", "BAKER", "DRIVER", "MERCHANT"]);
  assert.deepEqual(enums.get("OrderStatus"), ["DRAFT", "VALIDATED", "LOCKED", "PREPARED", "DELIVERED", "CANCELLED"]);
  assert.deepEqual(enums.get("OrderOrigin"), ["MANUAL", "RECURRING"]);
  assert.deepEqual(enums.get("BillingPeriod"), ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
  assert.deepEqual(enums.get("PaymentMethod"), ["VIREMENT", "PRELEVEMENT", "ESPECES"]);
  for (const legacy of ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER", "CLIENT", "INVOICED", "PURCHASING"]) {
    assert.doesNotMatch(sql, new RegExp(`'${legacy}'`), legacy);
  }
});

test("montants en centimes entiers, aucune colonne décimale ni JSON de lignes", () => {
  assert.doesNotMatch(sql, /DECIMAL/);
  const centsColumns = [...sql.matchAll(/^ {4}"(\w+_cents)" (\w+)/gm)];
  assert.ok(centsColumns.length >= 9, `colonnes en centimes : ${centsColumns.length}`);
  for (const column of centsColumns) assert.equal(column[2], "INTEGER", column[1]);
  assert.doesNotMatch(sql, /"line_items"|"pod_signature|"pickup_/);
});

test("entreprise : heure limite 17:00, fuseau Europe/Paris et délai du rappel par défaut", () => {
  assert.match(sql, /"cutoff_time" TEXT NOT NULL DEFAULT '17:00'/);
  assert.match(sql, /"timezone" TEXT NOT NULL DEFAULT 'Europe\/Paris'/);
  assert.match(sql, /"reminder_lead_minutes" INTEGER NOT NULL DEFAULT 120/);
});

test("contraintes métier en base (CHECK) : quantités, prix, heures, jours et totaux", () => {
  for (const name of [
    "companies_cutoff_time_format", "slots_time_format", "slots_start_before_end", "products_base_price_cents_positive",
    "merchant_prices_price_cents_positive", "order_lines_quantity_ordered_positive", "order_lines_quantity_delivered_range",
    "recurring_orders_weekdays_valid", "recurring_order_lines_quantity_positive", "stops_sequence_positive",
    "invoices_period_order", "invoices_total_consistent", "invoice_lines_total_consistent", "payments_amount_positive",
  ]) {
    assert.match(sql, new RegExp(`ADD CONSTRAINT "${name}" CHECK `), name);
  }
  // Un manquant réduit la quantité livrée, jamais au-delà de la commande (RG-06).
  assert.match(sql, /"quantity_delivered" >= 0 AND "quantity_delivered" <= "quantity_ordered"/);
});

test("rôles et permissions de la migration identiques à prisma/reference-data.ts", () => {
  for (const permission of PERMISSIONS) assert.ok(sql.includes(`'${permission.slug}'`), permission.slug);
  for (const role of ROLES) assert.ok(sql.includes(`'rbac_role_${role.slug.replace(/-/g, "_")}'`), role.slug);
  const pairs = [...sql.matchAll(/\('rbac_role_(\w+)', 'rbac_permission_(\w+)'\)/g)].map((match) => `${match[1]}:${match[2]}`).sort();
  const expected = ROLES.flatMap((role) =>
    ROLE_PERMISSIONS[role.systemRole].map((slug) => `${role.slug.replace(/-/g, "_")}:${slug.replace(":", "_")}`)
  ).sort();
  assert.deepEqual(pairs, expected);
  // Le super-administrateur n'a aucune permission d'opération courante (section 3 du cahier des charges).
  for (const slug of ROLE_PERMISSIONS.SUPER_ADMIN) assert.match(slug, /^(companies|users|support|dashboard):/, slug);
});
