/**
 * NOTIF-1 — notifications du client (le commerçant livré).
 *
 * NOT-01 (rappel) : `reminderLeadMinutes` avant l'heure limite de J−1, le client actif qui n'a aucune
 *   commande pour le lendemain (annulée ou brouillon = aucune) et aucune commande récurrente active
 *   couvrant ce jour de la semaine reçoit un rappel. Une seule fois par compte, par client et par date :
 *   clé de tâche `not01:{merchantId}:{date}:{userId}`. Déclenché par `/api/cron/order-reminders`
 *   (même workflow que le verrouillage, toutes les 10 minutes) ; un passage en retard rattrape le
 *   rappel tant que l'heure limite n'est pas atteinte, jamais après. Délai 0 : pas de rappel. Le client
 *   peut couper ce rappel (Paramètres › Alertes : `orderReminders`).
 * NOT-02 (confirmation) : à chaque commande validée, modifiée ou annulée par le client, et après une
 *   correction ou une annulation de l'administrateur. Regroupement : au plus une confirmation toutes les
 *   5 minutes par commande. La première part tout de suite ; une modification dans les 5 minutes qui
 *   suivent crée une confirmation différée à la fin de la fenêtre, et les suivantes s'y regroupent. Le
 *   contenu (date, créneau, lignes, total) est relu à l'envoi : la confirmation porte l'état final.
 * NOT-03 (livreur en approche) : quand un arrêt est marqué livré (ou en problème : le livreur repart),
 *   le premier arrêt restant de la tournée dans l'ordre est prévenu ; au démarrage de la tournée, le
 *   premier arrêt l'est aussi (le livreur part vers lui). Une seule fois par arrêt (clé
 *   `not03:{stopId}:{userId}`), y compris quand « Livré » arrive par rejeu hors réseau ; un arrêt déjà
 *   livré au moment de l'envoi n'est plus prévenu.
 *
 * Destinataires : comptes actifs rattachés au client (`User.merchantId`, statut ACTIVE). Chaque tâche vise
 * un compte : clé, fenêtre de déduplication et instantané d'e-mail propres. Canaux : voir
 * `notification-channels.ts` (application, e-mail ; natif avec MOBILE-1).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { readClientSettings } from "@/domains/client-portal/settings.service";
import { computeTotals, loadAppliedPrices } from "@/domains/catalog/pricing";
import { enqueueOperationJob, skippedJobError } from "@/domains/operations/operation-job.service";
import { slotLabel } from "@/domains/order/merchant-order.service";
import {
  companyToday,
  deliveryDateKey,
  deliveryDateToDb,
  isoWeekday,
  orderCutoffInstant,
} from "@/domains/order/order-deadline";
import {
  dispatchNotification,
  notificationChannels,
  type NotificationChannel,
  type NotificationMessage,
  type NotificationRecipient,
} from "@/domains/notification/notification-channels";
// MOBILE-1 : ajoute le canal des notifications natives (APNs / FCM), inactif sans clés.
import "@/domains/notification/native-push-channel";
import type { EmailContentFreezer, ReplayWindowStart } from "@/lib/email/transactional-email";
import { addDaysToDateKey, deadlineLabel, longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

const t = fr.notifications;

/** NOT-02 : fenêtre de regroupement des confirmations d'une même commande. */
export const CONFIRMATION_WINDOW_MS = 5 * 60_000;

export type NotificationDb = Pick<
  PrismaClient,
  "company" | "merchant" | "user" | "order" | "orderLine" | "product" | "merchantPrice" | "slot" | "recurringOrder" | "stop" | "round" | "operationJob"
>;
type EnqueueDb = Pick<Prisma.TransactionClient, "user" | "operationJob">;
const defaultDb = () => prisma as unknown as NotificationDb;

/** Comptes actifs du client : les seuls destinataires de ses notifications. */
async function merchantRecipients(db: Pick<EnqueueDb, "user">, companyId: string, merchantId: string) {
  const users = await db.user.findMany({
    where: { companyId, merchantId, status: "ACTIVE" },
    select: { id: true },
  });
  return users.map((user) => user.id).sort();
}

// ---------------------------------------------------------------------------
// NOT-01 : rappel avant l'heure limite
// ---------------------------------------------------------------------------

export interface ReminderRunResult {
  companies: number;
  /** Dates dont la fenêtre de rappel est ouverte. */
  windows: Array<{ companyId: string; date: string }>;
  queued: number;
  jobIds: string[];
}

