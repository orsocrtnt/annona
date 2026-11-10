/**
 * Commandes côté client (CMD-1) : création ou modification de la commande unique par client, date et
 * créneau (CLI-04, CLI-05, RG-02, RG-08), annulation (CLI-06), historique (CLI-07) et recopie (CLI-08).
 *
 * Règles vérifiées ici, côté serveur, à chaque écriture :
 * - la date est demain ou plus tard (RG-02, RG-03 : 7 j / 7) ;
 * - l'instant présent est avant J−1 à l'heure limite de l'entreprise (RG-01, CLI-06) : sinon 409 ;
 * - le créneau est un créneau actif de l'entreprise, jamais une heure libre (RG-08) ;
 * - les produits sont actifs, dans une catégorie active, de la même entreprise (PLA-01) ;
 * - une commande verrouillée, préparée ou livrée n'est jamais modifiée par le client.
 * Le client ne lit et n'écrit que les commandes de son commerce : un identifiant d'un autre client
 * ou d'une autre entreprise est introuvable (404).
 *
 * Les prix ne sont pas figés ici (RG-05 : figés au verrouillage, LOCK-1) ; les totaux affichés passent
 * par le calcul unique `loadAppliedPrices`.
 */
import { randomBytes } from "node:crypto";
import { Prisma, type DeliveryPeriod, type OrderStatus, type PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { computeTotals, loadAppliedPrices } from "@/domains/catalog/pricing";
import { photoVersion } from "@/domains/catalog/catalog.service";
import {
  companyToday,
  deliveryDateKey,
  deliveryDateToDb,
  isDeliveryDateOrderable,
  isOrderEditable,
  orderCutoffInstant,
  toCalendarDate,
} from "@/domains/order/order-deadline";
import type {
  PortalOrderDetail,
  PortalOrderLine,
  PortalOrderList,
  PortalOrderSummary,
  PortalSlot,
} from "@/domains/order/merchant-order.types";
import { periodLabel } from "@/domains/company/delivery-period";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import { isProductPhotoPath } from "@/lib/storage/product-photo";
import type { OrderLineInput, SaveOrderInput } from "@/lib/validations/order";

export type OrderDb = Pick<
  PrismaClient,
  "company" | "merchant" | "slot" | "product" | "merchantPrice" | "order" | "orderLine" | "$transaction"
>;

/** Client connecté : entreprise et commerce viennent de la session. */
export interface MerchantRef {
  companyId: string;
  merchantId: string;
  userId: string;
}

const t = fr.order.errors;

/** Statuts que le client peut encore modifier (avant l'heure limite). CANCELLED : réouverture. */
const CLIENT_WRITABLE_STATUSES: readonly OrderStatus[] = ["DRAFT", "VALIDATED", "CANCELLED"];

export interface CompanyRules {
  cutoffTime: string;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Règles pures
// ---------------------------------------------------------------------------

/** RG-01, RG-02 : refuse une date passée, du jour, ou dont l'heure limite est atteinte. */
export function assertDeliveryWritable(deliveryDate: string | Date, now: Date, company: CompanyRules): void {
  if (!toCalendarDate(deliveryDate)) throw new DomainRuleError(400, t.invalidDate, "INVALID_DATE");
  if (!isDeliveryDateOrderable(deliveryDate, now, company.timezone)) {
    throw new DomainRuleError(400, t.dateTooSoon, "DATE_TOO_SOON");
  }
  if (!isOrderEditable(deliveryDate, now, company.cutoffTime, company.timezone)) {
    throw new DomainRuleError(409, t.deadlinePassed, "DEADLINE_PASSED");
  }
}

/** Une commande verrouillée, préparée ou livrée n'est plus modifiable par le client. */
export function assertStatusWritable(status: OrderStatus): void {
  if (!CLIENT_WRITABLE_STATUSES.includes(status)) throw new DomainRuleError(409, t.locked, "ORDER_LOCKED");
}

/** Lignes sans doublon ni quantité hors bornes (le schéma Zod vérifie déjà les bornes). */
export function assertLines(lines: readonly OrderLineInput[]): void {
  if (lines.length === 0) throw new DomainRuleError(400, t.emptyOrder, "EMPTY_ORDER");
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.productId)) throw new DomainRuleError(400, t.duplicateProduct, "DUPLICATE_PRODUCT");
    seen.add(line.productId);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 9999) {
      throw new DomainRuleError(400, t.quantity, "INVALID_QUANTITY");
    }
  }
}

