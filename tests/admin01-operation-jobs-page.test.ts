import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/(back-office)/admin/operations/page.tsx", "utf8");
const health = page.split("function HealthPanel")[1]?.split("export default")[0] ?? "";
const jobs = page.split("export default function AdminOperationsPage")[1] ?? "";
const projected = [
  "id",
  "company",
  "type",
  "status",
  "attempts",
  "maxAttempts",
  "nextAttemptAt",
  "lockedAt",
  "completedAt",
  "createdAt",
  "updatedAt",
  "stale",
];

test("ADMIN-1 file technique : recherche, filtres, pagination et états propres", () => {
  assert.equal(jobs.includes("useAdminOperationJobs({ q, status, type, page, pageSize })"), true);
  assert.equal(jobs.includes("Entreprise"), true);
  assert.equal(jobs.includes('placeholder="Nom"'), true);
  for (const status of ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED"]) assert.equal(page.includes(status), true, status);
  for (const type of ["DRIVER_NOTIFICATION", "CLIENT_NOTIFICATION"]) assert.equal(page.includes(type), true, type);
  for (const size of ["25", "50", "100"]) assert.equal(jobs.includes(`<SelectItem value="${size}">${size}</SelectItem>`), true, size);
  assert.equal(jobs.includes("Précédent"), true);
  assert.equal(jobs.includes("Suivant"), true);
  assert.equal(jobs.includes("Page {page} / {pageCount}"), true);
  assert.equal(jobs.includes("jobsLoading ? <PageSkeleton />"), true);
  assert.equal(jobs.includes("Traitements indisponibles"), true);
  assert.equal(jobs.includes("Aucun traitement"), true);
});

test("ADMIN-1 file technique : statut bloqué et seules les données projetées", () => {
  const fields = [...jobs.matchAll(/row\.(\w+)/g)].flatMap((match) => match[1] ? [match[1]] : []);
  assert.equal(fields.includes("stale"), true);
  assert.equal(jobs.includes('row.stale ? "Bloqué"'), true);
  for (const field of new Set(fields)) assert.equal(projected.includes(field), true, field);
  for (const absent of ["payload", "jobKey", "lastError", "Relancer", "href=", "next/link", "Réessayer"]) {
    assert.equal(page.includes(absent), false, absent);
  }
});

test("ADMIN-1 file technique : le panneau de santé reste indépendant", () => {
  assert.equal(health.includes("useAdminServiceHealth()"), true);
  assert.equal(health.includes("useAdminOperationJobs"), false);
  assert.equal(health.includes("Contrôle des services en cours."), true);
  assert.equal(health.includes("Santé indisponible"), true);
  assert.equal(jobs.includes("<HealthPanel />"), true);
  assert.equal(jobs.includes("jobsLoading ? <PageSkeleton />"), true);
});
