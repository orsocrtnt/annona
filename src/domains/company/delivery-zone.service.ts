/**
 * Lot 1, demande 1 — tournées (zones) de l'entreprise, dans les Paramètres de l'administrateur.
 *
 * Une tournée = un nom de zone + une plage du matin + une plage du soir (ex. « Sud », 5h30–11h00 et
 * 16h00–19h00). Chaque tournée porte exactement deux créneaux (`Slot`, période MORNING et EVENING),
 * créés et tenus à jour ici : commandes, récurrentes, listes du boulanger et tournées du jour restent
 * calculées par créneau, donc par zone et par moment de la journée.
 *
 * Une tournée utilisée (client rattaché, commande, récurrente ou tournée du jour) ne se supprime pas :
 * elle se désactive (ses deux créneaux aussi). Entreprise toujours prise dans la session (PLA-01).
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { zoneSlotLabel, type DeliveryPeriodValue } from "@/domains/company/delivery-period";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { CreateZoneInput, UpdateZoneInput } from "@/lib/validations/company-admin";

export type ZoneAdminDb = Pick<PrismaClient, "deliveryZone" | "slot" | "merchant" | "order" | "recurringOrder" | "round" | "$transaction">;
const defaultDb = () => prisma as unknown as ZoneAdminDb;

export interface ZoneRow {
  id: string;
  name: string;
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
  active: boolean;
  sortOrder: number;
  /** Clients rattachés à cette tournée. */
  merchantCount: number;
  /** Utilisée (client, commande, récurrente ou tournée du jour) : ne se supprime pas. */
  used: boolean;
}

const notFound = () => new DomainRuleError(404, "Tournée introuvable.", "ZONE_NOT_FOUND");
const duplicate = () => new DomainRuleError(409, "Une tournée porte déjà ce nom.", "ZONE_DUPLICATE");

