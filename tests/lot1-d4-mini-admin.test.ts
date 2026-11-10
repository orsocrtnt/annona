import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { SystemRole } from "@prisma/client";
import { ROLE_PERMISSIONS } from "../prisma/reference-data";
import { updateCompanyAccount, type AccountAdminDb } from "../src/domains/user/account-admin.service";
import { companyNavItems } from "../src/features/navigation/nav-config";
import {
  MINI_ADMIN_MODULE_IDS,
  MINI_ADMIN_MODULES,
  effectivePermissions,
  miniAdminModules,
  withMiniAdminModules,
  type MiniAdminModuleId,
} from "../src/lib/permissions/mini-admin";
import { PAGE_ACCESS_RULES, canOpenPage, evaluatePageAccess, getHomePath, getPageAccessRule } from "../src/lib/permissions/page-access";
import { updateAccountSchema } from "../src/lib/validations/company-admin";
import { createUserSchema } from "../src/lib/validations/user";
import { createMemoryDb } from "./helpers/memory-db";

/**
 * Lot 1, demande 4 — comptes « mini admin ». Vérifications du document :
 * 1. l'administrateur crée un mini admin avec seulement « Commandes » et « Suivi des livreurs » ;
 * 2. connecté, le menu n'affiche que ces fonctionnalités ;
 * 3. l'adresse de la page des prix tapée à la main est bloquée ;
 * 4. toutes les fonctionnalités cochées : tout l'espace administrateur ;
 * 5. « Commandes » retirée : la page des commandes disparaît aussitôt (droits relus à chaque requête).
 */

const ADMIN_PERMISSIONS = [...ROLE_PERMISSIONS.ADMIN];

/** Sujet tel que le serveur le relit à chaque requête (middleware, API) : rôle, réglages, permissions. */
function subjectFor(settings: unknown) {
  const user = { settings, role: { systemRole: "ADMIN" as SystemRole } };
  const modules = miniAdminModules(user);
  return { role: "ADMIN" as SystemRole, permissions: effectivePermissions(ADMIN_PERMISSIONS, modules), modules };
}

const menu = (subject: ReturnType<typeof subjectFor>) => companyNavItems.filter((item) => canOpenPage(item.href, subject)).map((item) => item.title);

test("LOT1-D4 vérifications 1 et 2 : « Commandes » et « Suivi des livreurs » seulement → menu réduit", () => {
  const subject = subjectFor(withMiniAdminModules({}, ["orders", "tracking"]));
  assert.deepEqual(subject.modules, ["orders", "tracking"]);
  assert.deepEqual(menu(subject), ["Commandes", "Suivi livreurs"]);
  assert.equal(canOpenPage("/dashboard/orders", subject), true);
  assert.equal(canOpenPage("/dashboard/orders/abc", subject), true, "détail d'une commande");
  assert.equal(canOpenPage("/dashboard/tracking", subject), true);
  assert.equal(getHomePath(subject), "/dashboard/orders", "accueil : première fonctionnalité accordée");
  // Permissions effectives : celles des deux modules, rien d'autre.
  assert.deepEqual([...subject.permissions].sort(), ["orders:create", "orders:read", "orders:update", "tracking:read"]);
});

test("LOT1-D4 vérification 3 : la page des prix (et toute autre) tapée à la main est bloquée", () => {
  const subject = subjectFor(withMiniAdminModules({}, ["orders", "tracking"]));
  for (const path of ["/dashboard/catalog", "/dashboard/promotions", "/dashboard", "/dashboard/rounds", "/dashboard/merchants/m1", "/users", "/settings", "/settings/billing", "/dashboard/invoices", "/support"]) {
    assert.equal(canOpenPage(path, subject), false, path);
    assert.deepEqual(evaluatePageAccess(path, subject), { kind: "redirect", location: "/dashboard/orders" }, path);
  }
  // Les API suivent les permissions : ni catalogue, ni prix, ni comptes.
  for (const permission of ["catalog:read", "catalog:manage", "promotions:read", "users:read", "settings:read", "invoices:read", "dashboard:company"]) {
    assert.equal(subject.permissions.includes(permission), false, permission);
  }
});

test("LOT1-D4 vérification 4 : toutes les fonctionnalités cochées → tout l'espace administrateur", () => {
  const all = subjectFor(withMiniAdminModules({}, [...MINI_ADMIN_MODULE_IDS]));
  const full = subjectFor({});
  assert.equal(full.modules, null, "administrateur complet");
  assert.deepEqual(menu(all), menu(full));
  assert.deepEqual(menu(all), companyNavItems.map((item) => item.title));
  for (const rule of PAGE_ACCESS_RULES.filter((row) => row.roles.includes("ADMIN"))) {
    assert.equal(canOpenPage(rule.path, all), true, rule.path);
  }
  assert.equal(getHomePath(all), "/dashboard");
});