/**
 * Prépare les rappels dus à l'instant `now` pour toutes les entreprises actives (ou une seule).
 * Idempotent : les clés de tâche empêchent tout doublon, quel que soit le nombre de passages.
 */
export async function queueOrderReminders(options: { now?: Date; db?: NotificationDb; companyId?: string } = {}): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const db = options.db ?? defaultDb();
  const companies = await db.company.findMany({
    where: { status: { in: ["ACTIVE", "TRIAL"] }, ...(options.companyId ? { id: options.companyId } : {}) },
    select: { id: true, cutoffTime: true, timezone: true, reminderLeadMinutes: true },
  });
  const result: ReminderRunResult = { companies: companies.length, windows: [], queued: 0, jobIds: [] };
  for (const company of companies) {
    if (!(company.reminderLeadMinutes > 0)) continue;
    const date = addDaysToDateKey(companyToday(now, company.timezone), 1);
    const cutoff = orderCutoffInstant(date, company.cutoffTime, company.timezone);
    const remindAt = new Date(cutoff.getTime() - company.reminderLeadMinutes * 60_000);
    if (now.getTime() < remindAt.getTime() || now.getTime() >= cutoff.getTime()) continue;
    result.windows.push({ companyId: company.id, date });

    const merchantIds = await merchantsToRemind(db, company.id, date);
    for (const merchantId of merchantIds) {
      for (const userId of await merchantRecipients(db, company.id, merchantId)) {
        const job = await enqueueOperationJob(db, {
          jobKey: `not01:${merchantId}:${date}:${userId}`,
          type: "CLIENT_NOTIFICATION",
          companyId: company.id,
          payload: { kind: "ORDER_REMINDER", companyId: company.id, merchantId, userId, deliveryDate: date },
        });
        if (job.status === "PENDING") {
          result.queued += 1;
          result.jobIds.push(job.id);
        }
      }
    }
  }
  return result;
}

/** Clients actifs sans commande (hors annulée et brouillon) ni récurrente active ce jour-là. */
export async function merchantsToRemind(db: Pick<NotificationDb, "merchant" | "order" | "recurringOrder">, companyId: string, date: string) {
  const weekday = isoWeekday(date);
  const [merchants, orders, recurrings] = await Promise.all([
    db.merchant.findMany({ where: { companyId, active: true }, select: { id: true } }),
    db.order.findMany({
      where: { companyId, deliveryDate: deliveryDateToDb(date), status: { notIn: ["CANCELLED", "DRAFT"] } },
      select: { merchantId: true },
    }),
    db.recurringOrder.findMany({ where: { companyId, active: true }, select: { merchantId: true, weekdays: true } }),
  ]);
  const covered = new Set<string>([
    ...orders.map((order) => order.merchantId),
    ...recurrings.filter((row) => row.weekdays.includes(weekday)).map((row) => row.merchantId),
  ]);
  return merchants.map((merchant) => merchant.id).filter((id) => !covered.has(id)).sort();
}

// ---------------------------------------------------------------------------
// NOT-02 : confirmation de commande
// ---------------------------------------------------------------------------

export type ConfirmationSource = "MERCHANT" | "ADMIN";

/**
 * File la confirmation d'une commande qui vient d'être validée, modifiée ou annulée. Renvoie les tâches
 * à lancer tout de suite (vide si la confirmation est différée ou regroupée dans une confirmation en attente).
 */
export async function queueOrderConfirmation(
  input: { companyId: string; orderId: string; merchantId: string; source: ConfirmationSource },
  options: { now?: Date; db?: EnqueueDb } = {}
): Promise<{ immediate: string[]; deferredUntil: Date | null; grouped: boolean }> {
  const now = options.now ?? new Date();
  const db = options.db ?? (prisma as unknown as EnqueueDb);
  const prefix = `not02:${input.orderId}:`;
  const previous = (await db.operationJob.findMany({
    where: { companyId: input.companyId, jobKey: { startsWith: prefix } },
    select: { jobKey: true, status: true, attempts: true, nextAttemptAt: true },
  })).map((job) => ({ ...job, revision: Number(job.jobKey.slice(prefix.length).split(":")[0]) }))
    .filter((job) => Number.isInteger(job.revision))
    .sort((a, b) => b.revision - a.revision);
  const latest = previous[0];
  const latestRevision = latest?.revision ?? -1;
  // Confirmation pas encore partie : elle relira l'état final de la commande.
  if (latest && previous.some((job) => job.revision === latestRevision && job.status === "PENDING" && job.attempts === 0)) {
    return { immediate: [], deferredUntil: null, grouped: true };
  }
  const due = latest ? new Date(latest.nextAttemptAt.getTime() + CONFIRMATION_WINDOW_MS) : now;
  const deferred = due.getTime() > now.getTime();
  const revision = latestRevision + 1;
  const immediate: string[] = [];
  for (const userId of await merchantRecipients(db, input.companyId, input.merchantId)) {
    const job = await enqueueOperationJob(db, {
      jobKey: `${prefix}${revision}:${userId}`,
      type: "CLIENT_NOTIFICATION",
      companyId: input.companyId,
      payload: { kind: "ORDER_CONFIRMATION", companyId: input.companyId, orderId: input.orderId, userId, source: input.source, revision },
      ...(deferred ? { nextAttemptAt: due } : {}),
    });
    if (!deferred) immediate.push(job.id);
  }
  return { immediate, deferredUntil: deferred ? due : null, grouped: false };
}

