/**
 * LOCK-1 — verrouillage d'une date de livraison à l'heure limite (RG-01, RG-04, RG-05, RG-09).
 *
 * `lockDeliveryDate(companyId, J)` ne fait rien avant J−1 à l'heure limite de l'entreprise
 * (`cutoffTime`, `timezone`). Ensuite, dans l'ordre :
 * 1. RG-04 : génère les commandes récurrentes actives pour J (origine RECURRING), seulement pour les
 *    commerçants qui n'ont aucune commande manuelle pour J. Règle prudente retenue : une commande
 *    manuelle compte quel que soit son créneau et son statut, ANNULÉE ou BROUILLON compris (le client
 *    qui annule sa commande du jour ne veut pas recevoir la récurrente à la place ; une commande sur un
 *    autre créneau du même jour ne doit pas être doublée). Une commande déjà présente sur le créneau de
 *    la récurrente (récurrente déjà générée) n'est jamais recréée.
 * 2. Passe les commandes VALIDÉES de J en VERROUILLÉES (`lockedAt`). Les BROUILLONS (DRAFT) sont
 *    ignorés : jamais validés par le client, ils ne sont ni produits ni livrés et restent en brouillon.
 * 3. RG-05 : fige `unitPriceFrozenCents` de chaque ligne par `resolveUnitPrice` (prix spécifique du
 *    commerçant, sinon prix de base), le même calcul que le catalogue et le panier.
 * 4. RG-08, RG-09 : calcule les tournées de J par créneau (calcul existant, départ du laboratoire),
 *    en brouillon (DRAFT), sans livreur. Un créneau qui a déjà des tournées n'est jamais recalculé
 *    (elles ont pu être modifiées ou attribuées) : une commande verrouillée sans arrêt y est ajoutée
 *    en fin de la dernière tournée brouillon sans livreur, sinon dans une tournée « complément ».
 *
 * Idempotent : relancer ne crée ni commande, ni tournée, ni arrêt en double. Deux exécutions
 * simultanées (cron et ouverture d'écran) sont sérialisées par un verrou consultatif PostgreSQL
 * par entreprise et par date (`pg_advisory_xact_lock`), pris dans chaque transaction d'écriture.
 * Le calcul des temps de trajet (réseau) se fait hors transaction.
 *
 * Une ligne de journal « DeliveryDay / LOCK » marque la date comme traitée : le cron et l'appel
 * paresseux `ensureDateLocked` ne relancent pas une date déjà traitée.
 */
