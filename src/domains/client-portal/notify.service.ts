import { createHash } from "node:crypto";
import type { DeliveryStatus, Prisma } from "@prisma/client";
import { CLIENT_NOTIFICATIONS_TAKE } from "@/lib/query/list-limits";
import {
  enqueueOperationJob,
  kickOperationJob,
} from "@/domains/operations/operation-job.service";
import {
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
  type ReplayWindowStart,
} from "@/lib/email/transactional-email";
import { prisma } from "@/services/prisma/client";
import { parseProofRules } from "@/domains/delivery/pod-evidence";
import { getClientSettings } from "./settings.service";

export type ClientNotificationType = "DELIVERY" | "INVOICE" | "SUPPORT";

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

type DeliveryNotificationPayload = {
  kind: "DELIVERY";
  customerId: string;
  companyId: string;
  status: DeliveryStatus;
  reference: string;
  deliveryId: string;
};

/** DEMO-3 : le livreur a accepté la mission (bouton « Prendre en charge »). */
type DeliveryAcceptedNotificationPayload = {
  kind: "DELIVERY_ACCEPTED";
  customerId: string;
  companyId: string;
  reference: string;
  deliveryId: string;
  acceptedAt: string;
};

type InvoiceNotificationPayload = {
  kind: "INVOICE";
  customerId: string;
  companyId: string;
  reference: string;
  invoiceId: string;
  amount: number;
};

type ClientNotificationJobPayload =
  | DeliveryNotificationPayload
  | DeliveryAcceptedNotificationPayload
  | InvoiceNotificationPayload;

const ACCEPTED_COPY = {
  title: "Prise en charge",
  body: (ref: string) => `Votre livreur a pris en charge ${ref}.`,
};

const DELIVERY_COPY: Partial<
  Record<DeliveryStatus, { title: string; body: (ref: string) => string }>
> = {
  ASSIGNED: {
    title: "Chauffeur assigné",
    body: (ref) => `Un chauffeur a été assigné à ${ref}.`,
  },
  PURCHASING: {
    title: "Courses en cours",
    body: (ref) => `Les courses de ${ref} ont commencé.`,
  },
  IN_DELIVERY: {
    title: "En cours de livraison",
    body: (ref) => `${ref} est en route.`,
  },
  DELIVERED: {
    title: "Livraison effectuée",
    body: (ref) => `${ref} a été livrée.`,
  },
  CANCELLED: {
    title: "Livraison annulée",
    body: (ref) => `${ref} a été annulée.`,
  },
  FAILED: {
    title: "Livraison non effectuée",
    body: (ref) => `${ref} n’a pas pu être livrée.`,
  },
};

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
  replayWindowStart: ReplayWindowStart
) {
  await sendTransactionalEmail({
    to,
    subject,
    text,
    idempotencyKey,
    replayWindowStart,
  });
}

async function insertNotification(
  eventKey: string,
  input: {
    userId: string;
    type: ClientNotificationType;
    title: string;
    body: string;
    href: string | null;
    email?: { to: string; subject: string; text: string };
  },
  replayWindowStart: ReplayWindowStart
) {
  await prisma.clientNotification.upsert({
    where: { id: stableNotificationId(eventKey) },
    update: {},
    create: {
      id: stableNotificationId(eventKey),
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    },
  });

  const extra = await prisma.clientNotification.findMany({
    where: { userId: input.userId, type: { not: "ORDER_MESSAGE" } },
    orderBy: { createdAt: "desc" },
    skip: CLIENT_NOTIFICATIONS_TAKE,
    select: { id: true },
  });
  if (extra.length > 0) {
    await prisma.clientNotification.deleteMany({
      where: { id: { in: extra.map((row) => row.id) } },
    });
  }

  if (input.email) {
    await sendClientEmail(
      input.email.to,
      input.email.subject,
      input.email.text,
      eventKey,
      replayWindowStart
    );
  }
}

export async function queueDeliveryStatusNotification(
  db: NotificationDatabase,
  input: {
    customerId: string | null;
    companyId: string;
    status: DeliveryStatus;
    reference: string;
    deliveryId: string;
    eventId: string;
  }
) {
  if (!input.customerId || !DELIVERY_COPY[input.status]) return null;
  return enqueueOperationJob(db, {
    jobKey: `client-notification:delivery:${input.deliveryId}:${input.eventId}`,
    type: "CLIENT_NOTIFICATION",
    companyId: input.companyId,
    payload: {
      kind: "DELIVERY",
      customerId: input.customerId,
      companyId: input.companyId,
      status: input.status,
      reference: input.reference,
      deliveryId: input.deliveryId,
    },
  });
}

