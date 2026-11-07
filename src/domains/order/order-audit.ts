/**
 * Journal des commandes (RG-10, ADM-05, BOU-06) : qui, quand, quoi, avant / après.
 *
 * Toute correction d'un administrateur et tout manquant signalé par le boulanger écrivent une ligne
 * `AuditLog` (entité « Order »). Le verrouillage d'une date écrit une ligne « DeliveryDay » qui sert
 * aussi de témoin « date déjà traitée » pour le cron et l'appel paresseux (LOCK-1).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { fr } from "@/lib/i18n/fr";

export const ORDER_AUDIT_ENTITY = "Order";
export const DELIVERY_DAY_AUDIT_ENTITY = "DeliveryDay";

export type OrderAuditAction = "ADMIN_CORRECTION" | "ADMIN_CANCEL" | "SHORTAGE" | "PREPARED" | "UNPREPARED";

/** Ligne de commande telle qu'elle est journalisée (avant / après). */
export interface AuditLineSnapshot {
  productId: string;
  name: string;
  quantityOrdered: number;
  quantityDelivered: number | null;
}

export interface OrderAuditSnapshot {
  status?: string;
  lines?: AuditLineSnapshot[];
  afterCutoff?: boolean;
  note?: string | null;
}

type AuditDb = Pick<PrismaClient | Prisma.TransactionClient, "auditLog">;

export async function writeOrderAudit(
  db: AuditDb,
  entry: {
    companyId: string;
    actorId: string | null;
    orderId: string;
    action: OrderAuditAction;
    before: OrderAuditSnapshot;
    after: OrderAuditSnapshot;
    at: Date;
  }
) {
  await db.auditLog.create({
    data: {
      companyId: entry.companyId,
      actorId: entry.actorId,
      entityType: ORDER_AUDIT_ENTITY,
      entityId: entry.orderId,
      action: entry.action,
      before: entry.before as Prisma.InputJsonValue,
      after: entry.after as Prisma.InputJsonValue,
      createdAt: entry.at,
    },
  });
}

const t = fr.orderHistory;

/**
 * Phrases lisibles d'une ligne du journal : « Baguette : 30 → 25 », « Croissant ajouté (12) »,
 * « Manquant : Baguette, 28 livrées sur 30 ». Fonction pure, testée.
 */
export function describeOrderAudit(action: string, before: unknown, after: unknown): string[] {
  const b = (before ?? {}) as OrderAuditSnapshot;
  const a = (after ?? {}) as OrderAuditSnapshot;
  if (action === "ADMIN_CANCEL") return [t.cancelled];
  if (action === "PREPARED") return [t.prepared];
  if (action === "UNPREPARED") return [t.unprepared];
  if (action === "SHORTAGE") {
    const line = a.lines?.[0];
    if (!line) return [t.shortageGeneric];
    const delivered = line.quantityDelivered ?? line.quantityOrdered;
    return delivered >= line.quantityOrdered ? [t.shortageCleared(line.name)] : [t.shortage(line.name, delivered, line.quantityOrdered)];
  }
  const changes: string[] = [];
  const beforeLines = new Map((b.lines ?? []).map((line) => [line.productId, line]));
  const afterLines = new Map((a.lines ?? []).map((line) => [line.productId, line]));
  for (const [productId, line] of afterLines) {
    const previous = beforeLines.get(productId);
    if (!previous) changes.push(t.added(line.name, line.quantityOrdered));
    else if (previous.quantityOrdered !== line.quantityOrdered) changes.push(t.changed(line.name, previous.quantityOrdered, line.quantityOrdered));
  }
  for (const [productId, line] of beforeLines) {
    if (!afterLines.has(productId)) changes.push(t.removed(line.name, line.quantityOrdered));
  }
  if (a.note) changes.push(t.note(a.note));
  return changes.length > 0 ? changes : [t.noChange];
}
