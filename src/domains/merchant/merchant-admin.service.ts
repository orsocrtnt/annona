/**
 * ADM-1 — fiches clients (les commerçants livrés) côté administrateur : liste, création, modification,
 * désactivation (ADM-01 côté client, ADM-03 depuis la fiche, CLI-02, LIV-01, ADM-10).
 *
 * L'entreprise vient toujours de la session (PLA-01) : un identifiant d'une autre entreprise est
 * introuvable (404). Un client désactivé ne commande plus (CMD-1 : `MERCHANT_INACTIVE`), ne reçoit plus de
 * rappel (NOT-01) et n'entre plus dans les tournées générées ; son historique (commandes, factures) reste.
 * Chaque création ou modification est journalisée (`AuditLog`, entité « Merchant », avant / après).
 */
import type { BillingPeriod, PaymentMethod, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { CreateMerchantInput, UpdateMerchantInput } from "@/lib/validations/company-admin";

export type MerchantAdminDb = Pick<PrismaClient, "merchant" | "user" | "order" | "auditLog" | "deliveryZone">;
const defaultDb = () => prisma as unknown as MerchantAdminDb;

export const MERCHANT_AUDIT_ENTITY = "Merchant";

export interface MerchantListRow {
  id: string;
  name: string;
  tradeName: string | null;
  address: string;
  postalCode: string | null;
  city: string | null;
  active: boolean;
  located: boolean;
  billingPeriod: BillingPeriod;
  contactName: string | null;
  contactPhone: string | null;
  userCount: number;
  /** Lot 1, demande 1 : tournée du client (null : non rattaché, ne peut pas commander). */
  zoneName: string | null;
}

export interface MerchantUserRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
}

export interface MerchantDetail {
  id: string;
  name: string;
  tradeName: string | null;
  siren: string | null;
  vatNumber: string | null;
  address: string;
  postalCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  accessInstructions: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  billingEmail: string | null;
  billingAddress: string | null;
  billingPostalCode: string | null;
  billingCity: string | null;
  billingPeriod: BillingPeriod;
  paymentMethod: PaymentMethod | null;
  zoneId: string | null;
  active: boolean;
  createdAt: string;
  users: MerchantUserRow[];
}

const notFound = () => new DomainRuleError(404, "Client introuvable.", "MERCHANT_NOT_FOUND");

/** La tournée choisie appartient à l'entreprise (PLA-01) ; sinon 400. */
async function assertZone(db: MerchantAdminDb, companyId: string, zoneId: string | null | undefined) {
  if (!zoneId) return;
  const zone = await db.deliveryZone.findFirst({ where: { id: zoneId, companyId } });
  if (!zone) throw new DomainRuleError(400, "Tournée introuvable.", "ZONE_NOT_FOUND");
}

const DETAIL_FIELDS = [
  "name", "tradeName", "siren", "vatNumber", "address", "postalCode", "city", "latitude", "longitude",
  "accessInstructions", "contactName", "contactPhone", "contactEmail", "billingEmail", "billingAddress",
  "billingPostalCode", "billingCity", "billingPeriod", "paymentMethod", "active", "zoneId",
] as const;

function snapshot(row: Record<string, unknown>) {
  return Object.fromEntries(DETAIL_FIELDS.map((key) => [key, row[key] ?? null])) as Prisma.InputJsonObject;
}

export async function listMerchantsForAdmin(
  companyId: string,
  options: { q?: string | null; status?: "active" | "inactive" | "all" } = {},
  db: MerchantAdminDb = defaultDb()
): Promise<MerchantListRow[]> {
  const status = options.status ?? "all";
  const rows = await db.merchant.findMany({
    where: { companyId, ...(status === "all" ? {} : { active: status === "active" }) },
  });
  const [users, zones] = await Promise.all([
    db.user.findMany({ where: { companyId, merchantId: { in: rows.map((row) => row.id) } }, select: { merchantId: true } }),
    db.deliveryZone.findMany({ where: { companyId }, select: { id: true, name: true } }),
  ]);
  const zoneName = new Map(zones.map((zone) => [zone.id, zone.name]));
  const counts = new Map<string, number>();
  for (const user of users) if (user.merchantId) counts.set(user.merchantId, (counts.get(user.merchantId) ?? 0) + 1);
  const q = options.q?.trim().toLocaleLowerCase("fr");
  return rows
    .filter((row) => !q || [row.name, row.tradeName, row.city, row.address].some((value) => value?.toLocaleLowerCase("fr").includes(q)))
    .sort((a, b) => Number(b.active) - Number(a.active) || (a.tradeName || a.name).localeCompare(b.tradeName || b.name, "fr"))
    .map((row) => ({
      id: row.id,
      name: row.name,
      tradeName: row.tradeName,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      active: row.active,
      located: row.latitude !== null && row.longitude !== null,
      billingPeriod: row.billingPeriod,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      userCount: counts.get(row.id) ?? 0,
      zoneName: row.zoneId ? zoneName.get(row.zoneId) ?? null : null,
    }));
}

