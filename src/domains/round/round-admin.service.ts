/**
 * TOUR-1 — tournées côté administrateur (ADM-06, ADM-07, RG-08, RG-10, critère de recette 6).
 *
 * Les tournées sont calculées à l'heure limite par LOCK-1 (`lockDeliveryDate`, brouillons sans
 * livreur). L'administrateur peut ensuite librement :
 * - réordonner les arrêts d'une tournée (numéros 1, 2, 3… sans trou) ou recalculer l'ordre avec le
 *   calcul existant (`orderRoundStops`) ;
 * - déplacer un arrêt encore à livrer vers une autre tournée du même jour et du même créneau (RG-08 :
 *   une tournée correspond à un créneau) ;
 * - créer une tournée vide (après l'heure limite seulement, pour ne pas court-circuiter le calcul
 *   automatique) et supprimer une tournée sans arrêt ;
 * - attribuer ou changer le livreur (ADM-07) puis « valider » : DRAFT → ASSIGNED. Seules les tournées
 *   validées sont visibles du livreur ; il reçoit une notification push s'il l'a activée.
 *
 * RG-10 : chaque modification écrit une ligne `AuditLog` (entité « RoundDay », identifiant = la date)
 * avec l'auteur, l'heure, l'avant et l'après, et `afterCutoff`. Les écritures prennent le même verrou
 * consultatif que le verrouillage de la date (`lock-day:<entreprise>:<date>`) : une tournée n'est jamais
 * modifiée pendant que LOCK-1 y ajoute un arrêt, et deux administrateurs ne se croisent pas.
 * L'entreprise vient toujours de la session (PLA-01) : un identifiant d'une autre entreprise donne 404.
 */