/**
 * Appelé par les routes après l'enregistrement : une confirmation ratée n'annule jamais la commande.
 */
export async function confirmOrderChange(input: { companyId: string; orderId: string; merchantId: string; source: ConfirmationSource }) {
  try {
    const { immediate } = await queueOrderConfirmation(input);
    if (immediate.length > 0) {
      const { kickOperationJobs } = await import("@/domains/operations/operation-job.service");
      kickOperationJobs(immediate);
    }
  } catch (error) {
    console.error("[NOTIF-1] confirmation de commande non mise en file", { orderId: input.orderId, error: error instanceof Error ? error.name : "unknown" });
  }
}

// ---------------------------------------------------------------------------
// NOT-03 : livreur en approche
// ---------------------------------------------------------------------------

type ApproachDb = Pick<Prisma.TransactionClient, "stop" | "order" | "user" | "operationJob">;

/**
 * Prévient le client du premier arrêt restant (PENDING) de la tournée, dans l'ordre, après l'arrêt
 * `afterSequence` (sinon le premier restant). À appeler dans la transaction qui livre ou démarre.
 */
export async function queueStopApproach(
  db: ApproachDb,
  input: { companyId: string; roundId: string; afterSequence?: number | null }
): Promise<string[]> {
  const pending = (await db.stop.findMany({
    where: { companyId: input.companyId, roundId: input.roundId, status: "PENDING" },
    select: { id: true, orderId: true, sequence: true },
  })).sort((a, b) => a.sequence - b.sequence);
  const after = typeof input.afterSequence === "number" ? input.afterSequence : null;
  const next = (after === null ? undefined : pending.find((stop) => stop.sequence > after)) ?? pending[0];
  if (!next) return [];
  const order = await db.order.findFirst({ where: { id: next.orderId, companyId: input.companyId }, select: { merchantId: true, status: true } });
  if (!order || order.status === "CANCELLED") return [];
  const ids: string[] = [];
  for (const userId of await merchantRecipients(db, input.companyId, order.merchantId)) {
    const job = await enqueueOperationJob(db, {
      jobKey: `not03:${next.id}:${userId}`,
      type: "CLIENT_NOTIFICATION",
      companyId: input.companyId,
      payload: { kind: "STOP_APPROACH", companyId: input.companyId, stopId: next.id, orderId: next.orderId, userId },
    });
    if (job.status === "PENDING") ids.push(job.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Envoi (tâche durable CLIENT_NOTIFICATION)
// ---------------------------------------------------------------------------

type ReminderPayload = { kind: "ORDER_REMINDER"; companyId: string; merchantId: string; userId: string; deliveryDate: string };
type ConfirmationPayload = { kind: "ORDER_CONFIRMATION"; companyId: string; orderId: string; userId: string; source: ConfirmationSource; revision: number };
type ApproachPayload = { kind: "STOP_APPROACH"; companyId: string; stopId: string; orderId: string; userId: string };
export type MerchantNotificationPayload = ReminderPayload | ConfirmationPayload | ApproachPayload;

function readPayload(raw: Prisma.JsonValue): MerchantNotificationPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("MERCHANT_NOTIFICATION_PAYLOAD_INVALID");
  const value = raw as Record<string, unknown>;
  const text = (key: string) => (typeof value[key] === "string" && value[key] ? (value[key] as string) : null);
  const companyId = text("companyId");
  const userId = text("userId");
  if (!companyId || !userId) throw new Error("MERCHANT_NOTIFICATION_PAYLOAD_INVALID");
  if (value.kind === "ORDER_REMINDER" && text("merchantId") && /^\d{4}-\d{2}-\d{2}$/.test(text("deliveryDate") ?? "")) {
    return { kind: "ORDER_REMINDER", companyId, userId, merchantId: text("merchantId")!, deliveryDate: text("deliveryDate")! };
  }
  if (value.kind === "ORDER_CONFIRMATION" && text("orderId")) {
    const source = value.source === "ADMIN" ? "ADMIN" : "MERCHANT";
    const revision = typeof value.revision === "number" && Number.isInteger(value.revision) ? value.revision : 0;
    return { kind: "ORDER_CONFIRMATION", companyId, userId, orderId: text("orderId")!, source, revision };
  }
  if (value.kind === "STOP_APPROACH" && text("stopId") && text("orderId")) {
    return { kind: "STOP_APPROACH", companyId, userId, stopId: text("stopId")!, orderId: text("orderId")! };
  }
  throw new Error("MERCHANT_NOTIFICATION_PAYLOAD_INVALID");
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? null;
}

function emailText(lines: Array<string | null>, href: string, company: string) {
  const base = appUrl();
  return [...lines.filter((line): line is string => line !== null), "", ...(base ? [t.portalLink(`${base}${href}`)] : []), t.signature(company)].join("\n");
}

type Company = { name: string; cutoffTime: string; timezone: string };

async function renderReminder(db: NotificationDb, payload: ReminderPayload, company: Company, now: Date): Promise<NotificationMessage | null> {
  const cutoff = orderCutoffInstant(payload.deliveryDate, company.cutoffTime, company.timezone);
  // Tâche retardée au-delà de l'heure limite : le rappel n'a plus de sens.
  if (now.getTime() >= cutoff.getTime()) return null;
  const merchant = await db.merchant.findFirst({ where: { id: payload.merchantId, companyId: payload.companyId }, select: { active: true } });
  if (!merchant?.active) return null;
  // Commande passée entre la mise en file et l'envoi : plus rien à rappeler.
  if (!(await merchantsToRemind(db, payload.companyId, payload.deliveryDate)).includes(payload.merchantId)) return null;
  const date = longDeliveryDateLabel(payload.deliveryDate);
  const deadline = deadlineLabel(cutoff, company.timezone);
  const body = t.reminder.body(date, deadline);
  const href = "/portal";
  return {
    type: "REMINDER",
    title: t.reminder.title,
    body,
    href,
    senderName: company.name,
    email: { subject: t.reminder.subject(date), text: emailText([body, "", t.reminder.optOut], href, company.name) },
  };
}

async function renderConfirmation(db: NotificationDb, payload: ConfirmationPayload, company: Company, merchantId: string): Promise<NotificationMessage | null> {
  const order = await db.order.findFirst({ where: { id: payload.orderId, companyId: payload.companyId, merchantId } });
  if (!order) return null;
  const [slot, lines] = await Promise.all([
    db.slot.findFirst({ where: { id: order.slotId, companyId: payload.companyId } }),
    db.orderLine.findMany({ where: { orderId: order.id, companyId: payload.companyId } }),
  ]);
  const productIds = lines.map((line) => line.productId);
  const [products, prices] = await Promise.all([
    db.product.findMany({ where: { companyId: payload.companyId, id: { in: productIds } }, select: { id: true, name: true, unit: true, sortOrder: true } }),
    loadAppliedPrices(db, payload.companyId, merchantId, productIds),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const priced = lines
    .map((line) => {
      const price = prices.get(line.productId);
      const product = productById.get(line.productId);
      return {
        name: product?.name ?? "Produit retiré",
        unit: product?.unit ?? "",
        sortOrder: product?.sortOrder ?? 0,
        quantity: line.quantityOrdered,
        unitPriceCents: line.unitPriceFrozenCents ?? price?.unitPriceCents ?? 0,
        vatRateBasisPoints: price?.vatRateBasisPoints ?? 0,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
  const totals = computeTotals(priced);
  const dateKey = deliveryDateKey(order.deliveryDate);
  const date = longDeliveryDateLabel(dateKey);
  const slotText = slot ? slotLabel(slot) : "";
  const cancelled = order.status === "CANCELLED";
  const title = cancelled
    ? t.confirmation.cancelled
    : payload.source === "ADMIN"
      ? t.confirmation.corrected
      : payload.revision > 0 ? t.confirmation.modified : t.confirmation.validated;
  const body = cancelled
    ? t.confirmation.cancelledBody(order.reference, date, slotText)
    : t.confirmation.body(order.reference, date, slotText, totals.itemCount, formatCents(totals.totalCents));
  const href = `/portal/orders/${order.id}`;
  const editable = ["DRAFT", "VALIDATED"].includes(order.status);
  const recap = cancelled
    ? []
    : [
        "",
        t.confirmation.recap,
        t.confirmation.delivery(date, slotText),
        ...priced.map((line) => t.confirmation.line(line.quantity, line.name, line.unit, formatCents(line.quantity * line.unitPriceCents))),
        t.confirmation.totals(formatCents(totals.subtotalCents), formatCents(totals.vatCents), formatCents(totals.totalCents)),
        editable ? t.confirmation.editableUntil(deadlineLabel(orderCutoffInstant(dateKey, company.cutoffTime, company.timezone), company.timezone)) : null,
      ];
  return {
    type: "ORDER",
    title,
    body,
    href,
    senderName: company.name,
    email: { subject: t.confirmation.subject(title, order.reference), text: emailText([body, ...recap], href, company.name) },
  };
}

async function renderApproach(db: NotificationDb, payload: ApproachPayload, company: Company, merchantId: string): Promise<NotificationMessage | null> {
  const stop = await db.stop.findFirst({ where: { id: payload.stopId, companyId: payload.companyId } });
  // Arrêt déjà livré, en problème ou retiré au moment de l'envoi : l'avis n'a plus d'objet.
  if (!stop || stop.status !== "PENDING" || stop.orderId !== payload.orderId) return null;
  const round = await db.round.findFirst({ where: { id: stop.roundId, companyId: payload.companyId }, select: { status: true } });
  if (!round || round.status !== "IN_PROGRESS") return null;
  const order = await db.order.findFirst({ where: { id: payload.orderId, companyId: payload.companyId, merchantId }, select: { id: true, reference: true } });
  if (!order) return null;
  const body = t.approach.body(order.reference);
  const href = `/portal/orders/${order.id}`;
  return {
    type: "APPROACH",
    title: t.approach.title,
    body,
    href,
    senderName: company.name,
    email: { subject: t.approach.subject, text: emailText([body], href, company.name) },
  };
}

/**
 * Exécute une tâche NOTIF-1 : relit l'état courant, construit le message et le remet par chaque canal.
 * Rien à envoyer (compte désactivé, client désactivé, commande passée entre-temps, arrêt déjà livré,
 * rappel coupé) : la tâche se termine sans effet. E-mail non configuré : la notification dans
 * l'application est créée, puis la tâche est close « ignorée » (SKIPPED:EMAIL_DISABLED) pour la trace.
 */
export async function deliverMerchantNotificationJob(
  raw: Prisma.JsonValue,
  eventKey: string,
  options: {
    replayWindow?: ReplayWindowStart;
    freezeContent?: EmailContentFreezer;
    db?: NotificationDb;
    channels?: readonly NotificationChannel[];
    now?: Date;
  } = {}
): Promise<{ delivered: boolean; outcomes?: Record<string, string> }> {
  const payload = readPayload(raw);
  const db = options.db ?? defaultDb();
  const now = options.now ?? new Date();
  const [user, company] = await Promise.all([
    db.user.findFirst({ where: { id: payload.userId, companyId: payload.companyId }, select: { id: true, email: true, status: true, merchantId: true, settings: true } }),
    db.company.findFirst({ where: { id: payload.companyId }, select: { name: true, cutoffTime: true, timezone: true, status: true } }),
  ]);
  if (!user || user.status !== "ACTIVE" || !user.merchantId || !company) return { delivered: false };
  if (company.status !== "ACTIVE" && company.status !== "TRIAL") return { delivered: false };
  const settings = readClientSettings(user.settings && typeof user.settings === "object" && !Array.isArray(user.settings) ? (user.settings as Record<string, unknown>) : {});

  let message: NotificationMessage | null = null;
  if (payload.kind === "ORDER_REMINDER") {
    if (!settings.orderReminders || user.merchantId !== payload.merchantId) return { delivered: false };
    message = await renderReminder(db, payload, company, now);
  } else if (payload.kind === "ORDER_CONFIRMATION") {
    message = await renderConfirmation(db, payload, company, user.merchantId);
  } else {
    message = await renderApproach(db, payload, company, user.merchantId);
  }
  if (!message) return { delivered: false };

  const recipient: NotificationRecipient = { userId: user.id, companyId: payload.companyId, email: user.email, emailCopy: settings.emailNotifications };
  const channels = options.channels ?? notificationChannels();
  const outcomes = await dispatchNotification(message, recipient, { eventKey, replayWindow: options.replayWindow ?? null, freezeContent: options.freezeContent }, channels);
  if (outcomes.email === "disabled") throw skippedJobError("EMAIL_DISABLED");
  return { delivered: true, outcomes };
}
