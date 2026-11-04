import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/services/prisma/client";
import { normalizePhone } from "./order-intake.draft";
import { queueInboundMessage, type InboundIngestResult, type InboundMessageData } from "./inbound-email.service";

/**
 * WHATSAPP-1, option A : TutelLiv a un numéro WhatsApp (API officielle de Meta). Un membre de l'équipe
 * y transfère le message d'un client ; l'entreprise est reconnue par le numéro de ce membre, inscrit
 * dans son profil. Le message rejoint la file des e-mails reçus : même tri, même brouillon, même validation.
 *
 * Option B (plus tard) : le numéro WhatsApp Business de chaque entreprise relié par l'inscription
 * intégrée de Meta. Le même webhook recevra alors d'autres `phone_number_id` : seule
 * `resolveWhatsAppTarget` change. Voir docs/operations/order-intake/WHATSAPP.md.
 */

type Env = Record<string, string | undefined>;

/** Rôles autorisés à transférer : ceux qui peuvent créer une commande depuis un message. */
export const WHATSAPP_SENDER_ROLES = ["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"] as const;

export function whatsappConfig(env: Env = process.env) {
  return {
    appSecret: env.WHATSAPP_APP_SECRET?.trim() ?? "",
    verifyToken: env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "",
    displayNumber: env.WHATSAPP_DISPLAY_NUMBER?.trim() || null,
  };
}

export function isWhatsAppConfigured(env: Env = process.env) {
  const config = whatsappConfig(env);
  return Boolean(config.appSecret && config.verifyToken && config.phoneNumberId && config.displayNumber);
}

const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** En-tête `X-Hub-Signature-256` : `sha256=` puis le HMAC hexadécimal du corps brut avec le secret de l'application. */
export function verifyWhatsAppSignature(body: string, header: string | null, secret: string): boolean {
  if (!secret || !header?.startsWith("sha256=")) return false;
  const hex = header.slice("sha256=".length);
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  return safeEqual(Buffer.from(hex, "hex"), createHmac("sha256", secret).update(body, "utf8").digest());
}

/** Abonnement du webhook chez Meta : renvoie le défi seulement si le jeton correspond. */
export function whatsappSubscribeChallenge(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken || params.get("hub.mode") !== "subscribe") return null;
  const token = params.get("hub.verify_token") ?? "";
  if (!safeEqual(Buffer.from(token), Buffer.from(verifyToken))) return null;
  const challenge = params.get("hub.challenge") ?? "";
  // Le défi est renvoyé tel quel : on n'accepte qu'un jeton court et inerte.
  return /^[\w.-]{1,200}$/.test(challenge) ? challenge : null;
}

/** Numéro WhatsApp (chiffres, indicatif sans « + ») sous la forme comparée aux profils (0612345678). */
export function whatsappPhone(from: string): string | null {
  const digits = from.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? normalizePhone(`+${digits}`) : null;
}

export type WhatsAppIncoming = {
  phoneNumberId: string;
  messageId: string;
  from: string;
  type: string;
  text: string;
  hasMedia: boolean;
  forwarded: boolean;
};

const MEDIA_TYPES = new Set(["image", "audio", "video", "document", "sticker", "location", "contacts"]);
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown) => (typeof value === "string" ? value : "");

/**
 * Messages d'un événement Meta (`whatsapp_business_account`). Les accusés de lecture, réactions et
 * messages système sont écartés. Une photo ou un document garde sa légende comme texte.
 */
export function whatsappMessages(event: unknown): WhatsAppIncoming[] {
  const payload = record(event);
  if (payload?.object !== "whatsapp_business_account") return [];
  const out: WhatsAppIncoming[] = [];
  for (const entry of list(payload.entry)) {
    for (const change of list(record(entry)?.changes)) {
      const c = record(change);
      if (c?.field !== "messages") continue;
      const value = record(c.value);
      const phoneNumberId = str(record(value?.metadata)?.phone_number_id);
      for (const raw of list(value?.messages)) {
        const message = record(raw);
        const messageId = str(message?.id);
        const from = str(message?.from);
        const type = str(message?.type);
        if (!message || !phoneNumberId || !messageId || messageId.length > 128 || !from) continue;
        const media = MEDIA_TYPES.has(type);
        if (type !== "text" && !media) continue;
        const text = type === "text" ? str(record(message.text)?.body) : str(record(message[type])?.caption);
        out.push({
          phoneNumberId,
          messageId,
          from,
          type,
          text: text.trim(),
          hasMedia: media,
          forwarded: record(message.context)?.forwarded === true || record(message.context)?.frequently_forwarded === true,
        });
      }
    }
  }
  return out;
}