/** Libellé d'un créneau : son nom, sinon « 6h – 7h ». */
export function slotLabel(slot: { label: string | null; startTime: string; endTime: string }): string {
  if (slot.label) return slot.label;
  const short = (time: string) => time.replace(/^0/, "").replace(":00", "h").replace(":", "h");
  return `${short(slot.startTime)} – ${short(slot.endTime)}`;
}

type SlotLike = { label: string | null; startTime: string; endTime: string; period?: DeliveryPeriod | null };

/** Lot 1, demande 1 : le client voit seulement « Matin » ou « Soir » (sans heure) pour une tournée. */
export function clientSlotLabel(slot: SlotLike): string {
  return slot.period ? periodLabel(slot.period) : slotLabel(slot);
}

/**
 * Créneaux commandables par un client : le matin et le soir actifs de sa tournée. Les créneaux d'une
 * tournée désactivée sont désactivés avec elle (`delivery-zone.service.ts`).
 */
export function merchantSlotWhere(companyId: string, zoneId: string) {
  return { companyId, zoneId, active: true } satisfies Prisma.SlotWhereInput;
}

function toPortalSlot(slot: { id: string } & SlotLike): PortalSlot {
  return { id: slot.id, label: clientSlotLabel(slot), startTime: slot.startTime, endTime: slot.endTime, period: slot.period ?? null };
}

