/**
 * NOTIF-1 — canaux de notification du client (NOT-01 à NOT-03).
 *
 * Les déclencheurs (rappel, confirmation, livreur en approche) produisent un message neutre
 * (`NotificationMessage`) ; chaque canal décide seul s'il peut le remettre à ce destinataire.
 * Canaux livrés : dans l'application (cloche du portail, `ClientNotification`) et e-mail (file
 * existante, Resend). MOBILE-1 ajoutera les notifications natives (Capacitor : APNs / FCM) en
 * enregistrant un canal `native_push` avec `registerNotificationChannel`, sans toucher aux
 * déclencheurs ni aux tâches.
 *
 * Un canal ne lève une erreur que pour un échec à réessayer (la tâche durable est rejouée avec la
 * même clé, chaque canal est idempotent). « off » : rien à faire pour ce destinataire (préférence,
 * pas d'adresse) ; « disabled » : le service n'est pas configuré (ex. pas de clé Resend en
 * développement) : la tâche est close « ignorée » (SKIPPED) pour en garder la trace.
 */
import type { Prisma } from "@prisma/client";
import { upsertInAppNotification, type ClientNotificationType } from "@/domains/client-portal/notify.service";
import {
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
  type EmailContentFreezer,
  type ReplayWindowStart,
} from "@/lib/email/transactional-email";

export type NotificationChannelId = "in_app" | "email" | "native_push";

export interface NotificationMessage {
  type: Extract<ClientNotificationType, "ORDER" | "REMINDER" | "APPROACH">;
  title: string;
  body: string;
  /** Page du portail ouverte depuis la notification. */
  href: string;
  email: { subject: string; text: string };
  /** Nom de l'entreprise, affiché « Entreprise via Annona » devant l'adresse d'envoi. */
  senderName: string | null;
}

export interface NotificationRecipient {
  userId: string;
  companyId: string;
  email: string | null;
  /** Préférence « Copie par e-mail » du compte. */
  emailCopy: boolean;
}

export interface NotificationContext {
  /** Clé stable de l'événement (clé de la tâche durable) : idempotence de chaque canal. */
  eventKey: string;
  replayWindow: ReplayWindowStart;
  freezeContent?: EmailContentFreezer;
}

export type ChannelOutcome = "sent" | "off" | "disabled";

export interface NotificationChannel {
  id: NotificationChannelId;
  deliver(message: NotificationMessage, recipient: NotificationRecipient, context: NotificationContext): Promise<ChannelOutcome>;
}

export function inAppChannel(db?: Pick<Prisma.TransactionClient, "clientNotification">): NotificationChannel {
  return {
    id: "in_app",
    async deliver(message, recipient, context) {
      await upsertInAppNotification(
        context.eventKey,
        { userId: recipient.userId, companyId: recipient.companyId, type: message.type, title: message.title, body: message.body, href: message.href },
        db
      );
      return "sent";
    },
  };
}

export const emailChannel: NotificationChannel = {
  id: "email",
  async deliver(message, recipient, context) {
    if (!recipient.emailCopy || !recipient.email) return "off";
    if (!getTransactionalEmailConfiguration().enabled) return "disabled";
    const result = await sendTransactionalEmail({
      to: recipient.email,
      subject: message.email.subject,
      text: message.email.text,
      senderName: message.senderName,
      idempotencyKey: context.eventKey,
      replayWindowStart: context.replayWindow,
      freezeContent: context.freezeContent,
    });
    return result && typeof result === "object" && "status" in result && result.status === "disabled" ? "disabled" : "sent";
  },
};

const extraChannels: NotificationChannel[] = [];

/** MOBILE-1 : ajoute un canal (notifications natives) à tous les déclencheurs existants. */
export function registerNotificationChannel(channel: NotificationChannel) {
  if (extraChannels.some((existing) => existing.id === channel.id)) return;
  extraChannels.push(channel);
}

/** Canaux actifs, dans l'ordre : l'application d'abord (toujours), puis e-mail, puis les canaux ajoutés. */
export function notificationChannels(): NotificationChannel[] {
  return [inAppChannel(), emailChannel, ...extraChannels];
}

/** Remet le message par chaque canal ; renvoie l'issue de chacun. */
export async function dispatchNotification(
  message: NotificationMessage,
  recipient: NotificationRecipient,
  context: NotificationContext,
  channels: readonly NotificationChannel[] = notificationChannels()
): Promise<Record<string, ChannelOutcome>> {
  const outcomes: Record<string, ChannelOutcome> = {};
  for (const channel of channels) outcomes[channel.id] = await channel.deliver(message, recipient, context);
  return outcomes;
}
