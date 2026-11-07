import { createHash } from "node:crypto";
import type { Prisma, StopStatus } from "@prisma/client";
import { CLIENT_NOTIFICATIONS_TAKE } from "@/lib/query/list-limits";
import {
  enqueueOperationJob,
  kickOperationJob,
} from "@/domains/operations/operation-job.service";
import {
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
  type EmailContentFreezer,
  type ReplayWindowStart,
} from "@/lib/email/transactional-email";
import { prisma } from "@/services/prisma/client";
import { getClientSettings } from "./settings.service";

/** ORDER (NOT-02), REMINDER (NOT-01), APPROACH (NOT-03) : NOTIF-1. */
export type ClientNotificationType = "DELIVERY" | "INVOICE" | "SUPPORT" | "ORDER" | "REMINDER" | "APPROACH";

const KNOWN_TYPES: readonly ClientNotificationType[] = ["DELIVERY", "INVOICE", "SUPPORT", "ORDER", "REMINDER", "APPROACH"];

export interface ClientNotificationItem {
  id: string;
  type: ClientNotificationType;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

type NotificationDatabase = Pick<Prisma.TransactionClient, "operationJob">;

/** Arrêt livré ou en incident : le client du commerçant est prévenu (NOT-03 complétera « en approche »). */
type DeliveryNotificationPayload = {
  kind: "DELIVERY";
  customerId: string;
  companyId: string;
  status: StopStatus;
  reference: string;
  orderId: string;
};

type InvoiceNotificationPayload = {
  kind: "INVOICE";
  customerId: string;
  companyId: string;
  reference: string;
  invoiceId: string;
  /** Montant TTC en centimes. */
  amountCents: number;
};

type ClientNotificationJobPayload = DeliveryNotificationPayload | InvoiceNotificationPayload;

const DELIVERY_COPY: Partial<Record<StopStatus, { title: string; body: (ref: string) => string }>> = {
  DELIVERED: {
    title: "Commande livrée",
    body: (ref) => `${ref} a été livrée.`,
  },
  INCIDENT: {
    title: "Livraison non effectuée",
    body: (ref) => `${ref} n’a pas pu être livrée. Nous revenons vers vous.`,
  },
};

/** Commandes et factures du commerçant que représente ce compte client. */
function merchantOwner(customerId: string, companyId: string) {
  return { companyId, merchant: { is: { companyId, users: { some: { id: customerId, companyId } } } } };
}

export function getEmailDeliveryConfigured() {
  return getTransactionalEmailConfiguration().enabled;
}

export function getEmailDeliveryMode() {
  return getTransactionalEmailConfiguration().mode;
}

function stableNotificationId(eventKey: string) {
  return `evt_${createHash("sha256").update(eventKey).digest("hex").slice(0, 24)}`;
}

/**
 * Toute erreur remonte à la tâche durable, rejouée avec la même clé (`eventKey`) et le même contenu :
 * refus certain ou issue inconnue → nouvel essai ; non confirmée (409 clé déjà utilisée avec un autre
 * contenu, fenêtre de déduplication dépassée) → erreur permanente, tâche FAILED sans renvoi.
 */
async function sendClientEmail(
  to: string,
  subject: string,
  text: string,
  idempotencyKey: string,
  replayWindowStart: ReplayWindowStart,
  freezeContent?: EmailContentFreezer
) {
  await sendTransactionalEmail({
    to,
    subject,
    text,
    idempotencyKey,
    replayWindowStart,
    freezeContent,
  });
}

type InAppDatabase = Pick<Prisma.TransactionClient, "clientNotification">;

/**
 * Notification dans l'application (cloche), idempotente : même `eventKey` → même ligne. Au-delà de
 * CLIENT_NOTIFICATIONS_TAKE notifications, les plus anciennes du compte sont effacées.
 */
export async function upsertInAppNotification(
  eventKey: string,
  input: { userId: string; companyId: string; type: ClientNotificationType; title: string; body: string; href: string | null },
  db: InAppDatabase = prisma
) {
  await db.clientNotification.upsert({
    where: { id: stableNotificationId(eventKey) },
    update: {},
    create: {
      id: stableNotificationId(eventKey),
      companyId: input.companyId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    },
  });

  const extra = (await db.clientNotification.findMany({
    where: { userId: input.userId },
    select: { id: true, createdAt: true },
  }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(CLIENT_NOTIFICATIONS_TAKE);
  if (extra.length > 0) {
    await db.clientNotification.deleteMany({
      where: { id: { in: extra.map((row) => row.id) } },
    });
  }
}

async function insertNotification(
  eventKey: string,
  input: {
    userId: string;
    companyId: string;
    type: ClientNotificationType;
    title: string;
    body: string;
    href: string | null;
    email?: { to: string; subject: string; text: string };
  },
  replayWindowStart: ReplayWindowStart,
  freezeContent?: EmailContentFreezer
) {
  await upsertInAppNotification(eventKey, input);

  if (input.email) {
    await sendClientEmail(
      input.email.to,
      input.email.subject,
      input.email.text,
      eventKey,
      replayWindowStart,
      freezeContent
    );
  }
}

export async function queueDeliveryStatusNotification(
  db: NotificationDatabase,
  input: {
    customerId: string | null;
    companyId: string;
    status: StopStatus;
    reference: string;
    orderId: string;
    eventId: string;
  }
) {
  if (!input.customerId || !DELIVERY_COPY[input.status]) return null;
  return enqueueOperationJob(db, {
    jobKey: `client-notification:delivery:${input.orderId}:${input.eventId}`,
    type: "CLIENT_NOTIFICATION",
    companyId: input.companyId,
    payload: {
      kind: "DELIVERY",
      customerId: input.customerId,
      companyId: input.companyId,
      status: input.status,
      reference: input.reference,
      orderId: input.orderId,
    },
  });
}

export async function queueInvoiceIssuedNotification(
  db: NotificationDatabase,
  input: {
    customerId: string | null;
    companyId: string;
    reference: string;
    invoiceId: string;
    amountCents: number;
  }
) {
  if (!input.customerId) return null;
  return enqueueOperationJob(db, {
    jobKey: `client-notification:invoice:${input.invoiceId}:issued`,
    type: "CLIENT_NOTIFICATION",
    companyId: input.companyId,
    payload: {
      kind: "INVOICE",
      customerId: input.customerId,
      companyId: input.companyId,
      reference: input.reference,
      invoiceId: input.invoiceId,
      amountCents: input.amountCents,
    },
  });
}

function parseNotificationPayload(payload: Prisma.JsonValue): ClientNotificationJobPayload {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
  }
  const value = payload as Record<string, Prisma.JsonValue>;
  const customerId = typeof value.customerId === "string" ? value.customerId : null;
  const companyId = typeof value.companyId === "string" ? value.companyId : null;
  const reference = typeof value.reference === "string" ? value.reference : null;
  if (!customerId || !companyId || !reference) {
    throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
  }

  if (value.kind === "DELIVERY") {
    const orderId = typeof value.orderId === "string" ? value.orderId : null;
    const status = typeof value.status === "string" ? (value.status as StopStatus) : null;
    if (!orderId || !status || !DELIVERY_COPY[status]) {
      throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
    }
    return { kind: "DELIVERY", customerId, companyId, reference, orderId, status };
  }

  if (value.kind === "INVOICE") {
    const invoiceId = typeof value.invoiceId === "string" ? value.invoiceId : null;
    const amountCents = typeof value.amountCents === "number" && Number.isInteger(value.amountCents) ? value.amountCents : null;
    if (!invoiceId || amountCents === null) throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
    return { kind: "INVOICE", customerId, companyId, reference, invoiceId, amountCents };
  }

  throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ?? null;
}

/**
 * `replayWindow` : fenêtre de déduplication de la tâche (première tentative réellement émise sous
 * `eventKey`). Au-delà de 23 h, l'e-mail n'est plus jamais renvoyé automatiquement (l'in-app reste).
 */
export async function deliverClientNotificationJob(
  rawPayload: Prisma.JsonValue,
  eventKey: string,
  replayWindow: ReplayWindowStart = null,
  // Rendu figé à la première tentative émise (e-mail du client modifié entre deux essais).
  freezeContent?: EmailContentFreezer
) {
  const payload = parseNotificationPayload(rawPayload);
  const settings = await getClientSettings(payload.customerId);
  const enabled = payload.kind === "INVOICE" ? settings.invoiceAlerts : settings.deliveryAlerts;
  if (!enabled) return;

  const user = await prisma.user.findFirst({
    where: { id: payload.customerId, companyId: payload.companyId },
    select: { email: true },
  });
  if (!user) return;
  const base = appUrl();

  if (payload.kind === "DELIVERY") {
    const order = await prisma.order.findFirst({
      where: { id: payload.orderId, ...merchantOwner(payload.customerId, payload.companyId) },
      select: { id: true },
    });
    if (!order) return;
    const copy = DELIVERY_COPY[payload.status]!;
    const body = copy.body(payload.reference);
    const emailText = base ? `${body}\nMes commandes : ${base}/portal` : body;
    await insertNotification(eventKey, {
      userId: payload.customerId,
      companyId: payload.companyId,
      type: "DELIVERY",
      title: copy.title,
      body,
      href: "/portal",
      email:
        settings.emailNotifications && user.email
          ? { to: user.email, subject: copy.title, text: emailText }
          : undefined,
    }, replayWindow, freezeContent);
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: payload.invoiceId, ...merchantOwner(payload.customerId, payload.companyId) },
    select: { id: true },
  });
  if (!invoice) return;
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(payload.amountCents / 100);
  const body = `La facture ${payload.reference} (${amount}) est disponible.`;
  const emailText = base ? `${body}\nMes factures : ${base}/portal/invoices` : body;
  await insertNotification(eventKey, {
    userId: payload.customerId,
    companyId: payload.companyId,
    type: "INVOICE",
    title: "Nouvelle facture",
    body,
    href: "/portal/invoices",
    email:
      settings.emailNotifications && user.email
        ? { to: user.email, subject: `Facture ${payload.reference}`, text: emailText }
        : undefined,
  }, replayWindow, freezeContent);
}