export function newReference(deliveryDate: string): string {
  return `C${deliveryDate.slice(2).replace(/-/g, "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function isUniqueViolation(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") ||
    (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002")
  );
}

// ---------------------------------------------------------------------------
// Chargements
// ---------------------------------------------------------------------------

async function loadCompanyRules(db: OrderDb, companyId: string): Promise<CompanyRules> {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { cutoffTime: true, timezone: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return company;
}

async function assertMerchantActive(db: OrderDb, actor: MerchantRef) {
  const merchant = await db.merchant.findFirst({ where: { id: actor.merchantId, companyId: actor.companyId }, select: { active: true, zoneId: true } });
  if (!merchant?.active) throw new DomainRuleError(403, t.merchantInactive, "MERCHANT_INACTIVE");
  return { zoneId: merchant.zoneId ?? null };
}

/**
 * RG-08 et lot 1, demande 1 : le créneau est le matin ou le soir de la tournée du client, actifs.
 * Un client sans tournée ne peut pas commander.
 */
export async function findMerchantSlot(db: Pick<OrderDb, "slot" | "merchant">, actor: Pick<MerchantRef, "companyId" | "merchantId">, slotId: string) {
  const merchant = await db.merchant.findFirst({ where: { id: actor.merchantId, companyId: actor.companyId }, select: { zoneId: true } });
  const slot = merchant?.zoneId ? await db.slot.findFirst({ where: { id: slotId, ...merchantSlotWhere(actor.companyId, merchant.zoneId) } }) : null;
  if (!slot) throw new DomainRuleError(400, t.slotUnavailable, "SLOT_UNAVAILABLE");
  return slot;
}

type ProductInfo = { id: string; name: string; unit: string; photoUrl: string | null; available: boolean };

async function loadProducts(db: OrderDb, companyId: string, productIds: readonly string[]): Promise<Map<string, ProductInfo>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.product.findMany({
    where: { companyId, id: { in: [...productIds] } },
    select: { id: true, name: true, unit: true, photoUrl: true, active: true, category: { select: { active: true } } },
  });
  return new Map(
    rows.map((row) => [row.id, { id: row.id, name: row.name, unit: row.unit, photoUrl: row.photoUrl, available: row.active && row.category.active }])
  );
}

/** Produits commandables : actifs, catégorie active, même entreprise (PLA-01). */
async function assertProductsOrderable(db: OrderDb, companyId: string, lines: readonly OrderLineInput[]) {
  const products = await loadProducts(db, companyId, lines.map((line) => line.productId));
  for (const line of lines) {
    if (!products.get(line.productId)?.available) {
      throw new DomainRuleError(400, t.productUnavailable, "PRODUCT_UNAVAILABLE", { productId: line.productId });
    }
  }
}

type OrderRow = {
  id: string;
  reference: string;
  deliveryDate: Date;
  slotId: string;
  status: OrderStatus;
  origin: "MANUAL" | "RECURRING";
  notes: string | null;
};

async function buildDetail(db: OrderDb, actor: MerchantRef, order: OrderRow, rules: CompanyRules, now: Date): Promise<PortalOrderDetail> {
  const [slot, lineRows] = await Promise.all([
    db.slot.findFirst({ where: { id: order.slotId, companyId: actor.companyId } }),
    db.orderLine.findMany({ where: { orderId: order.id, companyId: actor.companyId }, orderBy: { createdAt: "asc" } }),
  ]);
  const productIds = lineRows.map((line) => line.productId);
  const [products, prices] = await Promise.all([
    loadProducts(db, actor.companyId, productIds),
    loadAppliedPrices(db, actor.companyId, actor.merchantId, productIds),
  ]);
  const lines: PortalOrderLine[] = lineRows.map((line) => {
    const product = products.get(line.productId);
    const price = prices.get(line.productId);
    const current = price?.unitPriceCents ?? 0;
    return {
      productId: line.productId,
      name: product?.name ?? "Produit retiré",
      unit: product?.unit ?? "",
      photoVersion: product && isProductPhotoPath(product.photoUrl, actor.companyId) ? photoVersion(product.photoUrl!) : null,
      quantity: line.quantityOrdered,
      quantityDelivered: line.quantityDelivered,
      unitPriceCents: line.unitPriceFrozenCents ?? current,
      currentUnitPriceCents: current,
      vatRateBasisPoints: price?.vatRateBasisPoints ?? 0,
      available: product?.available ?? false,
    };
  });
  const totals = computeTotals(lines.map((line) => ({ quantity: line.quantity, unitPriceCents: line.unitPriceCents, vatRateBasisPoints: line.vatRateBasisPoints })));
  return {
    id: order.id,
    reference: order.reference,
    deliveryDate: deliveryDateKey(order.deliveryDate),
    slot: slot ? toPortalSlot(slot) : { id: order.slotId, label: "", startTime: "", endTime: "" },
    status: order.status,
    origin: order.origin,
    notes: order.notes,
    lineCount: lines.length,
    itemCount: totals.itemCount,
    subtotalCents: totals.subtotalCents,
    vatCents: totals.vatCents,
    totalCents: totals.totalCents,
    editable: CLIENT_WRITABLE_STATUSES.includes(order.status) && order.status !== "CANCELLED"
      ? isOrderEditable(order.deliveryDate, now, rules.cutoffTime, rules.timezone)
      : false,
    cutoffAt: orderCutoffInstant(order.deliveryDate, rules.cutoffTime, rules.timezone).toISOString(),
    lines,
  };
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Détail d'une commande du client ; 404 pour la commande d'un autre client ou d'une autre entreprise. */
export async function getMerchantOrder(actor: MerchantRef, orderId: string, now = new Date(), db: OrderDb = prisma) {
  const order = await db.order.findFirst({ where: { id: orderId, companyId: actor.companyId, merchantId: actor.merchantId } });
  if (!order) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
  return buildDetail(db, actor, order, await loadCompanyRules(db, actor.companyId), now);
}

/** Commande du client pour une date et un créneau (CLI-05 : l'ouvrir en modification), ou null. */
export async function findMerchantOrderFor(actor: MerchantRef, deliveryDate: string, slotId: string, now = new Date(), db: OrderDb = prisma) {
  if (!toCalendarDate(deliveryDate)) throw new DomainRuleError(400, t.invalidDate, "INVALID_DATE");
  const order = await db.order.findFirst({
    where: { companyId: actor.companyId, merchantId: actor.merchantId, slotId, deliveryDate: deliveryDateToDb(deliveryDate) },
  });
  if (!order) return null;
  return buildDetail(db, actor, order, await loadCompanyRules(db, actor.companyId), now);
}

const HISTORY_PAGE = 20;

/**
 * CLI-07 : commandes à venir (aujourd'hui compris, par date croissante) ou historique (avant
 * aujourd'hui, par date décroissante, par pages de 20 avec `before`).
 */
export async function listMerchantOrders(
  actor: MerchantRef,
  options: { scope: "upcoming" | "history"; before?: string | null },
  now = new Date(),
  db: Pick<PrismaClient, "company" | "order" | "merchantPrice" | "product"> = prisma
): Promise<PortalOrderList> {
  const rules = await (db as OrderDb).company.findUnique({ where: { id: actor.companyId }, select: { cutoffTime: true, timezone: true } });
  if (!rules) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  const today = deliveryDateToDb(companyToday(now, rules.timezone));
  const before = options.before && toCalendarDate(options.before) ? deliveryDateToDb(options.before) : null;
  const upcoming = options.scope === "upcoming";
  const rows = await db.order.findMany({
    where: {
      companyId: actor.companyId,
      merchantId: actor.merchantId,
      deliveryDate: upcoming ? { gte: today } : { lt: before && before < today ? before : today },
    },
    orderBy: [{ deliveryDate: upcoming ? "asc" : "desc" }, { slot: { sortOrder: "asc" } }],
    take: upcoming ? 60 : HISTORY_PAGE + 1,
    select: {
      id: true,
      reference: true,
      deliveryDate: true,
      status: true,
      origin: true,
      slot: { select: { id: true, label: true, startTime: true, endTime: true, period: true } },
      lines: { select: { productId: true, quantityOrdered: true, unitPriceFrozenCents: true } },
    },
  });
  const page = upcoming ? rows : rows.slice(0, HISTORY_PAGE);
  const productIds = [...new Set(page.flatMap((order) => order.lines.map((line) => line.productId)))];
  const prices = await loadAppliedPrices(db, actor.companyId, actor.merchantId, productIds);
  const orders: PortalOrderSummary[] = page.map((order) => {
    const totals = computeTotals(
      order.lines.map((line) => {
        const price = prices.get(line.productId);
        return {
          quantity: line.quantityOrdered,
          unitPriceCents: line.unitPriceFrozenCents ?? price?.unitPriceCents ?? 0,
          vatRateBasisPoints: price?.vatRateBasisPoints ?? 0,
        };
      })
    );
    return {
      id: order.id,
      reference: order.reference,
      deliveryDate: deliveryDateKey(order.deliveryDate),
      slot: toPortalSlot(order.slot),
      status: order.status,
      origin: order.origin,
      lineCount: order.lines.length,
      itemCount: totals.itemCount,
      subtotalCents: totals.subtotalCents,
      totalCents: totals.totalCents,
      editable:
        (order.status === "VALIDATED" || order.status === "DRAFT") &&
        isOrderEditable(order.deliveryDate, now, rules.cutoffTime, rules.timezone),
      cutoffAt: orderCutoffInstant(order.deliveryDate, rules.cutoffTime, rules.timezone).toISOString(),
    };
  });
  const nextBefore = !upcoming && rows.length > HISTORY_PAGE ? orders[orders.length - 1]!.deliveryDate : null;
  return { orders, nextBefore };
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

/**
 * CLI-04, CLI-05, CLI-06 : crée la commande du client pour (date, créneau), ou modifie celle qui existe
 * (unicité RG-02 / contrainte `merchantId × deliveryDate × slotId`). Statut VALIDATED.
 * Une commande annulée pour ce jour et ce créneau est rouverte.
 */
export async function saveMerchantOrder(
  actor: MerchantRef,
  input: SaveOrderInput,
  now = new Date(),
  db: OrderDb = prisma
): Promise<{ order: PortalOrderDetail; created: boolean }> {
  assertLines(input.lines);
  const rules = await loadCompanyRules(db, actor.companyId);
  assertDeliveryWritable(input.deliveryDate, now, rules);
  await assertMerchantActive(db, actor);
  await findMerchantSlot(db, actor, input.slotId);
  await assertProductsOrderable(db, actor.companyId, input.lines);

  const deliveryDate = deliveryDateToDb(input.deliveryDate);
  const write = () =>
    db.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { merchantId_deliveryDate_slotId: { merchantId: actor.merchantId, deliveryDate, slotId: input.slotId } },
      });
      if (existing && existing.companyId !== actor.companyId) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
      if (existing) assertStatusWritable(existing.status);
      const order = existing
        ? await tx.order.update({
            where: { id: existing.id },
            data: {
              status: "VALIDATED",
              // RG-04 : une commande saisie par le client remplace la récurrente ce jour-là.
              origin: "MANUAL",
              validatedAt: now,
              cancelledAt: null,
              createdById: existing.createdById ?? actor.userId,
              ...(input.notes !== undefined ? { notes: input.notes } : {}),
            },
          })
        : await tx.order.create({
            data: {
              companyId: actor.companyId,
              merchantId: actor.merchantId,
              reference: newReference(input.deliveryDate),
              deliveryDate,
              slotId: input.slotId,
              status: "VALIDATED",
              origin: "MANUAL",
              validatedAt: now,
              createdById: actor.userId,
              notes: input.notes ?? null,
            },
          });
      if (existing) await tx.orderLine.deleteMany({ where: { orderId: order.id, companyId: actor.companyId } });
      await tx.orderLine.createMany({
        data: input.lines.map((line) => ({
          companyId: actor.companyId,
          orderId: order.id,
          productId: line.productId,
          quantityOrdered: line.quantity,
        })),
      });
      return { order, created: !existing };
    });

  let result: Awaited<ReturnType<typeof write>>;
  try {
    result = await write();
  } catch (error) {
    // Deux validations simultanées pour la même date et le même créneau : la seconde modifie la première.
    if (!isUniqueViolation(error)) throw error;
    result = await write();
  }
  return { order: await buildDetail(db, actor, result.order, rules, now), created: result.created };
}

/** CLI-06 : annulation jusqu'à l'heure limite ; la ligne reste (statut CANCELLED). */
export async function cancelMerchantOrder(actor: MerchantRef, orderId: string, now = new Date(), db: OrderDb = prisma) {
  const order = await db.order.findFirst({ where: { id: orderId, companyId: actor.companyId, merchantId: actor.merchantId } });
  if (!order) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
  if (order.status === "CANCELLED") throw new DomainRuleError(409, t.alreadyCancelled, "ALREADY_CANCELLED");
  assertStatusWritable(order.status);
  const rules = await loadCompanyRules(db, actor.companyId);
  if (!isOrderEditable(order.deliveryDate, now, rules.cutoffTime, rules.timezone)) {
    throw new DomainRuleError(409, t.deadlinePassed, "DEADLINE_PASSED");
  }
  const updated = await db.order.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: now } });
  return buildDetail(db, actor, updated, rules, now);
}

/**
 * CLI-08 / ENF-03 : recopie à l'identique d'une commande du client pour une nouvelle date et un
 * créneau, au prix applicable aujourd'hui. Les produits qui ne sont plus proposés sont écartés.
 * Si une commande (non annulée) existe déjà pour la cible : 409, avec son identifiant.
 */
export async function reorderMerchantOrder(
  actor: MerchantRef,
  sourceOrderId: string,
  target: { deliveryDate: string; slotId: string },
  now = new Date(),
  db: OrderDb = prisma
): Promise<{ order: PortalOrderDetail; droppedCount: number }> {
  const source = await db.order.findFirst({ where: { id: sourceOrderId, companyId: actor.companyId, merchantId: actor.merchantId } });
  if (!source) throw new DomainRuleError(404, t.notFound, "ORDER_NOT_FOUND");
  const rules = await loadCompanyRules(db, actor.companyId);
  assertDeliveryWritable(target.deliveryDate, now, rules);

  const sourceLines = await db.orderLine.findMany({ where: { orderId: source.id, companyId: actor.companyId } });
  const products = await loadProducts(db, actor.companyId, sourceLines.map((line) => line.productId));
  const lines = sourceLines
    .filter((line) => products.get(line.productId)?.available)
    .map((line) => ({ productId: line.productId, quantity: line.quantityOrdered }));
  if (lines.length === 0) throw new DomainRuleError(400, t.nothingToReorder, "NOTHING_TO_REORDER");

  const existing = await db.order.findUnique({
    where: {
      merchantId_deliveryDate_slotId: { merchantId: actor.merchantId, deliveryDate: deliveryDateToDb(target.deliveryDate), slotId: target.slotId },
    },
  });
  if (existing && existing.companyId === actor.companyId && existing.status !== "CANCELLED") {
    throw new DomainRuleError(409, t.exists, "ORDER_EXISTS", { orderId: existing.id });
  }

  const { order } = await saveMerchantOrder(actor, { deliveryDate: target.deliveryDate, slotId: target.slotId, lines }, now, db);
  return { order, droppedCount: sourceLines.length - lines.length };
}