type WhatsAppDb = Pick<typeof prisma, "$queryRaw" | "companyIntakeChannel">;

/**
 * Membre actif de l'équipe dont le profil porte ce numéro (même normalisation que normalizePhone).
 * Un numéro inscrit dans deux entreprises est ambigu : rien n'est rangé.
 */
export async function findWhatsAppSender(phone: string, db: WhatsAppDb = prisma): Promise<{ companyId: string; userId: string } | null> {
  const rows = await db.$queryRaw<Array<{ id: string; company_id: string }>>`
    SELECT u."id", u."company_id"
    FROM "users" u
    JOIN "roles" r ON r."id" = u."role_id"
    WHERE u."company_id" IS NOT NULL
      AND r."system_role" IN ('COMPANY_ADMIN', 'MINI_ADMIN', 'DISPATCHER')
      AND u."status" = 'ACTIVE'
      AND u."phone" IS NOT NULL
      AND regexp_replace(regexp_replace(regexp_replace(u."phone", '[^0-9+]', '', 'g'), '^([+]33|0033)', '0'), '[^0-9]', '', 'g') = ${phone}
    ORDER BY u."id"
    LIMIT 5`;
  const companies = new Set(rows.map((row) => row.company_id));
  if (companies.size !== 1) return null;
  return { companyId: rows[0]!.company_id, userId: rows[0]!.id };
}

/**
 * Entreprise destinataire d'un message. Option A : le numéro de TutelLiv, l'entreprise du membre qui
 * transfère, si elle a activé WhatsApp. Option B (à venir) : un autre `phone_number_id`, celui d'une
 * entreprise reliée ; tant qu'aucune n'est reliée, il est ignoré.
 */
export async function resolveWhatsAppTarget(message: WhatsAppIncoming, env: Env = process.env, db: WhatsAppDb = prisma) {
  const config = whatsappConfig(env);
  if (!config.phoneNumberId || message.phoneNumberId !== config.phoneNumberId) return null;
  const phone = whatsappPhone(message.from);
  if (!phone) return null;
  const sender = await findWhatsAppSender(phone, db);
  if (!sender) return null;
  const channel = await db.companyIntakeChannel.findUnique({ where: { companyId: sender.companyId }, select: { whatsappEnabled: true } });
  return channel?.whatsappEnabled ? { companyId: sender.companyId } : null;
}

export type WhatsAppIngestSummary = Record<InboundIngestResult, number>;

/** Range chaque message reconnu dans la file des messages reçus ; une panne de base remonte (Meta réessaie). */
export async function ingestWhatsAppWebhook(
  event: unknown,
  deps: {
    env?: Env;
    now?: Date;
    db?: WhatsAppDb;
    queue?: (companyId: string, message: InboundMessageData, now: Date) => Promise<InboundIngestResult>;
  } = {}
): Promise<WhatsAppIngestSummary> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  const queue = deps.queue ?? queueInboundMessage;
  const summary: WhatsAppIngestSummary = { stored: 0, duplicate: 0, ignored: 0, over_limit: 0 };
  for (const message of whatsappMessages(event)) {
    const target = await resolveWhatsAppTarget(message, env, deps.db ?? prisma);
    if (!target) {
      summary.ignored += 1;
      continue;
    }
    const result = await queue(target.companyId, {
      providerEmailId: `whatsapp:${message.messageId}`,
      channel: "WHATSAPP",
      fromAddress: `+${message.from.replace(/\D/g, "")}`,
      subject: "",
      bodyText: message.text,
      attachmentCount: message.hasMedia ? 1 : 0,
    }, now);
    summary[result] += 1;
  }
  return summary;
}

/** Réglages : membres de l'équipe qui peuvent transférer, et si leur profil porte un numéro lisible. */
export async function listWhatsAppTeam(companyId: string, db: Pick<typeof prisma, "user"> = prisma) {
  const users = await db.user.findMany({
    where: { companyId, status: "ACTIVE", role: { systemRole: { in: [...WHATSAPP_SENDER_ROLES] } } },
    select: { firstName: true, lastName: true, email: true, phone: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
    take: 50,
  });
  return users.map((user) => ({
    name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email,
    phone: normalizePhone(user.phone) ? user.phone : null,
  }));
}