test("LOT1-D4 vérification 5 : « Commandes » retirée → la page des commandes est refusée dès la requête suivante", () => {
  const before = subjectFor(withMiniAdminModules({}, ["orders", "tracking", "rounds"]));
  assert.equal(canOpenPage("/dashboard/orders", before), true);
  // L'administrateur enregistre de nouveaux réglages ; le serveur les relit à la requête suivante.
  const after = subjectFor(withMiniAdminModules({ miniAdmin: { modules: ["orders", "tracking", "rounds"] } }, ["tracking", "rounds"]));
  assert.equal(canOpenPage("/dashboard/orders", after), false);
  assert.equal(after.permissions.includes("orders:read"), false, "API des commandes refusées");
  assert.deepEqual(evaluatePageAccess("/dashboard/orders", after), { kind: "redirect", location: "/dashboard/tracking" });
  assert.deepEqual(menu(after), ["Suivi livreurs", "Tournées"]);
  // Aucune fonctionnalité : aucun écran.
  const none = subjectFor(withMiniAdminModules({}, []));
  assert.deepEqual(evaluatePageAccess("/dashboard", none), { kind: "forbidden" });
});

test("LOT1-D4 : réglages illisibles ou autres rôles n'ouvrent jamais plus", () => {
  assert.deepEqual(miniAdminModules({ settings: { miniAdmin: "tout" }, role: { systemRole: "ADMIN" } }), []);
  assert.deepEqual(miniAdminModules({ settings: { miniAdmin: { modules: ["orders", "pirate", 3] } }, role: { systemRole: "ADMIN" } }), ["orders"]);
  assert.equal(miniAdminModules({ settings: { miniAdmin: { modules: ["orders"] } }, role: { systemRole: "DRIVER" } }), null, "réservé au rôle administrateur");
  assert.equal(miniAdminModules({ settings: null, role: { systemRole: "ADMIN" } }), null);
  assert.deepEqual(withMiniAdminModules({ deactivatedFromStatus: "ACTIVE", miniAdmin: { modules: ["orders"] } }, null), { deactivatedFromStatus: "ACTIVE" });
});

test("LOT1-D4 : chaque page de l'administrateur appartient à une fonctionnalité, chaque fonctionnalité à des permissions du rôle", () => {
  for (const rule of PAGE_ACCESS_RULES.filter((row) => row.roles.includes("ADMIN"))) {
    assert.ok(rule.module, `${rule.path} sans fonctionnalité`);
  }
  for (const module of MINI_ADMIN_MODULES) {
    for (const path of module.paths) assert.equal(getPageAccessRule(path)?.module, module.id, path);
    for (const permission of module.permissions) assert.ok(ADMIN_PERMISSIONS.includes(permission as never), `${module.id} : ${permission}`);
  }
  for (const item of companyNavItems) assert.ok(getPageAccessRule(item.href)?.module, item.href);
  assert.deepEqual(MINI_ADMIN_MODULES.map((module) => module.label), [
    "Tableau de bord", "Commandes", "Suivi des livreurs", "Tournées", "Catalogue et prix", "Promotions",
    "Comptes clients, boulangers et livreurs", "Paramètres", "Facturation et paiements", "Support",
  ]);
});

test("LOT1-D4 : saisie des fonctionnalités (rôle administrateur seulement, codes connus)", () => {
  const base = { firstName: "Mina", lastName: "Admin", email: "mina@exemple.test" };
  assert.equal(createUserSchema.safeParse({ ...base, roleSlug: "admin", miniAdminModules: ["orders", "tracking"] }).success, true);
  assert.equal(createUserSchema.safeParse({ ...base, roleSlug: "driver", miniAdminModules: ["orders"] }).success, false);
  assert.equal(createUserSchema.safeParse({ ...base, roleSlug: "admin", miniAdminModules: ["pirate"] }).success, false);
  assert.equal(updateAccountSchema.safeParse({ miniAdminModules: null }).success, true);
});

// ---------------------------------------------------------------------------
// Règles des comptes
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;
function accounts() {
  const user = (id: string, roleId: string, extra: Row = {}) => ({
    id, companyId: "A", roleId, merchantId: null, email: `${id}@exemple.test`, firstName: "Prénom", lastName: id, phone: null,
    status: "ACTIVE", settings: {}, updatedAt: new Date(0), ...extra,
  });
  const tables: Record<string, Row[]> = {
    role: [
      { id: "rAdmin", slug: "admin", name: "Administrateur", systemRole: "ADMIN" },
      { id: "rDriver", slug: "driver", name: "Livreur", systemRole: "DRIVER" },
      { id: "rBaker", slug: "baker", name: "Boulanger", systemRole: "BAKER" },
    ],
    user: [
      user("admin1", "rAdmin"),
      user("mini1", "rAdmin", { settings: { miniAdmin: { modules: ["orders", "accounts"] } } }),
      user("driver1", "rDriver"),
      user("adminB", "rAdmin", { companyId: "B" }),
    ],
    merchant: [],
    auditLog: [],
  };
  return { tables, db: createMemoryDb(tables) as unknown as AccountAdminDb };
}
const FULL = { companyId: "A", userId: "admin1", fullAdmin: true };
const MINI = { companyId: "A", userId: "mini1", fullAdmin: false };
const modulesOf = (tables: Record<string, Row[]>, id: string) =>
  miniAdminModules({ settings: tables.user!.find((row) => row.id === id)!.settings, role: { systemRole: "ADMIN" } });