export async function notifyDeliveryStatusChange(input: {
  customerId: string | null;
  companyId: string;
  status: StopStatus;
  reference: string;
  orderId: string;
  eventId: string;
}) {
  const job = await queueDeliveryStatusNotification(prisma, input);
  if (job) kickOperationJob(job.id);
}

export async function notifyInvoiceIssued(input: {
  customerId: string | null;
  companyId: string;
  reference: string;
  invoiceId: string;
  amountCents: number;
}) {
  const job = await queueInvoiceIssuedNotification(prisma, input);
  if (job) kickOperationJob(job.id);
}

export async function listClientNotifications(userId: string) {
  const rows = await prisma.clientNotification.findMany({
    where: { userId, type: { not: "ORDER_MESSAGE" } },
    orderBy: { createdAt: "desc" },
    take: CLIENT_NOTIFICATIONS_TAKE,
  });

  return rows.map(
    (row): ClientNotificationItem => ({
      id: row.id,
      type: (KNOWN_TYPES as readonly string[]).includes(row.type) ? (row.type as ClientNotificationType) : "DELIVERY",
      title: row.title,
      body: row.body,
      href: row.href,
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })
  );
}

export async function markClientNotificationsRead(userId: string, ids?: string[]) {
  await prisma.clientNotification.updateMany({
    where: {
      userId,
      type: { not: "ORDER_MESSAGE" },
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}
