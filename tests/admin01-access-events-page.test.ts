import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { adminNavItems, companyNavItems } from "../src/features/navigation/nav-config";
import { PLATFORM_ACCESS_RESOURCES } from "../src/domains/admin/platform-access.service";

const page = readFileSync("src/app/(back-office)/admin/access-events/page.tsx", "utf8");
const api = readFileSync("src/features/admin/api.ts", "utf8");
const hooks = readFileSync("src/features/admin/hooks.ts", "utf8");

test("ADMIN-1 journal : la page lit le hook dédié et les trois états", () => {
  assert.equal(page.includes("useAdminAccessEvents({ resource, decision, page, pageSize })"), true);
  assert.equal(page.includes('from "@/features/admin/hooks"'), true);
  assert.equal(page.includes("isInitialQueryLoading(isLoading, data)"), true);
  assert.equal(page.includes("<PageSkeleton />"), true);
  assert.equal(page.includes("error || !data"), true);
  assert.equal(page.includes("Journal indisponible"), true);
  assert.equal(page.includes("data.total === 0"), true);
  assert.equal(page.includes("Aucun accès journalisé"), true);
});

test("ADMIN-1 journal : filtres, tailles et pagination restent dans le source", () => {
  for (const resource of PLATFORM_ACCESS_RESOURCES) assert.equal(page.includes(resource), true, resource);
  assert.equal(page.includes("ALLOWED"), true);
  assert.equal(page.includes("DENIED"), true);
  for (const size of ["25", "50", "100"]) assert.equal(page.includes(`<SelectItem value="${size}">${size}</SelectItem>`), true, size);
  assert.equal(page.includes("Précédent"), true);
  assert.equal(page.includes("Suivant"), true);
  assert.equal(page.includes("Page {page} / {pageCount}"), true);
  assert.equal(page.includes("placeholder"), false);
});

test("ADMIN-1 journal : l'écran n'affiche que les champs autorisés", () => {
  const fields = [...page.matchAll(/row\.(\w+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(fields)].sort(), ["actorId", "decision", "id", "occurredAt", "resource", "role"]);
  assert.equal(page.includes("key={row.id}"), true);
  for (const absent of ["expiresAt", "method", "email", "e-mail", "href=", "next/link", "Exporter", "Supprimer", "Rechercher"]) {
    assert.equal(page.includes(absent), false, absent);
  }
  assert.equal(/\bnom\b/i.test(page), false);
  assert.equal(/\bURL\b/.test(page), false);
  assert.equal(/\burl\b/.test(page), false);
  assert.equal(/\bIP\b/.test(page), false);
});

test("ADMIN-1 journal : le lien plateforme, le fetch et le hook restent en lecture", () => {
  assert.equal(adminNavItems.find((item) => item.title === "Journal d'accès")?.href, "/admin/access-events");
  assert.equal(companyNavItems.some((item) => item.href === "/admin/access-events"), false);
  assert.equal(api.includes('fetch(`/api/admin/access-events?${params.toString()}`, { cache: "no-store" })'), true);
  const fetchStart = api.indexOf("export async function fetchAdminAccessEvents");
  const fetchEnd = api.indexOf("export async function fetchAdminSupportTickets");
  assert.equal(api.slice(fetchStart, fetchEnd).includes('params.set("q"'), false);
  const hookStart = hooks.indexOf("export function useAdminAccessEvents");
  const hookEnd = hooks.indexOf("export function useAdminSupportTickets");
  assert.equal(hooks.slice(hookStart, hookEnd).includes("refetchInterval"), false);
});