import type { DeliveryPeriod, OrderStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { loadAppliedPricesByMerchant } from "@/domains/catalog/pricing";
import { newReference, slotLabel } from "@/domains/order/merchant-order.service";
import { DELIVERY_DAY_AUDIT_ENTITY } from "@/domains/order/order-audit";
import {
  deliveryDateKey,
  deliveryDateToDb,
  isOrderEditable,
  isoWeekday,
  orderCutoffInstant,
  toCalendarDate,
} from "@/domains/order/order-deadline";
import { planSlotRounds, type PlannedRound } from "@/domains/order/round-generation";
import { estimateTravelMatrix, type GeoPoint, type TravelMatrix } from "@/lib/dispatch/travel-time";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import { addCalendarDays, formatCalendarDate, parseWallClockTime, zonedTodayDate, zonedWallTimeToUtc } from "@/lib/time/paris";

export type LockDb = Pick<
  PrismaClient,
  | "company"
  | "merchant"
  | "slot"
  | "product"
  | "merchantPrice"
  | "order"
  | "orderLine"
  | "recurringOrder"
  | "recurringOrderLine"
  | "round"
  | "stop"
  | "auditLog"
  | "$transaction"
  | "$queryRaw"
>;
type LockTx = Omit<LockDb, "$transaction">;

export const LOCK_ACTION = "LOCK";
export const LOCK_UPDATE_ACTION = "LOCK_UPDATE";
const TX_OPTIONS = { maxWait: 15_000, timeout: 60_000 };
/** Commandes livrées par une tournée : verrouillées ou déjà préparées. */
const ROUND_STATUSES: OrderStatus[] = ["LOCKED", "PREPARED"];

export type RecurringSkipReason =
  | "MANUAL_ORDER_EXISTS"
  | "ORDER_EXISTS_ON_SLOT"
  | "MERCHANT_INACTIVE"
  | "SLOT_INACTIVE"
  | "NO_AVAILABLE_PRODUCT";

export interface LockSummary {
  companyId: string;
  date: string;
  /** NOT_DUE : l'heure limite de J n'est pas passée, rien n'a été fait. */
  skipped: "NOT_DUE" | null;
  recurringGenerated: number;
  recurringSkipped: Array<{ recurringOrderId: string; reason: RecurringSkipReason }>;
  ordersLocked: number;
  linesFrozen: number;
  roundsCreated: number;
  stopsCreated: number;
  /** Temps de trajet estimés à vol d'oiseau (service d'itinéraires indisponible). */
  approximateTravel: boolean;
}

export interface LockOptions {
  now?: Date;
  db?: LockDb;
  /** Matrice des temps de trajet ; par défaut le service d'itinéraires, repli à vol d'oiseau. */
  travelMatrix?: (points: GeoPoint[]) => Promise<TravelMatrix>;
}

// ---------------------------------------------------------------------------
// Règles pures
// ---------------------------------------------------------------------------

type ExistingOrder = { merchantId: string; slotId: string; origin: "MANUAL" | "RECURRING"; status: OrderStatus };

/**
 * RG-04 (critère de recette 4) : faut-il générer la commande récurrente de ce commerçant pour J ?
 * Non s'il a une commande manuelle pour J au même moment de la journée (tout statut, annulée comprise),
 * ni si une commande existe déjà sur ce créneau (récurrente déjà générée : idempotence).
 * Lot 1, demande 1 : matin et soir sont deux livraisons distinctes ; une commande manuelle du matin ne
 * bloque pas la récurrente du soir. Créneaux anciens (sans moment) : toute commande manuelle du jour bloque.
 */
export function recurringDecision(
  recurring: { merchantId: string; slotId: string },
  existing: readonly ExistingOrder[],
  periodOf: (slotId: string) => DeliveryPeriod | null = () => null
): "GENERATE" | "MANUAL_ORDER_EXISTS" | "ORDER_EXISTS_ON_SLOT" {
  const own = existing.filter((order) => order.merchantId === recurring.merchantId);
  const period = periodOf(recurring.slotId);
  const samePeriod = (order: ExistingOrder) => {
    const other = periodOf(order.slotId);
    return period === null || other === null || other === period;
  };
  if (own.some((order) => order.origin === "MANUAL" && samePeriod(order))) return "MANUAL_ORDER_EXISTS";
  if (own.some((order) => order.slotId === recurring.slotId)) return "ORDER_EXISTS_ON_SLOT";
  return "GENERATE";
}

/** « Tournée 6h – 7h », ou « Tournée 6h – 7h · B » quand le créneau en compte plusieurs. */
export function roundName(slot: { label: string | null; startTime: string; endTime: string }, index: number, total: number): string {
  return fr.lock.roundName(slotLabel(slot), total > 1 ? String.fromCharCode(65 + (index % 26)) : null);
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

async function acquireDayLock(tx: LockTx, companyId: string, date: string) {
  const key = `lock-day:${companyId}:${date}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
}

async function generateRecurringOrders(tx: LockTx, companyId: string, date: string, now: Date) {
  const dbDate = deliveryDateToDb(date);
  const weekday = isoWeekday(date);
  const recurrings = (await tx.recurringOrder.findMany({ where: { companyId, active: true } }))
    .filter((row) => row.weekdays.includes(weekday))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const skipped: LockSummary["recurringSkipped"] = [];
  if (recurrings.length === 0) return { generated: 0, skipped };

  const merchantIds = [...new Set(recurrings.map((row) => row.merchantId))];
  const [merchants, slots, existingRows, templateLines] = await Promise.all([
    tx.merchant.findMany({ where: { companyId, id: { in: merchantIds } }, select: { id: true, active: true, zoneId: true } }),
    tx.slot.findMany({ where: { companyId }, select: { id: true, active: true, zoneId: true, period: true } }),
    tx.order.findMany({
      where: { companyId, deliveryDate: dbDate, merchantId: { in: merchantIds } },
      select: { merchantId: true, slotId: true, origin: true, status: true },
    }),
    tx.recurringOrderLine.findMany({
      where: { companyId, recurringOrderId: { in: recurrings.map((row) => row.id) } },
      select: { recurringOrderId: true, productId: true, quantity: true },
    }),
  ]);
  const products = await tx.product.findMany({
    where: { companyId, id: { in: [...new Set(templateLines.map((line) => line.productId))] } },
    select: { id: true, active: true, category: { select: { active: true } } },
  });
  const activeMerchants = new Set(merchants.filter((row) => row.active).map((row) => row.id));
  const activeSlots = new Set(slots.filter((row) => row.active).map((row) => row.id));
  const slotById = new Map(slots.map((row) => [row.id, row]));
  const periodOf = (slotId: string) => slotById.get(slotId)?.period ?? null;
  const zoneOf = new Map(merchants.map((row) => [row.id, row.zoneId ?? null]));
  /**
   * Lot 1, demande 1 : client passé dans une autre tournée depuis la création de sa commande type :
   * la commande est générée au même moment (matin ou soir) de sa tournée actuelle.
   */
  const targetSlot = (recurring: { merchantId: string; slotId: string }) => {
    const slot = slotById.get(recurring.slotId);
    const zoneId = zoneOf.get(recurring.merchantId);
    if (!slot?.period || !zoneId || slot.zoneId === zoneId) return recurring.slotId;
    return slots.find((row) => row.zoneId === zoneId && row.period === slot.period)?.id ?? recurring.slotId;
  };
  const available = new Set(products.filter((row) => row.active && row.category.active).map((row) => row.id));
  const existing: ExistingOrder[] = [...existingRows];

  let generated = 0;
  for (const recurring of recurrings) {
    const skip = (reason: RecurringSkipReason) => skipped.push({ recurringOrderId: recurring.id, reason });
    if (!activeMerchants.has(recurring.merchantId)) { skip("MERCHANT_INACTIVE"); continue; }
    const slotId = targetSlot(recurring);
    if (!activeSlots.has(slotId)) { skip("SLOT_INACTIVE"); continue; }
    const decision = recurringDecision({ merchantId: recurring.merchantId, slotId }, existing, periodOf);
    if (decision !== "GENERATE") { skip(decision); continue; }
    // Produit retiré du catalogue depuis la création de la commande type : ligne écartée.
    const lines = templateLines.filter((line) => line.recurringOrderId === recurring.id && available.has(line.productId) && line.quantity > 0);
    if (lines.length === 0) { skip("NO_AVAILABLE_PRODUCT"); continue; }

    const order = await tx.order.create({
      data: {
        companyId,
        merchantId: recurring.merchantId,
        reference: newReference(date),
        deliveryDate: dbDate,
        slotId,
        status: "VALIDATED",
        origin: "RECURRING",
        recurringOrderId: recurring.id,
        validatedAt: now,
        createdById: null,
      },
    });
    await tx.orderLine.createMany({
      data: lines.map((line) => ({ companyId, orderId: order.id, productId: line.productId, quantityOrdered: line.quantity })),
    });
    existing.push({ merchantId: recurring.merchantId, slotId, origin: "RECURRING", status: "VALIDATED" });
    generated += 1;
  }
  return { generated, skipped };
}

/** VALIDATED → LOCKED et prix figés (RG-05) : une mise à jour par couple produit × prix. */
async function lockAndFreeze(tx: LockTx, companyId: string, date: string, now: Date) {
  const orders = await tx.order.findMany({
    where: { companyId, deliveryDate: deliveryDateToDb(date), status: "VALIDATED" },
    select: { id: true, merchantId: true },
  });
  if (orders.length === 0) return { ordersLocked: 0, linesFrozen: 0 };
  const orderIds = orders.map((order) => order.id);
  const lines = await tx.orderLine.findMany({ where: { companyId, orderId: { in: orderIds } }, select: { orderId: true, productId: true } });
  const merchantOf = new Map(orders.map((order) => [order.id, order.merchantId]));
  const prices = await loadAppliedPricesByMerchant(
    tx,
    companyId,
    [...new Set(orders.map((order) => order.merchantId))],
    [...new Set(lines.map((line) => line.productId))]
  );

  const groups = new Map<string, { productId: string; price: number; orderIds: Set<string> }>();
  let linesFrozen = 0;
  for (const line of lines) {
    const price = prices.get(merchantOf.get(line.orderId)!)?.get(line.productId)?.unitPriceCents;
    if (price === undefined) continue;
    const key = `${line.productId}|${price}`;
    const group = groups.get(key) ?? { productId: line.productId, price, orderIds: new Set<string>() };
    group.orderIds.add(line.orderId);
    groups.set(key, group);
    linesFrozen += 1;
  }
  for (const group of groups.values()) {
    await tx.orderLine.updateMany({
      where: { companyId, productId: group.productId, orderId: { in: [...group.orderIds] } },
      data: { unitPriceFrozenCents: group.price },
    });
  }
  const { count } = await tx.order.updateMany({
    where: { companyId, id: { in: orderIds }, status: "VALIDATED" },
    data: { status: "LOCKED", lockedAt: now },
  });
  return { ordersLocked: count, linesFrozen };
}

type SlotRow = { id: string; label: string | null; startTime: string; endTime: string };
type SlotPlan = { slot: SlotRow; mode: "create"; rounds: PlannedRound[] } | { slot: SlotRow; mode: "append"; orderIds: string[] };

/** Prépare les tournées hors transaction (le calcul des trajets peut appeler le réseau). */
async function prepareRounds(
  db: LockDb,
  company: { id: string; timezone: string; depotLatitude: number | null; depotLongitude: number | null },
  date: string,
  travelMatrix: NonNullable<LockOptions["travelMatrix"]>
): Promise<{ plans: SlotPlan[]; approximate: boolean }> {
  const companyId = company.id;
  const dbDate = deliveryDateToDb(date);
  const orders = await db.order.findMany({
    where: { companyId, deliveryDate: dbDate, status: { in: ROUND_STATUSES } },
    select: { id: true, merchantId: true, slotId: true },
  });
  if (orders.length === 0) return { plans: [], approximate: false };
  const withStop = new Set(
    (await db.stop.findMany({ where: { companyId, orderId: { in: orders.map((order) => order.id) } }, select: { orderId: true } })).map(
      (stop) => stop.orderId
    )
  );
  const pending = orders.filter((order) => !withStop.has(order.id));
  if (pending.length === 0) return { plans: [], approximate: false };

  const slotIds = [...new Set(pending.map((order) => order.slotId))];
  const [slots, rounds, merchants] = await Promise.all([
    db.slot.findMany({ where: { companyId, id: { in: slotIds } }, select: { id: true, label: true, startTime: true, endTime: true } }),
    db.round.findMany({ where: { companyId, date: dbDate, slotId: { in: slotIds } }, select: { slotId: true } }),
    db.merchant.findMany({
      where: { companyId, id: { in: [...new Set(pending.map((order) => order.merchantId))] } },
      select: { id: true, name: true, latitude: true, longitude: true },
    }),
  ]);
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const slotsWithRounds = new Set(rounds.map((round) => round.slotId));
  const depot: GeoPoint | null =
    company.depotLatitude !== null && company.depotLongitude !== null ? { latitude: company.depotLatitude, longitude: company.depotLongitude } : null;
  const pointOf = (merchantId: string): GeoPoint | null => {
    const merchant = merchantById.get(merchantId);
    return merchant && merchant.latitude !== null && merchant.longitude !== null ? { latitude: merchant.latitude, longitude: merchant.longitude } : null;
  };
  const nameOf = (merchantId: string) => merchantById.get(merchantId)?.name ?? "";

  const toPlan = pending.filter((order) => !slotsWithRounds.has(order.slotId));
  let approximate = false;
  let seconds: TravelMatrix["seconds"] | null = null;
  if (toPlan.length > 0) {
    const points = [...(depot ? [depot] : []), ...toPlan.map((order) => pointOf(order.merchantId)).filter((point): point is GeoPoint => point !== null)];
    const matrix = await travelMatrix(points);
    seconds = matrix.seconds;
    approximate = matrix.approximate;
  }

  const day = toCalendarDate(date)!;
  const plans: SlotPlan[] = [];
  for (const slot of [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const slotOrders = pending
      .filter((order) => order.slotId === slot.id)
      .sort((a, b) => nameOf(a.merchantId).localeCompare(nameOf(b.merchantId), "fr") || a.id.localeCompare(b.id));
    if (slotsWithRounds.has(slot.id)) {
      plans.push({ slot, mode: "append", orderIds: slotOrders.map((order) => order.id) });
      continue;
    }
    const start = parseWallClockTime(slot.startTime) ?? { hour: 0, minute: 0 };
    const end = parseWallClockTime(slot.endTime) ?? start;
    const windowStart = zonedWallTimeToUtc(day, start, company.timezone).getTime();
    let windowEnd = zonedWallTimeToUtc(day, end, company.timezone).getTime();
    if (windowEnd <= windowStart) windowEnd = windowStart + 3_600_000;
    plans.push({
      slot,
      mode: "create",
      rounds: planSlotRounds({
        orders: slotOrders.map((order) => ({ id: order.id, point: pointOf(order.merchantId), label: nameOf(order.merchantId) })),
        depot,
        windowStart,
        windowEnd,
        travelSeconds: seconds!,
      }),
    });
  }
  return { plans, approximate };
}

/** Écrit les tournées préparées ; relit l'état sous verrou (une autre exécution a pu passer avant). */
async function writeRounds(tx: LockTx, companyId: string, date: string, plans: SlotPlan[]) {
  const dbDate = deliveryDateToDb(date);
  const allIds = plans.flatMap((plan) => (plan.mode === "create" ? plan.rounds.flatMap((round) => round.orderIds) : plan.orderIds));
  if (allIds.length === 0) return { roundsCreated: 0, stopsCreated: 0 };
  const done = new Set((await tx.stop.findMany({ where: { companyId, orderId: { in: allIds } }, select: { orderId: true } })).map((stop) => stop.orderId));
  let roundsCreated = 0;
  let stopsCreated = 0;

  for (const plan of plans) {
    const existing = await tx.round.findMany({
      where: { companyId, date: dbDate, slotId: plan.slot.id },
      select: { id: true, status: true, driverId: true, createdAt: true },
    });
    if (plan.mode === "create" && existing.length === 0) {
      const planned = plan.rounds
        .map((round) => {
          const keep = round.orderIds.map((orderId, index) => ({ orderId, arrival: round.arrivals[index] ?? null })).filter((stop) => !done.has(stop.orderId));
          return keep;
        })
        .filter((stops) => stops.length > 0);
      for (const [index, stops] of planned.entries()) {
        const round = await tx.round.create({
          data: { companyId, date: dbDate, slotId: plan.slot.id, name: roundName(plan.slot, index, planned.length), status: "DRAFT", driverId: null },
        });
        await tx.stop.createMany({
          data: stops.map((stop, position) => ({
            companyId,
            roundId: round.id,
            orderId: stop.orderId,
            sequence: position + 1,
            estimatedArrivalAt: stop.arrival === null ? null : new Date(stop.arrival),
          })),
        });
        stops.forEach((stop) => done.add(stop.orderId));
        roundsCreated += 1;
        stopsCreated += stops.length;
      }
      continue;
    }

    // Créneau qui a déjà des tournées : jamais recalculé, ajout en fin de tournée brouillon sans livreur.
    const orderIds = (plan.mode === "create" ? plan.rounds.flatMap((round) => round.orderIds) : plan.orderIds).filter((id) => !done.has(id));
    if (orderIds.length === 0) continue;
    let target = existing
      .filter((round) => round.status === "DRAFT" && !round.driverId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .at(-1);
    let firstSequence = 1;
    if (target) {
      const sequences = (await tx.stop.findMany({ where: { companyId, roundId: target.id }, select: { sequence: true } })).map((stop) => stop.sequence);
      firstSequence = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
    } else {
      target = await tx.round.create({
        data: { companyId, date: dbDate, slotId: plan.slot.id, name: fr.lock.extraRoundName(slotLabel(plan.slot)), status: "DRAFT", driverId: null },
        select: { id: true, status: true, driverId: true, createdAt: true },
      });
      roundsCreated += 1;
    }
    await tx.stop.createMany({
      data: orderIds.map((orderId, index) => ({ companyId, roundId: target.id, orderId, sequence: firstSequence + index })),
    });
    orderIds.forEach((id) => done.add(id));
    stopsCreated += orderIds.length;
  }
  return { roundsCreated, stopsCreated };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

async function loadCompany(db: LockDb, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, cutoffTime: true, timezone: true, depotLatitude: true, depotLongitude: true },
  });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return company;
}

/** Instant du premier verrouillage de la date (témoin du journal), ou `null` si jamais traitée. */
export async function deliveryDateLockedAt(companyId: string, date: string, db: Pick<LockDb, "auditLog"> = prisma): Promise<Date | null> {
  const marker = await db.auditLog.findFirst({
    where: { companyId, entityType: DELIVERY_DAY_AUDIT_ENTITY, entityId: deliveryDateKey(date), action: LOCK_ACTION },
    select: { createdAt: true },
  });
  return marker?.createdAt ?? null;
}

/** Verrouille J pour une entreprise (voir l'en-tête). Sans effet avant l'heure limite. */
export async function lockDeliveryDate(companyId: string, deliveryDate: string | Date, options: LockOptions = {}): Promise<LockSummary> {
  const now = options.now ?? new Date();
  const db = options.db ?? (prisma as unknown as LockDb);
  const date = deliveryDateKey(deliveryDate);
  const company = await loadCompany(db, companyId);
  const summary: LockSummary = {
    companyId,
    date,
    skipped: null,
    recurringGenerated: 0,
    recurringSkipped: [],
    ordersLocked: 0,
    linesFrozen: 0,
    roundsCreated: 0,
    stopsCreated: 0,
    approximateTravel: false,
  };
  // RG-01 : rien avant J−1 à l'heure limite, lue dans le fuseau de l'entreprise.
  if (isOrderEditable(date, now, company.cutoffTime, company.timezone)) return { ...summary, skipped: "NOT_DUE" };

  const first = await db.$transaction(async (tx) => {
    await acquireDayLock(tx, companyId, date);
    const recurring = await generateRecurringOrders(tx, companyId, date, now);
    const locked = await lockAndFreeze(tx, companyId, date, now);
    return { recurring, locked };
  }, TX_OPTIONS);
  summary.recurringGenerated = first.recurring.generated;
  summary.recurringSkipped = first.recurring.skipped;
  summary.ordersLocked = first.locked.ordersLocked;
  summary.linesFrozen = first.locked.linesFrozen;

  const { plans, approximate } = await prepareRounds(db, company, date, options.travelMatrix ?? ((points) => estimateTravelMatrix(points)));
  summary.approximateTravel = approximate;

  const written = await db.$transaction(async (tx) => {
    await acquireDayLock(tx, companyId, date);
    const rounds = await writeRounds(tx, companyId, date, plans);
    const marker = await tx.auditLog.findFirst({
      where: { companyId, entityType: DELIVERY_DAY_AUDIT_ENTITY, entityId: date, action: LOCK_ACTION },
      select: { id: true },
    });
    const changed = summary.recurringGenerated + summary.ordersLocked + rounds.roundsCreated + rounds.stopsCreated > 0;
    if (!marker || changed) {
      await tx.auditLog.create({
        data: {
          companyId,
          actorId: null,
          entityType: DELIVERY_DAY_AUDIT_ENTITY,
          entityId: date,
          action: marker ? LOCK_UPDATE_ACTION : LOCK_ACTION,
          after: { ...summary, ...rounds, recurringSkipped: summary.recurringSkipped.length },
          createdAt: now,
        },
      });
    }
    return rounds;
  }, TX_OPTIONS);
  summary.roundsCreated = written.roundsCreated;
  summary.stopsCreated = written.stopsCreated;
  return summary;
}

export interface DayLockState {
  date: string;
  cutoffAt: Date;
  /** Heure limite passée ou date déjà verrouillée : commandes figées pour la production. */
  closed: boolean;
  lockedAt: Date | null;
}

/**
 * Appel paresseux à l'ouverture des écrans boulanger et administrateur : si l'heure limite de J est
 * passée et que la date n'a pas encore été traitée, la verrouille tout de suite, sans attendre le cron.
 * Une erreur de verrouillage n'empêche pas l'écran de s'afficher (le cron reprendra).
 */
export async function ensureDateLocked(companyId: string, date: string, options: LockOptions = {}): Promise<DayLockState> {
  const now = options.now ?? new Date();
  const db = options.db ?? (prisma as unknown as LockDb);
  const company = await loadCompany(db, companyId);
  const cutoffAt = orderCutoffInstant(date, company.cutoffTime, company.timezone);
  let lockedAt = await deliveryDateLockedAt(companyId, date, db);
  const due = !isOrderEditable(date, now, company.cutoffTime, company.timezone);
  if (due && !lockedAt) {
    try {
      await lockDeliveryDate(companyId, date, { ...options, now, db });
      lockedAt = await deliveryDateLockedAt(companyId, date, db);
    } catch (error) {
      console.error("[LOCK-1] verrouillage paresseux impossible", { companyId, date, error: error instanceof Error ? error.name : "unknown" });
    }
  }
  return { date: deliveryDateKey(date), cutoffAt, closed: due || lockedAt !== null, lockedAt };
}

export interface DueLockResult {
  companyId: string;
  date: string;
  ok: boolean;
  summary?: LockSummary;
}

/**
 * Cron : pour chaque entreprise active, verrouille aujourd'hui et demain (fuseau de l'entreprise)
 * si l'heure limite est passée et que la date n'a pas encore été traitée. Aujourd'hui sert de
 * rattrapage si aucun passage n'a eu lieu la veille au soir. Une erreur n'arrête pas les autres.
 */
export async function lockDueDeliveryDates(options: LockOptions = {}): Promise<DueLockResult[]> {
  const now = options.now ?? new Date();
  const db = options.db ?? (prisma as unknown as LockDb);
  const companies = await db.company.findMany({
    where: { status: { in: ["ACTIVE", "TRIAL"] } },
    select: { id: true, cutoffTime: true, timezone: true },
  });
  const results: DueLockResult[] = [];
  for (const company of companies) {
    const today = zonedTodayDate(now, company.timezone);
    for (const date of [formatCalendarDate(today), formatCalendarDate(addCalendarDays(today, 1))]) {
      try {
        if (isOrderEditable(date, now, company.cutoffTime, company.timezone)) continue;
        if (await deliveryDateLockedAt(company.id, date, db)) continue;
        results.push({ companyId: company.id, date, ok: true, summary: await lockDeliveryDate(company.id, date, { ...options, now, db }) });
      } catch (error) {
        console.error("[LOCK-1] verrouillage planifié impossible", { companyId: company.id, date, error: error instanceof Error ? error.name : "unknown" });
        results.push({ companyId: company.id, date, ok: false });
      }
    }
  }
  return results;
}

/**
 * Recette locale (TOUR-1) : verrouille une date précise pour chaque entreprise active, même si la date
 * a déjà été traitée (le témoin du journal est ignoré ; `lockDeliveryDate` reste idempotent et n'agit
 * qu'après l'heure limite). Appelé seulement par `/api/cron/lock-orders?date=…`, refusé en production.
 */
export async function lockDeliveryDateForAll(date: string, options: LockOptions = {}): Promise<DueLockResult[]> {
  const now = options.now ?? new Date();
  const db = options.db ?? (prisma as unknown as LockDb);
  const companies = await db.company.findMany({ where: { status: { in: ["ACTIVE", "TRIAL"] } }, select: { id: true } });
  const results: DueLockResult[] = [];
  for (const company of companies) {
    try {
      results.push({ companyId: company.id, date, ok: true, summary: await lockDeliveryDate(company.id, date, { ...options, now, db }) });
    } catch (error) {
      console.error("[LOCK-1] verrouillage forcé impossible", { companyId: company.id, date, error: error instanceof Error ? error.name : "unknown" });
      results.push({ companyId: company.id, date, ok: false });
    }
  }
  return results;
}