function isUniqueViolation(error: unknown) {
  return (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002");
}

type ZoneTimes = Pick<ZoneRow, "morningStart" | "morningEnd" | "eveningStart" | "eveningEnd">;

function assertRanges(times: ZoneTimes) {
  if (times.morningStart >= times.morningEnd) throw new DomainRuleError(400, "La fin du matin doit suivre son début.", "ZONE_INVALID");
  if (times.eveningStart >= times.eveningEnd) throw new DomainRuleError(400, "La fin du soir doit suivre son début.", "ZONE_INVALID");
  if (times.morningEnd > times.eveningStart) throw new DomainRuleError(400, "La plage du soir doit commencer après celle du matin.", "ZONE_INVALID");
}

/** Les deux créneaux d'une zone, tels qu'ils doivent être en base. */
export function zoneSlots(zone: { name: string; sortOrder: number; active: boolean } & ZoneTimes) {
  const slot = (period: DeliveryPeriodValue, startTime: string, endTime: string, offset: number) => ({
    period,
    label: zoneSlotLabel(zone.name, period),
    startTime,
    endTime,
    active: zone.active,
    sortOrder: zone.sortOrder * 2 + offset,
  });
  return [slot("MORNING", zone.morningStart, zone.morningEnd, 0), slot("EVENING", zone.eveningStart, zone.eveningEnd, 1)];
}

async function zoneUsage(db: ZoneAdminDb, companyId: string, zoneIds: string[]) {
  if (zoneIds.length === 0) return { merchants: new Map<string, number>(), used: new Set<string>() };
  const [merchants, slots] = await Promise.all([
    db.merchant.findMany({ where: { companyId, zoneId: { in: zoneIds } }, select: { zoneId: true } }),
    db.slot.findMany({ where: { companyId, zoneId: { in: zoneIds } }, select: { id: true, zoneId: true } }),
  ]);
  const slotIds = slots.map((slot) => slot.id);
  const [orders, recurrings, rounds] = slotIds.length
    ? await Promise.all([
        db.order.findMany({ where: { companyId, slotId: { in: slotIds } }, select: { slotId: true }, distinct: ["slotId"] }),
        db.recurringOrder.findMany({ where: { companyId, slotId: { in: slotIds } }, select: { slotId: true } }),
        db.round.findMany({ where: { companyId, slotId: { in: slotIds } }, select: { slotId: true } }),
      ])
    : [[], [], []];
  const zoneOfSlot = new Map(slots.map((slot) => [slot.id, slot.zoneId]));
  const counts = new Map<string, number>();
  for (const merchant of merchants) if (merchant.zoneId) counts.set(merchant.zoneId, (counts.get(merchant.zoneId) ?? 0) + 1);
  const used = new Set<string>(counts.keys());
  for (const row of [...orders, ...recurrings, ...rounds]) {
    const zoneId = zoneOfSlot.get(row.slotId);
    if (zoneId) used.add(zoneId);
  }
  return { merchants: counts, used };
}

export async function listZonesForAdmin(companyId: string, db: ZoneAdminDb = defaultDb()): Promise<ZoneRow[]> {
  const zones = await db.deliveryZone.findMany({ where: { companyId } });
  const { merchants, used } = await zoneUsage(db, companyId, zones.map((zone) => zone.id));
  return zones
    .sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
    .map((zone) => ({
      id: zone.id,
      name: zone.name,
      morningStart: zone.morningStart,
      morningEnd: zone.morningEnd,
      eveningStart: zone.eveningStart,
      eveningEnd: zone.eveningEnd,
      active: zone.active,
      sortOrder: zone.sortOrder,
      merchantCount: merchants.get(zone.id) ?? 0,
      used: used.has(zone.id),
    }));
}

async function assertNameFree(db: ZoneAdminDb, companyId: string, name: string, exceptId?: string) {
  const zones = await db.deliveryZone.findMany({ where: { companyId }, select: { id: true, name: true } });
  const key = name.trim().toLocaleLowerCase("fr");
  if (zones.some((zone) => zone.id !== exceptId && zone.name.trim().toLocaleLowerCase("fr") === key)) throw duplicate();
}

export async function createZoneForAdmin(companyId: string, input: CreateZoneInput, db: ZoneAdminDb = defaultDb()) {
  assertRanges(input);
  await assertNameFree(db, companyId, input.name);
  const existing = await db.deliveryZone.findMany({ where: { companyId }, select: { sortOrder: true } });
  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
  try {
    await db.$transaction(async (tx) => {
      const zone = await tx.deliveryZone.create({ data: { companyId, ...input, active: true, sortOrder } });
      for (const slot of zoneSlots(zone)) {
        await tx.slot.create({ data: { companyId, zoneId: zone.id, ...slot } });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate();
    throw error;
  }
  return listZonesForAdmin(companyId, db);
}

/** Modifier le nom, les plages ou l'état ; les deux créneaux suivent (libellés, heures, actif). */
export async function updateZoneForAdmin(companyId: string, zoneId: string, input: UpdateZoneInput, db: ZoneAdminDb = defaultDb()) {
  const zone = await db.deliveryZone.findFirst({ where: { id: zoneId, companyId } });
  if (!zone) throw notFound();
  const next = {
    name: input.name ?? zone.name,
    morningStart: input.morningStart ?? zone.morningStart,
    morningEnd: input.morningEnd ?? zone.morningEnd,
    eveningStart: input.eveningStart ?? zone.eveningStart,
    eveningEnd: input.eveningEnd ?? zone.eveningEnd,
    active: input.active ?? zone.active,
  };
  assertRanges(next);
  if (input.name !== undefined) await assertNameFree(db, companyId, next.name, zoneId);
  try {
    await db.$transaction(async (tx) => {
      await tx.deliveryZone.updateMany({ where: { id: zoneId, companyId }, data: next });
      for (const slot of zoneSlots({ ...next, sortOrder: zone.sortOrder })) {
        const { count } = await tx.slot.updateMany({ where: { companyId, zoneId, period: slot.period }, data: slot });
        // Zone créée avant ses créneaux (reprise de données) : le créneau manquant est créé.
        if (count === 0) await tx.slot.create({ data: { companyId, zoneId, ...slot } });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate();
    throw error;
  }
  return listZonesForAdmin(companyId, db);
}

/** Supprime une tournée jamais utilisée ; sinon 409 : il faut la désactiver. */
export async function deleteZoneForAdmin(companyId: string, zoneId: string, db: ZoneAdminDb = defaultDb()) {
  const zone = await db.deliveryZone.findFirst({ where: { id: zoneId, companyId } });
  if (!zone) throw notFound();
  if ((await zoneUsage(db, companyId, [zoneId])).used.has(zoneId)) {
    throw new DomainRuleError(409, "Cette tournée a déjà servi ou a des clients : désactivez-la plutôt.", "ZONE_IN_USE");
  }
  await db.$transaction(async (tx) => {
    await tx.slot.deleteMany({ where: { companyId, zoneId } });
    await tx.deliveryZone.deleteMany({ where: { id: zoneId, companyId } });
  });
  return listZonesForAdmin(companyId, db);
}

/** Tournées actives proposées au rattachement d'un client (fiche client de l'administrateur). */
export async function listZoneOptions(companyId: string, db: Pick<PrismaClient, "deliveryZone"> = prisma) {
  const zones = await db.deliveryZone.findMany({ where: { companyId }, select: { id: true, name: true, active: true, sortOrder: true } });
  return zones
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"))
    .map((zone) => ({ id: zone.id, name: zone.name, active: zone.active }));
}
