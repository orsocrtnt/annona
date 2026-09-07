import type { DeliveryStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { CLIENT_NOTIFICATIONS_TAKE } from "@/lib/query/list-limits";
import { getClientSettings } from "./settings.service";

export type ClientNotificationType = "DELIVERY" | "INVOICE";

export interface ClientNotificationItem {
  id: string;
  type: ClientNotificationType;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && (process.env.MAIL_FROM || process.env.EMAIL_FROM));
}

export function getEmailDeliveryConfigured() {
  return isEmailConfigured();
}

async function sendClientEmail(to: string, subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || process.env.EMAIL_FROM;
  if (!apiKey || !from) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[notify] email failed", res.status, detail);
  }
}

async function insertNotification(input: {
  userId: string;
  type: ClientNotificationType;
  title: string;
  body: string;
  href: string | null;
  email?: { to: string; subject: string; text: string };
}) {
  await prisma.clientNotification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href,
    },
  });

  const extra = await prisma.clientNotification.findMany({
    where: { userId: input.userId },
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
    void sendClientEmail(input.email.to, input.email.subject, input.email.text).catch((error) => {
      console.error("[notify] email", error);
    });
  }
}

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

export function notifyDeliveryStatusChange(input: {
  customerId: string | null;
  status: DeliveryStatus;
  reference: string;
  deliveryId: string;
}) {
  if (!input.customerId) return;
  const copy = DELIVERY_COPY[input.status];
  if (!copy) return;

  void (async () => {
    const settings = await getClientSettings(input.customerId!);
    if (!settings.deliveryAlerts) return;

    const user = await prisma.user.findUnique({
      where: { id: input.customerId! },
      select: { email: true },
    });
    if (!user) return;

    const body = copy.body(input.reference);
    await insertNotification({
      userId: input.customerId!,
      type: "DELIVERY",
      title: copy.title,
      body,
      href: `/portal/deliveries/${input.deliveryId}`,
      email:
        settings.emailNotifications && user.email
          ? { to: user.email, subject: copy.title, text: body }
          : undefined,
    });
  })().catch((error) => console.error("[notify] delivery", error));
}

export function notifyInvoiceIssued(input: {
  customerId: string | null;
  reference: string;
  invoiceId: string;
  amount: number;
}) {
  if (!input.customerId) return;

  void (async () => {
    const settings = await getClientSettings(input.customerId!);
    if (!settings.invoiceAlerts) return;

    const user = await prisma.user.findUnique({
      where: { id: input.customerId! },
      select: { email: true },
    });
    if (!user) return;

    const amount = new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(input.amount);
    const body = `La facture ${input.reference} (${amount}) est disponible.`;

    await insertNotification({
      userId: input.customerId!,
      type: "INVOICE",
      title: "Nouvelle facture",
      body,
      href: `/portal/invoices/${input.invoiceId}`,
      email:
        settings.emailNotifications && user.email
          ? { to: user.email, subject: `Facture ${input.reference}`, text: body }
          : undefined,
    });
  })().catch((error) => console.error("[notify] invoice", error));
}

export async function listClientNotifications(userId: string) {
  const rows = await prisma.clientNotification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: CLIENT_NOTIFICATIONS_TAKE,
  });

  return rows.map(
    (row): ClientNotificationItem => ({
      id: row.id,
      type: row.type === "INVOICE" ? "INVOICE" : "DELIVERY",
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
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}
