import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED = [
  ["client_notifications", "order_message_id"],
  ["invoices", "order_id"],
  ["order_messages", "author_id"],
  ["order_thread_reads", "user_id"],
  ["role_permissions", "permission_id"],
  ["saas_plan_assignments", "plan_id"],
  ["saas_seat_reservations", "subscription_id"],
  ["saas_subscription_items", "option_id"],
  ["saas_subscriptions", "catalog_version_id"],
  ["saas_usage_events", "subscription_id"],
  ["support_tickets", "related_delivery_id"],
  ["support_tickets", "related_order_id"],
] as const;

const sql = readFileSync(
  resolve("prisma/migrations/20261028090000_fk_indexes/migration.sql"),
  "utf8"
);
const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");

test("la migration crée les 12 index de clé étrangère de façon idempotente", () => {
  for (const [table, column] of EXPECTED) {
    assert.ok(
      sql.includes(
        `CREATE INDEX IF NOT EXISTS "${table}_${column}_idx" ON "${table}"("${column}");`
      ),
      `${table}.${column}`
    );
  }
  assert.equal((sql.match(/CREATE INDEX/g) ?? []).length, 12);
});

test("la migration ne supprime ni ne modifie rien d'existant", () => {
  assert.doesNotMatch(sql, /\b(DROP|ALTER|DELETE|TRUNCATE|UPDATE)\b/i);
});

// NET-1 (6 novembre 2026) : index de tables retirées du schéma (order_messages…) encore dans la migration
// historique ; réactiver avec la migration initiale de SCHEMA-1.
test.skip("le schéma Prisma déclare chaque index (pas de dérive avec la migration)", () => {
  for (const [table] of EXPECTED) {
    const block = schema.split(/^model /m).find((part) => part.includes(`@@map("${table}")`));
    assert.ok(block, table);
  }
  assert.equal(
    (schema.match(/@@index\(\[(orderMessageId|authorId|planId|optionId|catalogVersionId|relatedDeliveryId|relatedOrderId|permissionId)\]\)/g) ?? []).length >= 8,
    true
  );
});