export async function queueDeliveryAcceptedNotification(
  db: NotificationDatabase,
  input: {
    customerId: string | null;
    companyId: string;
    reference: string;
    deliveryId: string;
    acceptedAt: Date;
  }
) {
  if (!input.customerId) return null;
  const acceptedAt = input.acceptedAt.toISOString();
  return enqueueOperationJob(db, {
    // Une acceptation = une date : un rejeu garde la tâche, une nouvelle acceptation en crée une.
    jobKey: `client-notification:delivery:${input.deliveryId}:accepted:${acceptedAt}`,
    type: "CLIENT_NOTIFICATION",
    companyId: input.companyId,
    payload: {
      kind: "DELIVERY_ACCEPTED",
      customerId: input.customerId,
      companyId: input.companyId,
      reference: input.reference,
      deliveryId: input.deliveryId,
      acceptedAt,
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
    amount: number;
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
      amount: input.amount,
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
    const deliveryId = typeof value.deliveryId === "string" ? value.deliveryId : null;
    const status = typeof value.status === "string" ? value.status as DeliveryStatus : null;
    if (!deliveryId || !status || !DELIVERY_COPY[status]) {
      throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
    }
    return { kind: "DELIVERY", customerId, companyId, reference, deliveryId, status };
  }

  if (value.kind === "DELIVERY_ACCEPTED") {
    const deliveryId = typeof value.deliveryId === "string" ? value.deliveryId : null;
    const acceptedAt = typeof value.acceptedAt === "string" ? value.acceptedAt : null;
    if (!deliveryId || !acceptedAt || !Number.isFinite(Date.parse(acceptedAt))) {
      throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
    }
    return { kind: "DELIVERY_ACCEPTED", customerId, companyId, reference, deliveryId, acceptedAt };
  }

  if (value.kind === "INVOICE") {
    const invoiceId = typeof value.invoiceId === "string" ? value.invoiceId : null;
    const amount = typeof value.amount === "number" ? value.amount : null;
    if (!invoiceId || amount === null) throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
    return { kind: "INVOICE", customerId, companyId, reference, invoiceId, amount };
  }

  throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
}

type DeliveryForMessage = {
  missionAcceptedAt: Date | null;
  company: { settings: Prisma.JsonValue } | null;
};
type DeliveryMessage = { title: string; body: string; emailText: string };

function composeDeliveryStatusMessage(
  payload: DeliveryNotificationPayload,
  delivery: DeliveryForMessage
): DeliveryMessage {
  const copy = DELIVERY_COPY[payload.status]!;
  const body = copy.body(payload.reference);
  // Livrée ou en échec : la preuve est envoyée au donneur d'ordre, sauf coupure par l'entreprise.
  const isProofStatus = payload.status === "DELIVERED" || payload.status === "FAILED";
  const proofRules = parseProofRules(
    (delivery.company?.settings as Record<string, unknown> | null | undefined)?.proofRules
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  // `emailToClient=false` retire seulement le lien de preuve : le client reçoit toujours l'e-mail de statut.
  const emailText =
    isProofStatus && proofRules.emailToClient && appUrl
      ? `${body}\nPreuve de livraison (signature, photo, PDF) : ${appUrl}/portal/deliveries/${payload.deliveryId}`
      : body;
  return { title: copy.title, body, emailText };
}

function composeDeliveryAcceptedMessage(
  payload: DeliveryAcceptedNotificationPayload,
  delivery: DeliveryForMessage
): DeliveryMessage | null {
  // Refus ou nouvelle acceptation depuis la mise en file : cette prise en charge n'est plus vraie.
  if (delivery.missionAcceptedAt?.getTime() !== Date.parse(payload.acceptedAt)) return null;
  const body = ACCEPTED_COPY.body(payload.reference);
  return { title: ACCEPTED_COPY.title, body, emailText: body };
}

/**
 * `replayWindow` : fenêtre de déduplication de la tâche (première tentative réellement émise sous
 * `eventKey`). Au-delà de 23 h, l'e-mail n'est plus jamais renvoyé automatiquement (l'in-app reste).
 */
export async function deliverClientNotificationJob(
  rawPayload: Prisma.JsonValue,
  eventKey: string,
  replayWindow: ReplayWindowStart = null
) {
  const payload = parseNotificationPayload(rawPayload);
  const settings = await getClientSettings(payload.customerId);
  const enabled = payload.kind === "INVOICE"
    ? settings.invoiceAlerts
    : settings.deliveryAlerts;
  if (!enabled) return;

  const user = await prisma.user.findFirst({
    where: { id: payload.customerId, companyId: payload.companyId },
    select: { email: true },
  });
  if (!user) return;

  if (payload.kind === "DELIVERY" || payload.kind === "DELIVERY_ACCEPTED") {
    const delivery = await prisma.delivery.findFirst({
      where: {
        id: payload.deliveryId,
        customerId: payload.customerId,
        companyId: payload.companyId,
      },
      select: { id: true, missionAcceptedAt: true, company: { select: { settings: true } } },
    });
    if (!delivery) return;
    const message = payload.kind === "DELIVERY"
      ? composeDeliveryStatusMessage(payload, delivery)
      : composeDeliveryAcceptedMessage(payload, delivery);
    if (!message) return;
    await insertNotification(eventKey, {
      userId: payload.customerId,
      type: "DELIVERY",
      title: message.title,
      body: message.body,
      href: `/portal/deliveries/${payload.deliveryId}`,
      email:
        settings.emailNotifications && user.email
          ? { to: user.email, subject: message.title, text: message.emailText }
          : undefined,
    }, replayWindow);
    return;
  }

  const invoice = await prisma.invoice.findFirst({
    where: {
      id: payload.invoiceId,
      customerId: payload.customerId,
      companyId: payload.companyId,
    },
    select: { id: true },
  });
  if (!invoice) return;
  const amount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(payload.amount);
  const body = `La facture ${payload.reference} (${amount}) est disponible.`;
  await insertNotification(eventKey, {
    userId: payload.customerId,
    type: "INVOICE",
    title: "Nouvelle facture",
    body,
    href: `/portal/invoices/${payload.invoiceId}`,
    email:
      settings.emailNotifications && user.email
        ? { to: user.email, subject: `Facture ${payload.reference}`, text: body }
        : undefined,
  }, replayWindow);
}

export async function notifyDeliveryStatusChange(input: {
  customerId: string | null;
  companyId: string;
  status: DeliveryStatus;
  reference: string;
  deliveryId: string;
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
  amount: number;
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
      type: row.type === "INVOICE" ? "INVOICE" : row.type === "SUPPORT" ? "SUPPORT" : "DELIVERY",
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
