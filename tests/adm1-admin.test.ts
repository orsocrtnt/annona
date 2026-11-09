/**
 * ADM-1 — comptes (ADM-01) et désactivation, rattachement d'un compte client à un client, fiches clients,
 * créneaux et paramètres (ADM-09, PLA-03, PLA-04), entreprises du super-administrateur (PLA-02) et
 * suspension. Base en mémoire (`helpers/memory-db.ts`), invitation Supabase remplacée par un témoin.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createCompanyWithAdmin, slugify, type AuthInviter, type CompanyAdminDb } from "../src/domains/admin/company-admin.service";
import { getCompanySettings, updateCompanySettings, type CompanySettingsDb } from "../src/domains/company/company-settings.service";
import { createSlotForAdmin, deleteSlotForAdmin, listSlotsForAdmin, reorderSlotsForAdmin, updateSlotForAdmin, type SlotAdminDb } from "../src/domains/company/slot-admin.service";
import { createMerchantForAdmin, updateMerchantForAdmin, type MerchantAdminDb } from "../src/domains/merchant/merchant-admin.service";
import { merchantsToRemind } from "../src/domains/notification/merchant-notification.service";
import { updateCompanyAccount, type AccountAdminDb } from "../src/domains/user/account-admin.service";
import { isAccountActive } from "../src/lib/auth/account-access";
import { companySettingsSchema, createMerchantSchema, updateAccountSchema, updateMerchantSchema } from "../src/lib/validations/company-admin";
import { createUserSchema } from "../src/lib/validations/user";
import type { UserWithRole } from "../src/types";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;

function fixture() {
  const user = (id: string, roleId: string, extra: Row = {}) => ({ id, companyId: "A", roleId, merchantId: null, email: `${id}@exemple.test`, firstName: "Prénom", lastName: id, phone: null, status: "ACTIVE", settings: {}, updatedAt: new Date(0), ...extra });
  const tables: Record<string, Row[]> = {
    company: [{ id: "A", name: "Boulangerie A", slug: "boulangerie-a", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120, settings: { billing: { invoice: { vatRate: 5.5 } } }, updatedAt: new Date(0) }],
    role: [
      { id: "rAdmin", slug: "admin", name: "Administrateur", systemRole: "ADMIN" },
      { id: "rBaker", slug: "baker", name: "Boulanger", systemRole: "BAKER" },
      { id: "rDriver", slug: "driver", name: "Livreur", systemRole: "DRIVER" },
      { id: "rMerchant", slug: "merchant", name: "Client", systemRole: "MERCHANT" },
      { id: "rSuper", slug: "super-admin", name: "Super", systemRole: "SUPER_ADMIN" },
    ],
    user: [
      user("admin1", "rAdmin"),
      user("admin2", "rAdmin"),
      user("driver1", "rDriver"),
      user("invited", "rBaker", { status: "PENDING_VERIFICATION" }),
      user("client1", "rMerchant", { merchantId: "m1" }),
      user("root", "rSuper", { companyId: "A" }),
    ],
    merchant: [{ id: "m1", companyId: "A", name: "Café Un", tradeName: null, address: "1 rue", active: true, latitude: 48.8, longitude: 2.3, billingPeriod: "MONTHLY" }],
    slot: [
      { id: "s5", companyId: "A", label: null, startTime: "05:00", endTime: "06:00", active: true, sortOrder: 0 },
      { id: "s6", companyId: "A", label: null, startTime: "06:00", endTime: "07:00", active: true, sortOrder: 1 },
    ],
    order: [{ id: "o1", companyId: "A", merchantId: "m1", slotId: "s6", deliveryDate: new Date("2026-11-10T00:00:00Z"), status: "VALIDATED" }],
    recurringOrder: [],
    round: [],
    auditLog: [],
  };
  return { tables, db: createMemoryDb(tables) };
}

const ADMIN = { companyId: "A", userId: "admin1" };

// ---------------------------------------------------------------------------
// Comptes (ADM-01)
// ---------------------------------------------------------------------------

test("ADM-01 : désactiver puis réactiver un compte (statut d'avant rendu), journalisé ; connexion et API refusées", async () => {
  const { tables, db } = fixture();
  const accounts = db as unknown as AccountAdminDb;
  const off = await updateCompanyAccount(ADMIN, "driver1", { active: false }, accounts);
  assert.equal(off.status, "INACTIVE");
  // Un compte désactivé n'a plus de session (connexion, pages et API relisent ce statut).
  const asUser = (status: string, companyStatus = "ACTIVE") =>
    ({ status, companyId: "A", company: { id: "A", status: companyStatus }, role: { systemRole: "DRIVER" } }) as unknown as UserWithRole;
  assert.equal(isAccountActive(asUser("INACTIVE")), false);
  assert.equal(isAccountActive(asUser("ACTIVE")), true);
  const on = await updateCompanyAccount(ADMIN, "driver1", { active: true }, accounts);
  assert.equal(on.status, "ACTIVE");
  // Invitation jamais acceptée : réactivé, le compte reste en attente.
  await updateCompanyAccount(ADMIN, "invited", { active: false }, accounts);
  assert.equal((await updateCompanyAccount(ADMIN, "invited", { active: true }, accounts)).status, "PENDING_VERIFICATION");
  const actions = tables.auditLog!.filter((row) => row.entityType === "User").map((row) => `${row.entityId}:${row.action}`);
  assert.deepEqual(actions, ["driver1:DEACTIVATE", "driver1:REACTIVATE", "invited:DEACTIVATE", "invited:REACTIVATE"]);
});

test("ADM-01 : pas d'auto-désactivation, pas de changement de son rôle, toujours un administrateur actif ; super-admin intouchable", async () => {
  const { db } = fixture();
  const accounts = db as unknown as AccountAdminDb;
  await assert.rejects(updateCompanyAccount(ADMIN, "admin1", { active: false }, accounts), { code: "CANNOT_DEACTIVATE_SELF" });
  await assert.rejects(updateCompanyAccount(ADMIN, "admin1", { roleSlug: "driver" }, accounts), { code: "CANNOT_CHANGE_OWN_ROLE" });
  await updateCompanyAccount(ADMIN, "admin2", { active: false }, accounts);
  // admin1 est désormais le seul administrateur actif : admin2 (actif à nouveau) ne peut pas être rétrogradé… sauf s'il en reste un.
  await updateCompanyAccount(ADMIN, "admin2", { active: true }, accounts);
  await updateCompanyAccount(ADMIN, "admin2", { roleSlug: "baker" }, accounts);
  await assert.rejects(updateCompanyAccount({ companyId: "A", userId: "admin2" }, "admin1", { active: false }, accounts), { code: "LAST_ADMIN" });
  await assert.rejects(updateCompanyAccount(ADMIN, "root", { active: false }, accounts), { status: 404 });
});

test("ADM-01 : un compte client est rattaché à un client de l'entreprise ; changer de rôle retire le rattachement", async () => {
  const { tables, db } = fixture();
  const accounts = db as unknown as AccountAdminDb;
  await assert.rejects(updateCompanyAccount(ADMIN, "driver1", { roleSlug: "merchant" }, accounts), { code: "MERCHANT_REQUIRED" });
  assert.equal((await updateCompanyAccount(ADMIN, "driver1", { roleSlug: "merchant", merchantId: "m1" }, accounts)).merchantId, "m1");
  await assert.rejects(updateCompanyAccount(ADMIN, "admin2", { merchantId: "m1" }, accounts), { code: "MERCHANT_NOT_ALLOWED" });
  const back = await updateCompanyAccount(ADMIN, "driver1", { roleSlug: "driver" }, accounts);
  assert.equal(back.merchantId, null);
  assert.equal(tables.user!.find((row) => row.id === "driver1")!.roleId, "rDriver");
  // Création : un compte client sans client est refusé dès la saisie ; le service le rattache (SCHEMA-1 corrigé).
  assert.equal(createUserSchema.safeParse({ firstName: "Léa", lastName: "Client", email: "lea@exemple.test", roleSlug: "merchant" }).success, false);
  assert.equal(createUserSchema.safeParse({ firstName: "Léa", lastName: "Client", email: "lea@exemple.test", roleSlug: "merchant", merchantId: "m1" }).success, true);
  const service = readFileSync("src/domains/user/user.service.ts", "utf8");
  assert.match(service, /prisma\.merchant\.findFirst\(\{ where: \{ id: input\.merchantId, companyId \}/);
  assert.match(service, /merchantId,\n\s+phone:/);
  // Saisie partielle : un champ absent n'efface rien (le téléphone reste tel quel).
  assert.equal(updateAccountSchema.parse({ active: false }).phone, undefined);
  assert.equal(updateMerchantSchema.parse({ active: false }).contactPhone, undefined);
});

// ---------------------------------------------------------------------------
// Fiches clients
// ---------------------------------------------------------------------------

test("ADM-1 clients : création avec position géocodée, modification, désactivation journalisées ; client désactivé sans rappel", async () => {
  const { tables, db } = fixture();
  const merchants = db as unknown as MerchantAdminDb;
  const input = createMerchantSchema.parse({ name: "Épicerie Deux", address: "2 rue de la Paix", postalCode: "75002", city: "Paris", latitude: 48.869, longitude: 2.331, accessInstructions: "Code 4521", billingPeriod: "WEEKLY", contactEmail: "" });
  assert.equal(input.contactEmail, null);
  const created = await createMerchantForAdmin(ADMIN, input, merchants);
  assert.equal(created.latitude, 48.869);
  assert.equal(created.billingPeriod, "WEEKLY");
  const moved = await updateMerchantForAdmin(ADMIN, created.id, { latitude: 48.87, longitude: 2.332 }, merchants);
  assert.equal(moved.longitude, 2.332);
  assert.equal(moved.accessInstructions, "Code 4521");
  const off = await updateMerchantForAdmin(ADMIN, created.id, { active: false }, merchants);
  assert.equal(off.active, false);
  assert.deepEqual(tables.auditLog!.filter((row) => row.entityType === "Merchant").map((row) => row.action), ["CREATE", "UPDATE", "DEACTIVATE"]);
  assert.equal(createMerchantSchema.safeParse({ name: "X", address: "1 rue", billingPeriod: "MONTHLY", latitude: 48.8 }).success, false);
  assert.equal(createMerchantSchema.safeParse({ name: "X", address: "1 rue", billingPeriod: "MONTHLY", siren: "12345" }).success, false);
  tables.recurringOrder = [];
  assert.equal((await merchantsToRemind(db as never, "A", "2026-11-11")).includes(created.id), false);
});

// ---------------------------------------------------------------------------
// Créneaux et paramètres (ADM-09, PLA-04)
// ---------------------------------------------------------------------------

test("ADM-09 : les fréquences du suivi GPS des livreurs ne sont pas proposées dans les paramètres", () => {
  const page = readFileSync("src/app/(back-office)/settings/page.tsx", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(page, /LocationSettings|location-settings|GPS/);
});

test("ADM-09 créneaux : créer, refuser un doublon, modifier, désactiver, ordonner ; un créneau utilisé ne se supprime pas", async () => {
  const { db } = fixture();
  const slots = db as unknown as SlotAdminDb;
  const afterCreate = await createSlotForAdmin("A", { label: null, startTime: "07:00", endTime: "08:00" }, slots);
  assert.deepEqual(afterCreate.map((slot) => slot.displayLabel), ["5h – 6h", "6h – 7h", "7h – 8h"]);
  await assert.rejects(createSlotForAdmin("A", { label: null, startTime: "07:00", endTime: "08:00" }, slots), { status: 409, code: "SLOT_DUPLICATE" });
  const s7 = afterCreate[2]!.id;
  await assert.rejects(updateSlotForAdmin("A", s7, { startTime: "09:00" }, slots), { code: "SLOT_INVALID" });
  assert.equal((await updateSlotForAdmin("A", s7, { label: "Tôt le matin" }, slots))[2]!.displayLabel, "Tôt le matin");
  // Utilisé par une commande : 409 à la suppression, désactivation possible.
  assert.equal((await listSlotsForAdmin("A", slots)).find((slot) => slot.id === "s6")!.used, true);
  await assert.rejects(deleteSlotForAdmin("A", "s6", slots), { status: 409, code: "SLOT_IN_USE" });
  assert.equal((await updateSlotForAdmin("A", "s6", { active: false }, slots)).find((slot) => slot.id === "s6")!.active, false);
  assert.deepEqual((await reorderSlotsForAdmin("A", [s7, "s6", "s5"], slots)).map((slot) => slot.id), [s7, "s6", "s5"]);
  await assert.rejects(reorderSlotsForAdmin("A", [s7, "s6"], slots), { code: "SLOT_ORDER_INVALID" });
  assert.deepEqual((await deleteSlotForAdmin("A", "s5", slots)).map((slot) => slot.id), [s7, "s6"]);
});

test("ADM-09, PLA-04 : heure limite, fuseau, délai du rappel, nom et unités ; autres réglages gardés ; écriture concurrente refusée", async () => {
  const { tables, db } = fixture();
  const settings = db as unknown as CompanySettingsDb;
  assert.deepEqual((await getCompanySettings("A", settings)).units, ["pièce", "kg", "plaque", "lot de 10"]);
  const updated = await updateCompanySettings(ADMIN, { name: "Boulangerie Nouvelle", cutoffTime: "16:30", timezone: "Europe/Paris", reminderLeadMinutes: 90, units: ["pièce", "kg", "pièce", " barquette "] }, settings);
  assert.deepEqual(updated, { name: "Boulangerie Nouvelle", cutoffTime: "16:30", timezone: "Europe/Paris", reminderLeadMinutes: 90, units: ["pièce", "kg", "barquette"] });
  assert.deepEqual((tables.company![0]!.settings as Row).billing, { invoice: { vatRate: 5.5 } });
  assert.equal(tables.auditLog!.filter((row) => row.entityType === "CompanySettings").length, 1);
  assert.equal(companySettingsSchema.safeParse({ cutoffTime: "25:00" }).success, false);
  assert.equal(companySettingsSchema.safeParse({ timezone: "Mars/Olympus" }).success, false);
  assert.equal(companySettingsSchema.safeParse({ reminderLeadMinutes: -5 }).success, false);
  // Écriture concurrente (la ligne a changé depuis la lecture) : refusée, rien n'est écrasé.
  const racing = {
    ...settings,
    company: { ...settings.company, updateMany: async () => ({ count: 0 }) },
  } as unknown as CompanySettingsDb;
  await assert.rejects(updateCompanySettings(ADMIN, { cutoffTime: "15:00" }, racing), /SETTINGS_CONFLICT/);
});

// ---------------------------------------------------------------------------
// Plateforme (PLA-02)
// ---------------------------------------------------------------------------

function inviter(options: { fail?: string } = {}) {
  const removed: string[] = [];
  const invited: string[] = [];
  const value: AuthInviter = {
    async invite(email) {
      if (options.fail) throw new Error(options.fail);
      invited.push(email);
      return { authId: `auth-${email}`, invited: false };
    },
    async remove(authId) {
      removed.push(authId);
    },
  };
  return { value, removed, invited };
}

test("PLA-02 : le super-administrateur crée une entreprise active avec trois créneaux et son administrateur invité", async () => {
  const { tables, db } = fixture();
  const fake = inviter();
  const created = await createCompanyWithAdmin(
    { name: "Boulangerie Été", cutoffTime: "18:00", timezone: "Europe/Paris", reminderLeadMinutes: 60, admin: { firstName: "Bea", lastName: "Martin", email: "bea@exemple.test" } },
    { db: db as unknown as CompanyAdminDb, inviter: fake.value }
  );
  const company = tables.company!.find((row) => row.id === created.companyId)!;
  assert.equal(company.status, "ACTIVE");
  assert.equal(company.slug, "boulangerie-ete");
  assert.equal(company.cutoffTime, "18:00");
  assert.equal(tables.slot!.filter((row) => row.companyId === created.companyId).length, 3);
  const admin = tables.user!.find((row) => row.id === created.adminUserId)!;
  assert.deepEqual([admin.companyId, admin.roleId, admin.status, admin.email], [created.companyId, "rAdmin", "PENDING_VERIFICATION", "bea@exemple.test"]);
  assert.deepEqual(fake.invited, ["bea@exemple.test"]);
  assert.equal(slugify("Boulangerie Été"), "boulangerie-ete");
  // E-mail déjà utilisé : refus avant toute création ; invitation refusée : aucune entreprise.
  await assert.rejects(createCompanyWithAdmin({ name: "X", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120, admin: { firstName: "A", lastName: "B", email: "admin1@exemple.test" } }, { db: db as unknown as CompanyAdminDb, inviter: fake.value }), { status: 409 });
  const before = tables.company!.length;
  await assert.rejects(createCompanyWithAdmin({ name: "Y", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120, admin: { firstName: "A", lastName: "B", email: "y@exemple.test" } }, { db: db as unknown as CompanyAdminDb, inviter: inviter({ fail: "AUTH_RATE_LIMITED" }).value }), { status: 429 });
  assert.equal(tables.company!.length, before);
  // Écriture impossible après l'invitation : le compte d'authentification est retiré.
  const broken = { ...(db as Record<string, unknown>), $transaction: async () => { throw new Error("db down"); } } as unknown as CompanyAdminDb;
  const cleanup = inviter();
  await assert.rejects(createCompanyWithAdmin({ name: "Z", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120, admin: { firstName: "A", lastName: "B", email: "z@exemple.test" } }, { db: broken, inviter: cleanup.value }), /db down/);
  assert.deepEqual(cleanup.removed, ["auth-z@exemple.test"]);
});

test("PLA-02 : entreprise suspendue = plus aucun accès pour ses utilisateurs ; création et configuration réservées au super-administrateur", () => {
  const user = (companyStatus: string) =>
    ({ status: "ACTIVE", companyId: "A", company: { id: "A", status: companyStatus }, role: { systemRole: "ADMIN" } }) as unknown as UserWithRole;
  assert.equal(isAccountActive(user("SUSPENDED")), false);
  assert.equal(isAccountActive(user("ACTIVE")), true);
  for (const file of ["src/app/api/admin/companies/route.ts", "src/app/api/admin/companies/[id]/config/route.ts"]) {
    const source = readFileSync(file, "utf8");
    for (const handler of source.split(/export async function (?:GET|POST|PATCH)/).slice(1)) {
      assert.match(handler, /requireRole\(auth\.context, \["SUPER_ADMIN"\]\)/, file);
    }
  }
  // L'accueil plateforme compte des commandes : le libellé le dit (plus « Livraisons »).
  assert.match(readFileSync("src/app/(back-office)/admin/page.tsx", "utf8"), /header: fr\.platform\.orders/);
  // Le super-administrateur ne cherche plus de commande.
  assert.doesNotMatch(readFileSync("src/domains/admin/search.service.ts", "utf8"), /db\.order\./);
});

test("ENF-07 : vocabulaire « client », « livreur », « tournée », « arrêt » ; plus de chauffeur, mission, dispatch ni coursier à l'écran", () => {
  const files = [
    "src/features/auth/login-space.ts",
    "src/features/auth/auth-form.tsx",
    "src/features/driver/driver-push-settings.tsx",
    "src/features/back-office/einvoicing-settings-card.tsx",
    "src/features/users/create-user-dialog.tsx",
    "src/app/api/users/[id]/route.ts",
  ];
  for (const file of files) {
    const visible = [...readFileSync(file, "utf8").matchAll(/"([^"]*)"|>([^<>{}]+)</g)].map((match) => match[1] ?? match[2] ?? "").join("\n");
    assert.doesNotMatch(visible, /\b(chauffeurs?|missions?|dispatch|coursiers?|commerçants?)\b/i, file);
  }
  const texts = readFileSync("src/lib/i18n/fr.ts", "utf8");
  for (const key of ["merchants: {", "accounts: {", "companySettings: {", "platform: {", "notifications: {"]) assert.ok(texts.includes(key), key);
});
