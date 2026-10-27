import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/(back-office)/admin/support/page.tsx", "utf8");

test("ADMIN-1 support plateforme : la page lit le hook dédié et les trois états", () => {
  assert.equal(page.includes("useAdminSupportTickets({ q, status, priority, page, pageSize })"), true);
  assert.equal(page.includes('from "@/features/admin/hooks"'), true);
  assert.equal(page.includes("isInitialQueryLoading(isLoading, data)"), true);
  assert.equal(page.includes("<PageSkeleton />"), true);
  assert.equal(page.includes("error || !data"), true);
  assert.equal(page.includes("Tickets indisponibles"), true);
  assert.equal(page.includes("data.total === 0"), true);
  assert.equal(page.includes("Aucun ticket"), true);
});

test("ADMIN-1 support plateforme : recherche, filtres et pagination restent dans le source", () => {
  assert.equal(page.includes("Entreprise"), true);
  assert.equal(page.includes('placeholder="Nom"'), true);
  for (const status of ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]) assert.equal(page.includes(status), true, status);
  for (const priority of ["LOW", "NORMAL", "HIGH", "URGENT"]) assert.equal(page.includes(priority), true, priority);
  for (const size of ["25", "50", "100"]) assert.equal(page.includes(`<SelectItem value="${size}">${size}</SelectItem>`), true, size);
  assert.equal(page.includes("Précédent"), true);
  assert.equal(page.includes("Suivant"), true);
  assert.equal(page.includes("Page {page} / {pageCount}"), true);
});

test("ADMIN-1 support plateforme : l'affichage reste limité aux métadonnées", () => {
  const fields = [...page.matchAll(/row\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(fields)].sort(), [
    "company",
    "contactType",
    "createdAt",
    "id",
    "priority",
    "relatedDeliveryReference",
    "relatedOrderReference",
    "status",
    "updatedAt",
  ]);
  assert.equal(page.includes("key={row.id}"), true);
  assert.equal(page.includes("<TableHead>Entreprise</TableHead>"), true);
  assert.equal(page.includes("<TableHead>Statut</TableHead>"), true);
  assert.equal(page.includes("<TableHead>Priorité</TableHead>"), true);
  assert.equal(page.includes("<TableHead>Type</TableHead>"), true);
  assert.equal(page.includes("<TableHead>Commande</TableHead>"), true);
  assert.equal(page.includes("<TableHead>Livraison</TableHead>"), true);
  assert.equal(page.includes("row.contactType"), true);
  for (const absent of [
    "row.subject",
    "row.message",
    "row.email",
    "row.phone",
    "row.user",
    "row.customer",
    "relatedOrderId",
    "relatedDeliveryId",
    "href=",
    "next/link",
    "Répondre",
    "Clôturer",
    "Supprimer",
  ]) {
    assert.equal(page.includes(absent), false, absent);
  }
});