import type { Prisma, PrismaClient, RoundStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { slotLabel } from "@/domains/order/merchant-order.service";
import { deliveryDateKey, deliveryDateToDb, isOrderEditable } from "@/domains/order/order-deadline";
import type { DayLockState } from "@/domains/order/order-lock.service";
import { orderRoundStops } from "@/domains/order/round-generation";
import {
  EDITABLE_ROUND_STATUSES,
  moveStopBetween,
  roundProgress,
  sequenceUpdates,
  stopPackages,
  validateStopOrder,
} from "@/domains/round/round-rules";
import type {
  AdminRoundsDay,
  AdminRoundView,
  RoundJournalEntry,
  RoundStopView,
  ValidateRoundsResult,
} from "@/domains/round/round.types";
import { estimateTravelMatrix, type GeoPoint, type TravelMatrix } from "@/lib/dispatch/travel-time";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";

export type RoundDb = Pick<
  PrismaClient,
  "company" | "slot" | "round" | "stop" | "order" | "orderLine" | "merchant" | "user" | "role" | "auditLog" | "$transaction" | "$queryRaw"
>;
type RoundTx = Omit<RoundDb, "$transaction">;

export interface AdminActor {
  companyId: string;
  userId: string;
}

export type DriverNotifier = (input: { companyId: string; roundId: string; driverId: string }) => Promise<void>;

export interface RoundAdminDeps {
  db?: RoundDb;
  now?: Date;
  notifyDriver?: DriverNotifier;
  travelMatrix?: (points: GeoPoint[]) => Promise<TravelMatrix>;
}

export const ROUND_AUDIT_ENTITY = "RoundDay";
export type RoundAuditAction =
  | "ROUND_CREATE"
  | "ROUND_DELETE"
  | "ROUND_ASSIGN"
  | "ROUND_REORDER"
  | "ROUND_OPTIMIZE"
  | "STOP_MOVE"
  | "ROUND_VALIDATE";

const t = fr.rounds;
const TX_OPTIONS = { maxWait: 15_000, timeout: 30_000 };

/** Notification par défaut : tâche DRIVER_NOTIFICATION relue à l'envoi (`deliverDriverMissionPush`). */
const defaultNotifier: DriverNotifier = async ({ companyId, roundId, driverId }) => {
  const { enqueueOperationJob, kickOperationJob } = await import("@/domains/operations/operation-job.service");
  const job = await enqueueOperationJob(prisma, {
    jobKey: `driver-round:${roundId}:${driverId}:${Date.now()}`,
    type: "DRIVER_NOTIFICATION",
    payload: { companyId, roundId, driverId },
    companyId,
  });
  kickOperationJob(job.id);
};

async function notifySafely(notify: DriverNotifier, input: { companyId: string; roundId: string; driverId: string }) {
  try {
    await notify(input);
  } catch (error) {
    // Une notification ratée n'annule jamais l'attribution : le livreur verra la tournée en ouvrant l'app.
    console.error("[TOUR-1] notification livreur impossible", { roundId: input.roundId, error: error instanceof Error ? error.name : "unknown" });
  }
}

async function acquireDayLock(tx: RoundTx, companyId: string, date: string) {
  // Même clé que LOCK-1 (`order-lock.service.ts`) : sérialise les éditions avec le verrouillage.
  const key = `lock-day:${companyId}:${date}`;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${key}))`;
}

async function loadCompany(db: Pick<RoundDb, "company">, companyId: string) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { id: true, cutoffTime: true, timezone: true, depotLatitude: true, depotLongitude: true },
  });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return company;
}

function depotOf(company: { depotLatitude: number | null; depotLongitude: number | null }): GeoPoint | null {
  return company.depotLatitude !== null && company.depotLongitude !== null
    ? { latitude: company.depotLatitude, longitude: company.depotLongitude }
    : null;
}

function personName(user: { firstName: string; lastName: string } | undefined | null): string | null {
  if (!user) return null;
  return `${user.firstName} ${user.lastName}`.trim() || null;
}

export function merchantDisplayName(merchant: { name: string; tradeName: string | null } | undefined | null): string {
  return merchant ? merchant.tradeName || merchant.name : "";
}

export function merchantAddress(merchant: { address: string; postalCode: string | null; city: string | null } | undefined | null): string {
  if (!merchant) return "";
  const town = [merchant.postalCode, merchant.city].filter(Boolean).join(" ");
  return [merchant.address, town].filter(Boolean).join(", ");
}

async function writeRoundAudit(
  tx: Pick<RoundDb, "auditLog">,
  entry: { companyId: string; actorId: string; date: string; action: RoundAuditAction; before?: Record<string, unknown>; after: Record<string, unknown>; at: Date }
) {
  await tx.auditLog.create({
    data: {
      companyId: entry.companyId,
      actorId: entry.actorId,
      entityType: ROUND_AUDIT_ENTITY,
      entityId: entry.date,
      action: entry.action,
      before: (entry.before ?? null) as Prisma.InputJsonValue,
      after: entry.after as Prisma.InputJsonValue,
      createdAt: entry.at,
    },
  });
}

/** Phrases lisibles d'une ligne du journal des tournées (RG-10). Fonction pure, testée. */
export function describeRoundAudit(action: string, before: unknown, after: unknown): string[] {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : null);
  const list = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
  switch (action) {
    case "ROUND_ASSIGN":
      return [t.journalDriver(text(b.driverName), text(a.driverName))];
    case "STOP_MOVE":
      return [t.journalMove(text(b.merchantName) ?? "", text(b.roundName) ?? "", text(a.roundName) ?? "")];
    case "ROUND_REORDER":
    case "ROUND_OPTIMIZE":
      return [t.journalOrder(list(a.stops).map((name, index) => `${index + 1}. ${name}`).join(", "))];
    case "ROUND_VALIDATE":
      return text(a.driverName) ? [text(a.driverName)!] : [];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

type StopRow = {
  id: string;
  roundId: string;
  orderId: string;
  sequence: number;
  status: RoundStopView["status"];
  estimatedArrivalAt: Date | null;
  deliveredAt: Date | null;
  incidentCode: string | null;
  incidentComment: string | null;
  incidentPhotoPath: string | null;
  incidentAt: Date | null;
};

type OrderRow = { id: string; reference: string; status: RoundStopView["orderStatus"]; merchantId: string };

const MERCHANT_SELECT = {
  id: true,
  name: true,
  tradeName: true,
  address: true,
  postalCode: true,
  city: true,
  latitude: true,
  longitude: true,
  accessInstructions: true,
  contactPhone: true,
} as const;

/**
 * Lignes et commerces des commandes données, lus en parallèle. Exportée pour qu'un écran qui connaît déjà
 * les commandes du jour les lise en même temps que ses arrêts (LOT1-D9 : un aller-retour de moins).
 */
export async function readStopSources(
  db: Pick<RoundDb, "orderLine" | "merchant">,
  companyId: string,
  orderIds: string[],
  merchantIds: string[]
) {
  const [lines, merchants] = await Promise.all([
    orderIds.length
      ? db.orderLine.findMany({
          where: { companyId, orderId: { in: orderIds } },
          select: { orderId: true, productId: true, quantityOrdered: true, quantityDelivered: true },
        })
      : Promise.resolve([]),
    merchantIds.length ? db.merchant.findMany({ where: { companyId, id: { in: merchantIds } }, select: MERCHANT_SELECT }) : Promise.resolve([]),
  ]);
  return { lines, merchants };
}

export type StopSources = Awaited<ReturnType<typeof readStopSources>>;

/**
 * Arrêts enrichis (commande, commerce, colis), communs aux vues administrateur, livreur et suivi.
 * `preloadedOrders` (commandes du jour déjà lues) évite un aller-retour : lignes et commerces sont
 * alors lus en parallèle. `preloadedSources` (lignes et commerces d'un ensemble de commandes qui couvre
 * celles des arrêts, lus par `readStopSources`) supprime toute lecture.
 */
export async function loadStopDetails(
  db: Pick<RoundDb, "order" | "orderLine" | "merchant">,
  companyId: string,
  stops: StopRow[],
  preloadedOrders?: OrderRow[],
  preloadedSources?: StopSources
) {
  const orderIds = [...new Set(stops.map((stop) => stop.orderId))];
  const wanted = new Set(orderIds);
  const orders: OrderRow[] = preloadedOrders
    ? preloadedOrders.filter((order) => wanted.has(order.id))
    : orderIds.length
      ? await db.order.findMany({ where: { companyId, id: { in: orderIds } }, select: { id: true, reference: true, status: true, merchantId: true } })
      : [];
  const merchantIds = [...new Set(orders.map((order) => order.merchantId))];
  const { lines, merchants } = preloadedSources
    ? { lines: preloadedSources.lines.filter((line) => wanted.has(line.orderId)), merchants: preloadedSources.merchants }
    : await readStopSources(db, companyId, orderIds, merchantIds);
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  const linesByOrder = new Map<string, typeof lines>();
  for (const line of lines) linesByOrder.set(line.orderId, [...(linesByOrder.get(line.orderId) ?? []), line]);

  const views = new Map<string, StopDetail>();
  for (const stop of stops) {
    const order = orderById.get(stop.orderId);
    const merchant = order ? merchantById.get(order.merchantId) : undefined;
    const { packages, items } = stopPackages(linesByOrder.get(stop.orderId) ?? []);
    views.set(stop.id, {
      id: stop.id,
      sequence: stop.sequence,
      status: stop.status,
      orderId: stop.orderId,
      orderReference: order?.reference ?? "",
      orderStatus: order?.status ?? "LOCKED",
      merchantId: order?.merchantId ?? "",
      merchantName: merchantDisplayName(merchant),
      address: merchantAddress(merchant),
      latitude: merchant?.latitude ?? null,
      longitude: merchant?.longitude ?? null,
      accessInstructions: merchant?.accessInstructions ?? null,
      contactPhone: merchant?.contactPhone ?? null,
      packages,
      items,
      estimatedArrivalAt: stop.estimatedArrivalAt?.toISOString() ?? null,
      deliveredAt: stop.deliveredAt?.toISOString() ?? null,
      incident: stop.incidentAt
        ? { code: stop.incidentCode ?? "OTHER", comment: stop.incidentComment, at: stop.incidentAt.toISOString(), hasPhoto: Boolean(stop.incidentPhotoPath) }
        : null,
    });
  }
  return { views, lines: linesByOrder, orderById };
}

type StopDetail = RoundStopView & { merchantId: string; contactPhone: string | null };

function adminStopView(view: StopDetail): RoundStopView {
  return {
    id: view.id,
    sequence: view.sequence,
    status: view.status,
    orderId: view.orderId,
    orderReference: view.orderReference,
    orderStatus: view.orderStatus,
    merchantName: view.merchantName,
    address: view.address,
    latitude: view.latitude,
    longitude: view.longitude,
    accessInstructions: view.accessInstructions,
    packages: view.packages,
    items: view.items,
    estimatedArrivalAt: view.estimatedArrivalAt,
    deliveredAt: view.deliveredAt,
    incident: view.incident,
  };
}

async function companyDrivers(db: Pick<RoundDb, "role" | "user">, companyId: string) {
  const roles = await db.role.findMany({ where: { systemRole: "DRIVER" }, select: { id: true } });
  if (roles.length === 0) return [];
  const users = await db.user.findMany({
    where: { companyId, status: "ACTIVE", roleId: { in: roles.map((role) => role.id) } },
    select: { id: true, firstName: true, lastName: true },
  });
  return users
    .map((user) => ({ id: user.id, name: personName(user) ?? user.id }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export async function getRoundsDay(companyId: string, day: DayLockState, db: RoundDb = prisma as unknown as RoundDb): Promise<AdminRoundsDay> {
  const date = deliveryDateKey(day.date);
  const dbDate = deliveryDateToDb(date);
  // Deux allers-retours en tout vers la base (le back-office est loin de la base en développement).
  const [company, rounds, slots, driverRoles, journalRows, dateOrders] = await Promise.all([
    loadCompany(db, companyId),
    db.round.findMany({
      where: { companyId, date: dbDate },
      select: { id: true, name: true, slotId: true, status: true, driverId: true, startedAt: true, completedAt: true, createdAt: true },
    }),
    db.slot.findMany({ where: { companyId }, select: { id: true, label: true, startTime: true, endTime: true, active: true, sortOrder: true } }),
    db.role.findMany({ where: { systemRole: "DRIVER" }, select: { id: true } }),
    db.auditLog.findMany({
      where: { companyId, entityType: ROUND_AUDIT_ENTITY, entityId: date },
      select: { id: true, actorId: true, action: true, before: true, after: true, createdAt: true },
    }),
    db.order.findMany({ where: { companyId, deliveryDate: dbDate }, select: { id: true, reference: true, status: true, merchantId: true } }),
  ]);
  const visibleRounds = rounds.filter((round) => round.status !== "CANCELLED");
  const actorIds = [...new Set(journalRows.map((row) => row.actorId).filter((id): id is string => Boolean(id)))];
  const roundDriverIds = [...new Set(visibleRounds.map((round) => round.driverId).filter((id): id is string => Boolean(id)))];
  const [stops, people] = await Promise.all([
    visibleRounds.length
      ? (db.stop.findMany({
          where: { companyId, roundId: { in: visibleRounds.map((round) => round.id) } },
          select: {
            id: true,
            roundId: true,
            orderId: true,
            sequence: true,
            status: true,
            estimatedArrivalAt: true,
            deliveredAt: true,
            incidentCode: true,
            incidentComment: true,
            incidentPhotoPath: true,
            incidentAt: true,
          },
        }) as Promise<StopRow[]>)
      : Promise.resolve([] as StopRow[]),
    db.user.findMany({
      where: {
        companyId,
        OR: [
          { status: "ACTIVE", roleId: { in: driverRoles.map((role) => role.id) } },
          { id: { in: [...actorIds, ...roundDriverIds] } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, status: true, roleId: true },
    }),
  ]);
  const { views } = await loadStopDetails(db, companyId, stops, dateOrders);
  const driverRoleIds = new Set(driverRoles.map((role) => role.id));
  const drivers = people
    .filter((user) => user.status === "ACTIVE" && driverRoleIds.has(user.roleId))
    .map((user) => ({ id: user.id, name: personName(user) ?? user.id }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const withStop = new Set(stops.map((stop) => stop.orderId));
  const unroutedOrders = dateOrders.filter((order) => (order.status === "LOCKED" || order.status === "PREPARED") && !withStop.has(order.id)).length;

  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const driverById = new Map(drivers.map((driver) => [driver.id, driver.name]));
  // Livreur désactivé depuis l'attribution : son nom reste affiché.
  const userName = new Map(people.map((user) => [user.id, personName(user)]));

  const roundViews: AdminRoundView[] = visibleRounds
    .map((round) => {
      const slot = slotById.get(round.slotId);
      const own = stops
        .filter((stop) => stop.roundId === round.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((stop) => adminStopView(views.get(stop.id)!));
      return {
        id: round.id,
        name: round.name ?? "",
        slotId: round.slotId,
        slotLabel: slot ? slotLabel(slot) : "",
        status: round.status,
        driverId: round.driverId,
        driverName: round.driverId ? driverById.get(round.driverId) ?? userName.get(round.driverId) ?? null : null,
        startedAt: round.startedAt?.toISOString() ?? null,
        completedAt: round.completedAt?.toISOString() ?? null,
        progress: roundProgress(own),
        stops: own,
      };
    })
    .sort((a, b) => {
      const created = (id: string) => visibleRounds.find((round) => round.id === id)?.createdAt.getTime() ?? 0;
      return (
        (slotById.get(a.slotId)?.startTime ?? "").localeCompare(slotById.get(b.slotId)?.startTime ?? "") ||
        a.name.localeCompare(b.name, "fr") ||
        created(a.id) - created(b.id)
      );
    });

  const usedSlots = new Set(roundViews.map((round) => round.slotId));
  const slotViews = slots
    .filter((slot) => slot.active || usedSlots.has(slot.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.sortOrder - b.sortOrder)
    .map((slot) => ({ id: slot.id, label: slotLabel(slot), startTime: slot.startTime }));

  const journal: RoundJournalEntry[] = journalRows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => {
      const after = (row.after ?? {}) as Record<string, unknown>;
      const before = (row.before ?? {}) as Record<string, unknown>;
      const roundName = (typeof after.roundName === "string" ? after.roundName : null) ?? (typeof before.roundName === "string" ? before.roundName : null);
      return {
        id: row.id,
        at: row.createdAt.toISOString(),
        actorName: row.actorId ? userName.get(row.actorId) ?? null : null,
        action: row.action,
        roundName: row.action === "STOP_MOVE" ? null : roundName,
        details: describeRoundAudit(row.action, row.before, row.after),
        afterCutoff: after.afterCutoff === true,
      };
    });

  return {
    date,
    cutoffAt: day.cutoffAt.toISOString(),
    closed: day.closed,
    depot: depotOf(company),
    slots: slotViews,
    rounds: roundViews,
    drivers,
    unroutedOrders,
    journal,
  };
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

async function findRound(tx: Pick<RoundDb, "round">, companyId: string, roundId: string) {
  const round = await tx.round.findFirst({ where: { id: roundId, companyId } });
  if (!round) throw new DomainRuleError(404, t.errors.roundNotFound, "ROUND_NOT_FOUND");
  return round;
}

function assertEditable(status: RoundStatus) {
  if (!EDITABLE_ROUND_STATUSES.includes(status)) throw new DomainRuleError(409, t.errors.notEditable, "ROUND_NOT_EDITABLE");
}

async function roundStops(tx: Pick<RoundDb, "stop">, companyId: string, roundId: string) {
  const stops = await tx.stop.findMany({ where: { companyId, roundId }, select: { id: true, sequence: true, status: true, orderId: true, roundId: true } });
  return stops.sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
}

/** Écrit l'ordre 1, 2, 3… ; seuls les arrêts dont le numéro ou la tournée change sont réécrits. */
async function writeSequences(
  tx: Pick<RoundDb, "stop">,
  companyId: string,
  roundId: string,
  orderedIds: readonly string[],
  current: ReadonlyArray<{ id: string; sequence: number; roundId?: string }>
) {
  const before = new Map(current.map((row) => [row.id, row]));
  const changes = sequenceUpdates(orderedIds).filter(({ id, sequence }) => {
    const row = before.get(id);
    return !row || row.sequence !== sequence || (row.roundId !== undefined && row.roundId !== roundId);
  });
  if (changes.length === 0) return;
  for (const { id, sequence } of changes) await tx.stop.update({ where: { id }, data: { roundId, sequence } });
  // L'heure estimée n'a plus de sens une fois l'ordre changé à la main.
  await tx.stop.updateMany({ where: { companyId, roundId, estimatedArrivalAt: { not: null } }, data: { estimatedArrivalAt: null } });
}

async function stopNames(tx: Pick<RoundDb, "order" | "merchant">, companyId: string, orderIds: readonly string[]): Promise<Map<string, string>> {
  if (orderIds.length === 0) return new Map();
  const orders = await tx.order.findMany({ where: { companyId, id: { in: [...orderIds] } }, select: { id: true, merchantId: true } });
  const merchants = await tx.merchant.findMany({
    where: { companyId, id: { in: [...new Set(orders.map((order) => order.merchantId))] } },
    select: { id: true, name: true, tradeName: true },
  });
  const merchantById = new Map(merchants.map((merchant) => [merchant.id, merchant]));
  return new Map(orders.map((order) => [order.id, merchantDisplayName(merchantById.get(order.merchantId))]));
}

/** Une tournée démarrée dont plus aucun arrêt n'est à livrer est terminée. */
async function completeIfDone(tx: Pick<RoundDb, "round" | "stop">, companyId: string, roundId: string, now: Date) {
  const round = await tx.round.findFirst({ where: { id: roundId, companyId }, select: { id: true, status: true } });
  if (!round || round.status !== "IN_PROGRESS") return;
  const stops = await tx.stop.findMany({ where: { companyId, roundId }, select: { status: true } });
  if (stops.length > 0 && stops.every((stop) => stop.status !== "PENDING")) {
    await tx.round.update({ where: { id: roundId }, data: { status: "COMPLETED", completedAt: now } });
  }
}

function afterCutoffOf(company: { cutoffTime: string; timezone: string }, date: string, now: Date) {
  return !isOrderEditable(date, now, company.cutoffTime, company.timezone);
}

/** Crée une tournée vide pour un créneau (ADM-06), après l'heure limite seulement. */
export async function createRound(actor: AdminActor, input: { date: string; slotId: string }, deps: RoundAdminDeps = {}) {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const date = deliveryDateKey(input.date);
  const company = await loadCompany(db, actor.companyId);
  if (!afterCutoffOf(company, date, now)) throw new DomainRuleError(409, t.errors.notClosed, "DAY_NOT_CLOSED");
  return db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const slot = await tx.slot.findFirst({ where: { id: input.slotId, companyId: actor.companyId } });
    if (!slot) throw new DomainRuleError(404, t.errors.slotNotFound, "SLOT_NOT_FOUND");
    const existing = await tx.round.findMany({ where: { companyId: actor.companyId, date: deliveryDateToDb(date), slotId: slot.id }, select: { name: true } });
    const names = new Set(existing.map((round) => round.name));
    let index = existing.length + 1;
    let name = t.newRoundName(slotLabel(slot), index);
    while (names.has(name) && index < 26) name = t.newRoundName(slotLabel(slot), ++index);
    const round = await tx.round.create({
      data: { companyId: actor.companyId, date: deliveryDateToDb(date), slotId: slot.id, name, status: "DRAFT", driverId: null },
    });
    await writeRoundAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      date,
      action: "ROUND_CREATE",
      after: { roundId: round.id, roundName: name, slotLabel: slotLabel(slot), afterCutoff: true },
      at: now,
    });
    return { id: round.id, name };
  }, TX_OPTIONS);
}

/** Supprime une tournée sans arrêt (ADM-06). Une tournée en cours n'est jamais supprimée. */
export async function deleteRound(actor: AdminActor, roundId: string, deps: RoundAdminDeps = {}) {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const [company, initial] = await Promise.all([loadCompany(db, actor.companyId), findRound(db, actor.companyId, roundId)]);
  const date = deliveryDateKey(initial.date);
  return db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const round = await findRound(tx, actor.companyId, roundId);
    if (round.status === "IN_PROGRESS") throw new DomainRuleError(409, t.errors.inProgress, "ROUND_IN_PROGRESS");
    const count = await tx.stop.count({ where: { companyId: actor.companyId, roundId } });
    if (count > 0) throw new DomainRuleError(409, t.errors.notEmpty, "ROUND_NOT_EMPTY");
    await tx.round.delete({ where: { id: roundId } });
    await writeRoundAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      date,
      action: "ROUND_DELETE",
      before: { roundId, roundName: round.name },
      after: { afterCutoff: afterCutoffOf(company, date, now) },
      at: now,
    });
    return { id: roundId };
  }, TX_OPTIONS);
}

/**
 * ADM-07 : attribue (ou retire) le livreur d'une tournée. Une tournée déjà validée qui change de livreur
 * est notifiée au nouveau livreur ; un retrait remet la tournée en brouillon (elle disparaît de l'app).
 */
export async function assignRoundDriver(actor: AdminActor, roundId: string, driverId: string | null, deps: RoundAdminDeps = {}) {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const notify = deps.notifyDriver ?? defaultNotifier;
  const [company, initial, drivers] = await Promise.all([loadCompany(db, actor.companyId), findRound(db, actor.companyId, roundId), companyDrivers(db, actor.companyId)]);
  const date = deliveryDateKey(initial.date);
  const driver = driverId ? drivers.find((candidate) => candidate.id === driverId) : null;
  if (driverId && !driver) throw new DomainRuleError(404, t.errors.driverNotFound, "DRIVER_NOT_FOUND");

  const result = await db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const round = await findRound(tx, actor.companyId, roundId);
    assertEditable(round.status);
    if (round.driverId === driverId) return { round, changed: false, previousName: null as string | null };
    if (!driverId && round.status === "IN_PROGRESS") throw new DomainRuleError(409, t.errors.inProgressDriver, "ROUND_IN_PROGRESS");
    const status: RoundStatus = !driverId && round.status === "ASSIGNED" ? "DRAFT" : round.status;
    const updated = await tx.round.update({ where: { id: roundId }, data: { driverId, status } });
    const previous = round.driverId ? drivers.find((candidate) => candidate.id === round.driverId)?.name ?? null : null;
    await writeRoundAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      date,
      action: "ROUND_ASSIGN",
      before: { roundId, roundName: round.name, driverId: round.driverId, driverName: previous, status: round.status },
      after: { driverId, driverName: driver?.name ?? null, status, roundName: round.name, afterCutoff: afterCutoffOf(company, date, now) },
      at: now,
    });
    return { round: updated, changed: true, previousName: previous };
  }, TX_OPTIONS);

  if (result.changed && driverId && (result.round.status === "ASSIGNED" || result.round.status === "IN_PROGRESS")) {
    await notifySafely(notify, { companyId: actor.companyId, roundId, driverId });
  }
  return { id: roundId, driverId, driverName: driver?.name ?? null, status: result.round.status };
}

/** ADM-06 : nouvel ordre complet des arrêts d'une tournée (glisser-déposer ou flèches). */
export async function reorderRoundStops(actor: AdminActor, roundId: string, stopIds: readonly string[], deps: RoundAdminDeps = {}) {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const [company, initial] = await Promise.all([loadCompany(db, actor.companyId), findRound(db, actor.companyId, roundId)]);
  const date = deliveryDateKey(initial.date);
  return db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const round = await findRound(tx, actor.companyId, roundId);
    assertEditable(round.status);
    const stops = await roundStops(tx, actor.companyId, roundId);
    const ordered = validateStopOrder(stops.map((stop) => stop.id), stopIds);
    if (!ordered) throw new DomainRuleError(409, t.errors.orderMismatch, "ROUND_ORDER_MISMATCH");
    const unchanged = ordered.every((id, index) => stops[index]?.id === id && stops[index]?.sequence === index + 1);
    if (unchanged) return { id: roundId, stopIds: ordered };
    await writeSequences(tx, actor.companyId, roundId, ordered, stops);
    const names = await stopNames(tx, actor.companyId, stops.map((stop) => stop.orderId));
    const orderOf = new Map(stops.map((stop) => [stop.id, stop.orderId]));
    await writeRoundAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      date,
      action: "ROUND_REORDER",
      before: { roundId, roundName: round.name, stops: stops.map((stop) => names.get(stop.orderId) ?? "") },
      after: { roundName: round.name, stops: ordered.map((id) => names.get(orderOf.get(id) ?? "") ?? ""), afterCutoff: afterCutoffOf(company, date, now) },
      at: now,
    });
    return { id: roundId, stopIds: ordered };
  }, TX_OPTIONS);
}

/**
 * ADM-06, critère 6 : déplace un arrêt encore à livrer vers une autre tournée du même jour et du même
 * créneau (RG-08), à la position voulue (en dernier par défaut). Les deux tournées sont renumérotées
 * sans trou.
 */
export async function moveStop(actor: AdminActor, stopId: string, input: { roundId: string; position?: number | null }, deps: RoundAdminDeps = {}) {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const [company, initialStop] = await Promise.all([loadCompany(db, actor.companyId), db.stop.findFirst({ where: { id: stopId, companyId: actor.companyId } })]);
  if (!initialStop) throw new DomainRuleError(404, t.errors.stopNotFound, "STOP_NOT_FOUND");
  const initialRound = await findRound(db, actor.companyId, initialStop.roundId);
  const date = deliveryDateKey(initialRound.date);

  const result = await db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const stop = await tx.stop.findFirst({ where: { id: stopId, companyId: actor.companyId } });
    if (!stop) throw new DomainRuleError(404, t.errors.stopNotFound, "STOP_NOT_FOUND");
    if (stop.status !== "PENDING") throw new DomainRuleError(409, t.errors.stopDone, "STOP_DONE");
    const source = await findRound(tx, actor.companyId, stop.roundId);
    const target = await findRound(tx, actor.companyId, input.roundId);
    if (source.id === target.id) throw new DomainRuleError(409, t.errors.sameRound, "SAME_ROUND");
    assertEditable(source.status);
    assertEditable(target.status);
    if (deliveryDateKey(source.date) !== deliveryDateKey(target.date) || source.slotId !== target.slotId) {
      throw new DomainRuleError(409, t.errors.otherSlot, "OTHER_SLOT");
    }
    const sourceStops = await roundStops(tx, actor.companyId, source.id);
    const targetStops = await roundStops(tx, actor.companyId, target.id);
    const next = moveStopBetween(sourceStops.map((row) => row.id), targetStops.map((row) => row.id), stopId, input.position ?? null);
    await writeSequences(tx, actor.companyId, source.id, next.source, sourceStops);
    await writeSequences(tx, actor.companyId, target.id, next.target, targetStops);
    const names = await stopNames(tx, actor.companyId, [stop.orderId]);
    await writeRoundAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      date,
      action: "STOP_MOVE",
      before: { stopId, roundId: source.id, roundName: source.name, merchantName: names.get(stop.orderId) ?? "", sequence: stop.sequence },
      after: { roundId: target.id, roundName: target.name, sequence: next.target.indexOf(stopId) + 1, afterCutoff: afterCutoffOf(company, date, now) },
      at: now,
    });
    await completeIfDone(tx, actor.companyId, source.id, now);
    return { stopId, roundId: target.id, sequence: next.target.indexOf(stopId) + 1 };
  }, TX_OPTIONS);
  return result;
}

/**
 * ADM-06 : recalcule l'ordre d'une tournée avec le calcul existant. Les arrêts déjà livrés ou signalés
 * gardent leur place en tête ; les arrêts à livrer sont ordonnés à partir du dernier arrêt fait (ou du
 * laboratoire). Le temps de trajet est calculé hors transaction (réseau), puis l'état est relu.
 */
export async function optimizeRound(actor: AdminActor, roundId: string, deps: RoundAdminDeps = {}) {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const travelMatrix = deps.travelMatrix ?? ((points: GeoPoint[]) => estimateTravelMatrix(points));
  const [company, round] = await Promise.all([loadCompany(db, actor.companyId), findRound(db, actor.companyId, roundId)]);
  assertEditable(round.status);
  const date = deliveryDateKey(round.date);
  const stops = await roundStops(db, actor.companyId, roundId);
  const { views } = await loadStopDetails(db, actor.companyId, stops.map((stop) => ({
    ...stop,
    roundId,
    estimatedArrivalAt: null,
    deliveredAt: null,
    incidentCode: null,
    incidentComment: null,
    incidentPhotoPath: null,
    incidentAt: null,
  })));
  const pointOf = (id: string): GeoPoint | null => {
    const view = views.get(id);
    return view && view.latitude !== null && view.longitude !== null ? { latitude: view.latitude, longitude: view.longitude } : null;
  };
  const done = stops.filter((stop) => stop.status !== "PENDING");
  const pending = stops.filter((stop) => stop.status === "PENDING");
  const lastDone = [...done].reverse().map((stop) => pointOf(stop.id)).find((point) => point !== null) ?? null;
  const start = lastDone ?? depotOf(company);
  const points = [...(start ? [start] : []), ...pending.map((stop) => pointOf(stop.id)).filter((point): point is GeoPoint => point !== null)];
  const matrix = points.length > 1 ? await travelMatrix(points) : { seconds: () => 0, approximate: false };
  const pendingOrder = orderRoundStops({
    start,
    stops: pending.map((stop) => ({ id: stop.id, point: pointOf(stop.id), label: views.get(stop.id)?.merchantName ?? "" })),
    travelSeconds: matrix.seconds,
  });
  const ordered = [...done.map((stop) => stop.id), ...pendingOrder];

  await db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const current = await findRound(tx, actor.companyId, roundId);
    assertEditable(current.status);
    const liveStops = await roundStops(tx, actor.companyId, roundId);
    const sameSet = validateStopOrder(liveStops.map((stop) => stop.id), ordered);
    const sameDone = liveStops.filter((stop) => stop.status !== "PENDING").every((stop) => done.some((row) => row.id === stop.id));
    if (!sameSet || !sameDone) throw new DomainRuleError(409, t.errors.orderMismatch, "ROUND_ORDER_MISMATCH");
    await writeSequences(tx, actor.companyId, roundId, ordered, liveStops);
    const nameOf = new Map([...views.values()].map((view) => [view.id, view.merchantName]));
    await writeRoundAudit(tx, {
      companyId: actor.companyId,
      actorId: actor.userId,
      date,
      action: "ROUND_OPTIMIZE",
      before: { roundId, roundName: current.name, stops: liveStops.map((stop) => nameOf.get(stop.id) ?? "") },
      after: { roundName: current.name, stops: ordered.map((id) => nameOf.get(id) ?? ""), approximate: matrix.approximate, afterCutoff: afterCutoffOf(company, date, now) },
      at: now,
    });
  }, TX_OPTIONS);
  return { id: roundId, stopIds: ordered, approximate: matrix.approximate };
}

/**
 * ADM-07 : « Valider les tournées » d'un jour : chaque brouillon qui a un livreur et au moins un arrêt
 * passe en ASSIGNED (visible dans l'application du livreur, qui est notifié). Les autres sont listés.
 */
export async function validateRounds(actor: AdminActor, dateInput: string, deps: RoundAdminDeps = {}): Promise<ValidateRoundsResult> {
  const db = deps.db ?? (prisma as unknown as RoundDb);
  const now = deps.now ?? new Date();
  const notify = deps.notifyDriver ?? defaultNotifier;
  const date = deliveryDateKey(dateInput);
  const [company, drivers] = await Promise.all([loadCompany(db, actor.companyId), companyDrivers(db, actor.companyId)]);
  const driverName = new Map(drivers.map((driver) => [driver.id, driver.name]));

  const outcome = await db.$transaction(async (tx) => {
    await acquireDayLock(tx, actor.companyId, date);
    const drafts = await tx.round.findMany({ where: { companyId: actor.companyId, date: deliveryDateToDb(date), status: "DRAFT" } });
    const counts = new Map<string, number>();
    if (drafts.length) {
      const stops = await tx.stop.findMany({ where: { companyId: actor.companyId, roundId: { in: drafts.map((round) => round.id) } }, select: { roundId: true } });
      for (const stop of stops) counts.set(stop.roundId, (counts.get(stop.roundId) ?? 0) + 1);
    }
    const validated: Array<{ id: string; driverId: string }> = [];
    const withoutDriver: string[] = [];
    const empty: string[] = [];
    for (const round of drafts.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr"))) {
      if ((counts.get(round.id) ?? 0) === 0) {
        empty.push(round.name ?? "");
        continue;
      }
      if (!round.driverId || !driverName.has(round.driverId)) {
        withoutDriver.push(round.name ?? "");
        continue;
      }
      await tx.round.update({ where: { id: round.id }, data: { status: "ASSIGNED" } });
      await writeRoundAudit(tx, {
        companyId: actor.companyId,
        actorId: actor.userId,
        date,
        action: "ROUND_VALIDATE",
        before: { roundId: round.id, status: "DRAFT" },
        after: { roundName: round.name, status: "ASSIGNED", driverName: driverName.get(round.driverId) ?? null, afterCutoff: afterCutoffOf(company, date, now) },
        at: now,
      });
      validated.push({ id: round.id, driverId: round.driverId });
    }
    return { validated, withoutDriver, empty };
  }, TX_OPTIONS);

  for (const round of outcome.validated) await notifySafely(notify, { companyId: actor.companyId, roundId: round.id, driverId: round.driverId });
  return { validated: outcome.validated.length, withoutDriver: outcome.withoutDriver, empty: outcome.empty };
}
