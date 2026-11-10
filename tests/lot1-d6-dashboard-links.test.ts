/**
 * Lot 1, demande 6 — tableau de bord cliquable : chaque chiffre ouvre la liste détaillée qui lui
 * correspond (commandes du jour, tournées, livrés, restants, problèmes signalés), même à zéro.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { matchesView } from "../src/domains/order/admin-order.service";
import { adminOrdersQuerySchema } from "../src/lib/validations/order";

type Row = Parameters<typeof matchesView>[0];
const rows: Array<Row & { id: string }> = [
  { id: "brouillon", status: "DRAFT", stopStatus: null, incident: false },
  { id: "annulee", status: "CANCELLED", stopStatus: null, incident: false },
  { id: "a-livrer", status: "LOCKED", stopStatus: "PENDING", incident: false },
  { id: "livree", status: "DELIVERED", stopStatus: "DELIVERED", incident: false },
  { id: "probleme", status: "PREPARED", stopStatus: "INCIDENT", incident: true },
  { id: "probleme-puis-livree", status: "DELIVERED", stopStatus: "DELIVERED", incident: true },
  { id: "sans-tournee", status: "VALIDATED", stopStatus: null, incident: false },
];
const ids = (view: Parameters<typeof matchesView>[1]) => rows.filter((row) => matchesView(row, view)).map((row) => row.id);

test("lot 1, demande 6 : les vues de la liste des commandes reprennent les définitions des chiffres", () => {
  assert.deepEqual(ids("active"), ["a-livrer", "livree", "probleme", "probleme-puis-livree", "sans-tournee"], "commandes du jour : hors brouillons et annulées");
  assert.deepEqual(ids("delivered"), ["livree", "probleme-puis-livree"]);
  assert.deepEqual(ids("remaining"), ["a-livrer"]);
  assert.deepEqual(ids("incidents"), ["probleme", "probleme-puis-livree"], "problèmes signalés, même livrés ensuite");
  assert.equal(ids(null).length, rows.length);
  assert.equal(adminOrdersQuerySchema.safeParse({ date: "2026-11-10", view: "incidents" }).success, true);
  assert.equal(adminOrdersQuerySchema.safeParse({ date: "2026-11-10", view: "tout" }).success, false);
});

test("lot 1, demande 6 : aucun chiffre du tableau de bord ne reste inactif", () => {
  const source = readFileSync("src/features/rounds/live-dashboard-content.tsx", "utf8");
  const cards = source.split("\n").filter((line) => line.includes("<StatCard "));
  assert.equal(cards.length, 5);
  for (const card of cards) assert.match(card, /href=\{/, card);
  for (const view of ["active", "delivered", "remaining", "incidents"]) assert.match(source, new RegExp(`ordersHref\\(data\\.date, "${view}"\\)`));
  assert.match(source, /\/dashboard\/rounds\?date=\$\{data\.date\}/);
  // Une carte avec lien reste cliquable à zéro (pas de condition sur la valeur).
  const card = readFileSync("src/components/ui/stat-card.tsx", "utf8");
  assert.match(card, /if \(href\) \{[\s\S]*?<Link href=\{href\}/);
});