export async function getMerchantForAdmin(companyId: string, merchantId: string, db: MerchantAdminDb = defaultDb()): Promise<MerchantDetail> {
  const row = await db.merchant.findFirst({ where: { id: merchantId, companyId } });
  if (!row) throw notFound();
  const users = await db.user.findMany({
    where: { companyId, merchantId: row.id },
    select: { id: true, firstName: true, lastName: true, email: true, status: true },
  });
  return {
    id: row.id,
    name: row.name,
    tradeName: row.tradeName,
    siren: row.siren,
    vatNumber: row.vatNumber,
    address: row.address,
    postalCode: row.postalCode,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    accessInstructions: row.accessInstructions,
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    billingEmail: row.billingEmail,
    billingAddress: row.billingAddress,
    billingPostalCode: row.billingPostalCode,
    billingCity: row.billingCity,
    billingPeriod: row.billingPeriod,
    paymentMethod: row.paymentMethod,
    zoneId: row.zoneId ?? null,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    users: users
      .map((user) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, status: user.status }))
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr")),
  };
}

export async function createMerchantForAdmin(
  actor: { companyId: string; userId: string },
  input: CreateMerchantInput,
  db: MerchantAdminDb = defaultDb()
): Promise<MerchantDetail> {
  await assertZone(db, actor.companyId, input.zoneId);
  const created = await db.merchant.create({
    data: {
      companyId: actor.companyId,
      name: input.name,
      tradeName: input.tradeName ?? null,
      siren: input.siren ?? null,
      vatNumber: input.vatNumber ?? null,
      address: input.address,
      postalCode: input.postalCode ?? null,
      city: input.city ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      accessInstructions: input.accessInstructions ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
      contactEmail: input.contactEmail ?? null,
      billingEmail: input.billingEmail ?? null,
      billingAddress: input.billingAddress ?? null,
      billingPostalCode: input.billingPostalCode ?? null,
      billingCity: input.billingCity ?? null,
      billingPeriod: input.billingPeriod,
      paymentMethod: input.paymentMethod ?? null,
      zoneId: input.zoneId ?? null,
      active: true,
    },
  });
  await db.auditLog.create({
    data: { companyId: actor.companyId, actorId: actor.userId, entityType: MERCHANT_AUDIT_ENTITY, entityId: created.id, action: "CREATE", after: snapshot(created) },
  });
  return getMerchantForAdmin(actor.companyId, created.id, db);
}

export async function updateMerchantForAdmin(
  actor: { companyId: string; userId: string },
  merchantId: string,
  input: UpdateMerchantInput,
  db: MerchantAdminDb = defaultDb()
): Promise<MerchantDetail> {
  const before = await db.merchant.findFirst({ where: { id: merchantId, companyId: actor.companyId } });
  if (!before) throw notFound();
  await assertZone(db, actor.companyId, input.zoneId);
  const data: Record<string, unknown> = {};
  for (const key of DETAIL_FIELDS) {
    if (input[key] !== undefined) data[key] = input[key];
  }
  const { count } = await db.merchant.updateMany({ where: { id: merchantId, companyId: actor.companyId }, data });
  if (count === 0) throw notFound();
  const after = await db.merchant.findFirst({ where: { id: merchantId, companyId: actor.companyId } });
  const action = input.active === false && before.active ? "DEACTIVATE" : input.active === true && !before.active ? "REACTIVATE" : "UPDATE";
  await db.auditLog.create({
    data: { companyId: actor.companyId, actorId: actor.userId, entityType: MERCHANT_AUDIT_ENTITY, entityId: merchantId, action, before: snapshot(before), after: snapshot(after ?? before) },
  });
  return getMerchantForAdmin(actor.companyId, merchantId, db);
}