test("LOT1-D4 : l'administrateur choisit et modifie à tout moment les fonctionnalités d'un mini admin (journalisé)", async () => {
  const { tables, db } = accounts();
  const view = await updateCompanyAccount(FULL, "mini1", { miniAdminModules: ["orders", "tracking"] }, db);
  assert.deepEqual(view.miniAdminModules, ["orders", "tracking"]);
  assert.deepEqual(modulesOf(tables, "mini1"), ["orders", "tracking"]);
  const audit = tables.auditLog!.at(-1)!;
  assert.deepEqual((audit.before as Row).miniAdminModules, ["orders", "accounts"]);
  assert.deepEqual((audit.after as Row).miniAdminModules, ["orders", "tracking"]);
  // Toutes cochées, puis administrateur complet.
  await updateCompanyAccount(FULL, "mini1", { miniAdminModules: [...MINI_ADMIN_MODULE_IDS] as MiniAdminModuleId[] }, db);
  assert.equal(modulesOf(tables, "mini1")!.length, MINI_ADMIN_MODULE_IDS.length);
  await updateCompanyAccount(FULL, "mini1", { miniAdminModules: null }, db);
  assert.equal(modulesOf(tables, "mini1"), null);
  // Un administrateur complet devient mini admin ; passer livreur efface les fonctionnalités.
  await updateCompanyAccount(FULL, "mini1", { miniAdminModules: ["orders"] }, db);
  await updateCompanyAccount(FULL, "mini1", { roleSlug: "driver" }, db);
  assert.equal((tables.user!.find((row) => row.id === "mini1")!.settings as Row).miniAdmin, undefined);
});

test("LOT1-D4 : seul un administrateur complet gère les comptes administrateur et mini admin", async () => {
  const { db } = accounts();
  const adminOnly = { code: "ADMIN_ONLY" };
  await assert.rejects(updateCompanyAccount(MINI, "admin1", { active: false }, db), adminOnly, "désactiver un administrateur");
  await assert.rejects(updateCompanyAccount(MINI, "mini1", { miniAdminModules: [...MINI_ADMIN_MODULE_IDS] as MiniAdminModuleId[] }, db), adminOnly, "s'accorder plus");
  await assert.rejects(updateCompanyAccount(MINI, "driver1", { roleSlug: "admin" }, db), adminOnly, "promouvoir un livreur");
  // Un mini admin « comptes » gère les livreurs, boulangers et clients.
  const driver = await updateCompanyAccount(MINI, "driver1", { firstName: "Paul", active: false }, db);
  assert.equal(driver.status, "INACTIVE");
  // Compte d'une autre entreprise : introuvable.
  await assert.rejects(updateCompanyAccount(FULL, "adminB", { miniAdminModules: ["orders"] }, db), { code: "USER_NOT_FOUND" });
});

test("LOT1-D4 : ni ses propres fonctionnalités, ni perdre le dernier administrateur complet", async () => {
  const { db } = accounts();
  await assert.rejects(updateCompanyAccount(FULL, "admin1", { miniAdminModules: ["orders"] }, db), { code: "CANNOT_CHANGE_OWN_MODULES" });
  // admin1 est le seul administrateur complet actif : mini1 ne compte pas.
  const other = { companyId: "A", userId: "mini1", fullAdmin: true };
  await assert.rejects(updateCompanyAccount(other, "admin1", { miniAdminModules: ["orders"] }, db), { code: "LAST_ADMIN" });
  await assert.rejects(updateCompanyAccount(other, "admin1", { active: false }, db), { code: "LAST_ADMIN" });
  await assert.rejects(updateCompanyAccount(FULL, "driver1", { miniAdminModules: ["orders"] }, db), { code: "MINI_ADMIN_ROLE" });
});

test("LOT1-D4 : les routes passent « administrateur complet » et les lectures partagées acceptent plusieurs permissions", () => {
  const read = (path: string) => readFileSync(path, "utf8");
  assert.match(read("src/app/api/users/route.ts"), /miniAdminModules\(auth\.context\.user\) === null/);
  assert.match(read("src/app/api/users/[id]/route.ts"), /fullAdmin: miniAdminModules\(guard\.actor\.user\) === null/);
  assert.match(read("src/app/api/catalog/promotions/route.ts"), /requireCompanyAdmin\("promotions:read"\)/);
  assert.match(read("src/app/api/catalog/products/route.ts"), /requireCompanyAdminAny\(\["catalog:read", "orders:update", "promotions:read"\]\)/);
  assert.match(read("src/app/api/company/zones/route.ts"), /requireCompanyAdminAny\(\["settings:read", "merchants:read"\]\)/);
  assert.match(read("src/middleware.ts"), /modules: miniAdminModules\(auth\.user\)/);
});
