/**
 * ADM-1 (ADM-09, RG-08) — créneaux de livraison de l'entreprise : créer, modifier, désactiver, ordonner.
 *
 * Un créneau utilisé (commande, commande récurrente ou tournée) n'est jamais supprimé : il se désactive
 * (plus proposé au client, l'historique garde son libellé). Seul un créneau jamais utilisé se supprime.
 * Deux créneaux de l'entreprise ne peuvent pas avoir les mêmes heures. Entreprise prise dans la session.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { slotLabel } from "@/domains/order/merchant-order.service";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import type { CreateSlotInput, UpdateSlotInput } from "@/lib/validations/company-admin";

export type SlotAdminDb = Pick<PrismaClient, "slot" | "order" | "recurringOrder" | "round" | "$transaction">;
const defaultDb = () => prisma as unknown as SlotAdminDb;

export interface SlotRow {
  id: string;
  label: string | null;
  displayLabel: string;
  startTime: string;
  endTime: string;
  active: boolean;
  sortOrder: number;
  /** Utilisé par une commande, une récurrente ou une tournée : ne se supprime pas. */
  used: boolean;
}

const notFound = () => new DomainRuleError(404, "Créneau introuvable.", "SLOT_NOT_FOUND");
const duplicate = () => new DomainRuleError(409, "Un créneau a déjà ces heures.", "SLOT_DUPLICATE");

function isUniqueViolation(error: unknown) {
  return (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002");
}

async function usage(db: SlotAdminDb, companyId: string, slotIds: string[]) {
  if (slotIds.length === 0) return new Set<string>();
  const [orders, recurrings, rounds] = await Promise.all([
    db.order.findMany({ where: { companyId, slotId: { in: slotIds } }, select: { slotId: true }, distinct: ["slotId"] }),
    db.recurringOrder.findMany({ where: { companyId, slotId: { in: slotIds } }, select: { slotId: true } }),
    db.round.findMany({ where: { companyId, slotId: { in: slotIds } }, select: { slotId: true } }),
  ]);
  return new Set([...orders, ...recurrings, ...rounds].map((row) => row.slotId));
}

export async function listSlotsForAdmin(companyId: string, db: SlotAdminDb = defaultDb()): Promise<SlotRow[]> {
  const slots = await db.slot.findMany({ where: { companyId } });
  const used = await usage(db, companyId, slots.map((slot) => slot.id));
  return slots
    .sort((a, b) => a.sortOrder - b.sortOrder || a.startTime.localeCompare(b.startTime))
    .map((slot) => ({
      id: slot.id,
      label: slot.label,
      displayLabel: slotLabel(slot),
      startTime: slot.startTime,
      endTime: slot.endTime,
      active: slot.active,
      sortOrder: slot.sortOrder,
      used: used.has(slot.id),
    }));
}

async function assertNoTwin(db: SlotAdminDb, companyId: string, startTime: string, endTime: string, exceptId?: string) {
  const twin = await db.slot.findFirst({ where: { companyId, startTime, endTime } });
  if (twin && twin.id !== exceptId) throw duplicate();
}

export async function createSlotForAdmin(companyId: string, input: CreateSlotInput, db: SlotAdminDb = defaultDb()) {
  await assertNoTwin(db, companyId, input.startTime, input.endTime);
  const existing = await db.slot.findMany({ where: { companyId }, select: { sortOrder: true } });
  try {
    await db.slot.create({
      data: {
        companyId,
        label: input.label ?? null,
        startTime: input.startTime,
        endTime: input.endTime,
        active: true,
        sortOrder: existing.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate();
    throw error;
  }
  return listSlotsForAdmin(companyId, db);
}

export async function updateSlotForAdmin(companyId: string, slotId: string, input: UpdateSlotInput, db: SlotAdminDb = defaultDb()) {
  const slot = await db.slot.findFirst({ where: { id: slotId, companyId } });
  if (!slot) throw notFound();
  const startTime = input.startTime ?? slot.startTime;
  const endTime = input.endTime ?? slot.endTime;
  if (startTime >= endTime) throw new DomainRuleError(400, "La fin du créneau doit suivre son début.", "SLOT_INVALID");
  if (input.startTime !== undefined || input.endTime !== undefined) await assertNoTwin(db, companyId, startTime, endTime, slotId);
  try {
    await db.slot.updateMany({
      where: { id: slotId, companyId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        startTime,
        endTime,
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicate();
    throw error;
  }
  return listSlotsForAdmin(companyId, db);
}

export async function reorderSlotsForAdmin(companyId: string, ids: readonly string[], db: SlotAdminDb = defaultDb()) {
  const slots = await db.slot.findMany({ where: { companyId }, select: { id: true } });
  const known = new Set(slots.map((slot) => slot.id));
  if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((id) => !known.has(id))) {
    throw new DomainRuleError(400, "L'ordre doit contenir chaque créneau une seule fois.", "SLOT_ORDER_INVALID");
  }
  await db.$transaction(ids.map((id, index) => db.slot.updateMany({ where: { id, companyId }, data: { sortOrder: index } })));
  return listSlotsForAdmin(companyId, db);
}

/** Supprime un créneau jamais utilisé ; sinon 409 : il faut le désactiver. */
export async function deleteSlotForAdmin(companyId: string, slotId: string, db: SlotAdminDb = defaultDb()) {
  const slot = await db.slot.findFirst({ where: { id: slotId, companyId } });
  if (!slot) throw notFound();
  if ((await usage(db, companyId, [slotId])).has(slotId)) {
    throw new DomainRuleError(409, "Ce créneau a déjà servi : désactivez-le plutôt (l'historique le garde).", "SLOT_IN_USE");
  }
  await db.slot.deleteMany({ where: { id: slotId, companyId } });
  return listSlotsForAdmin(companyId, db);
}
