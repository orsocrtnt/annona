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
  | InvoiceNotificationPayload;

const DELIVERY_COPY: Partial<
  Record<DeliveryStatus, { title: string; body: (ref: string) => string }>
> = {
  ASSIGNED: {
    title: "Chauffeur assigné",
    body: (ref) => `Un chauffeur a pris en charge ${ref}.`,
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

async function sendClientEmail(
  to: string,
  subject: string,
  text: string,
  idempotencyKey: string
) {
  await sendTransactionalEmail({
    to,
    subject,
    text,
    idempotencyKey,
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
  }
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
      eventKey
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

  if (value.kind === "INVOICE") {
    const invoiceId = typeof value.invoiceId === "string" ? value.invoiceId : null;
    const amount = typeof value.amount === "number" ? value.amount : null;
    if (!invoiceId || amount === null) throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
    return { kind: "INVOICE", customerId, companyId, reference, invoiceId, amount };
  }

  throw new Error("CLIENT_NOTIFICATION_PAYLOAD_INVALID");
}

export async function deliverClientNotificationJob(
  rawPayload: Prisma.JsonValue,
  eventKey: string
) {
  const payload = parseNotificationPayload(rawPayload);
  const settings = await getClientSettings(payload.customerId);
  const enabled = payload.kind === "DELIVERY"
    ? settings.deliveryAlerts
    : settings.invoiceAlerts;
  if (!enabled) return;

  const user = await prisma.user.findFirst({
    where: { id: payload.customerId, companyId: payload.companyId },
    select: { email: true },
  });
  if (!user) return;

  if (payload.kind === "DELIVERY") {
    const delivery = await prisma.delivery.findFirst({
      where: {
        id: payload.deliveryId,
        customerId: payload.customerId,
        companyId: payload.companyId,
      },
      select: { id: true, company: { select: { settings: true } } },
    });
    if (!delivery) return;
    const copy = DELIVERY_COPY[payload.status]!;
    const body = copy.body(payload.reference);
    // Livrée ou en échec : la preuve est envoyée au donneur d'ordre, sauf coupure par l'entreprise.
    const isProofStatus = payload.status === "DELIVERED" || payload.status === "FAILED";
    const proofRules = parseProofRules(
      (delivery.company?.settings as Record<string, unknown> | null | undefined)?.proofRules
    );
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
    // `emailToClient=false` retire seulement le lien de preuve : le client reçoit toujours l'e-mail de statut.
    const emailBody =
      isProofStatus && proofRules.emailToClient && appUrl
        ? `${body}\nPreuve de livraison (signature, photo, PDF) : ${appUrl}/portal/deliveries/${payload.deliveryId}`
        : body;
    await insertNotification(eventKey, {
      userId: payload.customerId,
      type: "DELIVERY",
      title: copy.title,
      body,
      href: `/portal/deliveries/${payload.deliveryId}`,
      email:
        settings.emailNotifications && user.email
          ? { to: user.email, subject: copy.title, text: emailBody }
          : undefined,
    });
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
  });
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
