import { z } from "zod";
import { sendTransactionalEmail } from "@/lib/email/transactional-email";
import { abuseFingerprint, getAbuseHmacSecret } from "@/lib/security/abuse-hmac";
import { prisma } from "@/services/prisma/client";
import { incrementFunnelCounter, normalizeCampaignCode } from "@/domains/growth/waitlist-funnel.service";

/** GROWTH-1, décision C10 : messages Contact stockés et lus dans le back-office plateforme. */
export const CONTACT_WINDOW_MS = 60 * 60 * 1000;
/** Au plus 3 messages par source et 50 au total par heure glissante. */
export const CONTACT_SOURCE_LIMIT = 3;
export const CONTACT_GLOBAL_LIMIT = 50;
export const CONTACT_PAGE_SIZES = [25, 50, 100] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

export const contactMessageSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  company: optionalText(160),
  phone: z.string().trim().max(40).regex(/^[0-9+().\s-]*$/).optional().transform((value) => value || null),
  message: z.string().trim().min(10).max(4000),
  /** Pot de miel : invisible pour un humain, doit rester vide. */
  website: z.string().max(200).optional(),
}).strict();

/**
 * Liste d'attente de la page /tarifs provisoire (5 novembre 2026) : mêmes table, débit, alerte et
 * conservation que Contact. Tous les champs sont obligatoires, sauf la campagne (`?c=` de l'adresse,
 * ADMIN-ESPACE lot 2), ramenée à « direct » si elle manque ou ne respecte pas le format.
 */
export const waitlistEntrySchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  company: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(40).regex(/^[0-9+().\s-]+$/).refine((value) => value.replace(/\D/g, "").length >= 8),
  campaign: z.string().max(100).optional(),
  website: z.string().max(200).optional(),
}).strict();

/** Texte enregistré comme message : il distingue l'inscription dans le back-office et l'alerte. */
export const WAITLIST_MESSAGE = "Liste d'attente : souhaite faire partie des premières entreprises à utiliser Annona.";

/**
 * Durée publiée sur la page Confidentialité : un message part trois ans après sa réception,
 * le formulaire ne connaissant pas d'échange ultérieur.
 */
export const CONTACT_RETENTION_YEARS = 3;

export async function purgeExpiredContactMessages(now = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - CONTACT_RETENTION_YEARS);
  const { count } = await prisma.contactMessage.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

export type ContactAlertMessage = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
};

export type ContactSubmitResult =
  /** `stored` manque quand rien n'a été écrit (pot de miel) : aucune alerte dans ce cas. */
  | { status: "accepted"; stored?: ContactAlertMessage }
  | { status: "invalid"; field: string }
  | { status: "rate_limited" };

type ContactDatabase = Pick<typeof prisma, "contactMessage">;
type ContactWriteDatabase = Pick<typeof prisma, "contactMessage" | "$transaction">;

/** L'adresse IP n'est jamais stockée : seule cette empreinte HMAC sert au débit. */
export function contactSourceHash(source: string, secret: string) {
  if (!secret) throw new Error("CONTACT_SOURCE_SECRET_MISSING");
  return abuseFingerprint("contact-source", source, secret);
}

/**
 * Vercel écrase x-forwarded-for avec la seule adresse du client. Derrière un proxy qui
 * ajoute au lieu d'écraser, les adresses de gauche viennent du client : seule la dernière,
 * posée par le proxy le plus proche, sert de source.
 */
export function contactSourceFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",").map((entry) => entry.trim()).filter(Boolean).at(-1);
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

export async function submitContactMessage(
  raw: unknown,
  source: string,
  options: { now?: Date; secret?: string; db?: ContactWriteDatabase } = {}
): Promise<ContactSubmitResult> {
  const parsed = contactMessageSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const { website, ...data } = parsed.data;
  // Un robot reçoit la même réponse qu'un humain, mais rien n'est écrit.
  if (website) return { status: "accepted" };
  return storeContactMessage(data, source, options);
}

/** Inscription à la liste d'attente, rangée avec les messages Contact (même débit et même alerte). */
export async function submitWaitlistEntry(
  raw: unknown,
  source: string,
  options: { now?: Date; secret?: string; db?: ContactWriteDatabase } = {}
): Promise<ContactSubmitResult> {
  const parsed = waitlistEntrySchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid", field: String(parsed.error.issues[0]?.path[0] ?? "") };
  const { website, firstName, lastName, company, email, phone, campaign } = parsed.data;
  if (website) return { status: "accepted" };
  const campaignCode = normalizeCampaignCode(campaign);
  return storeContactMessage(
    { name: `${firstName} ${lastName}`, email, company, phone, message: WAITLIST_MESSAGE },
    source,
    options,
    {
      campaignCode,
      // Inscription réussie comptée par le serveur, dans la même transaction que l'enregistrement.
      afterCreate: (tx, now) => incrementFunnelCounter("SIGNUP", campaignCode, now, tx),
    }
  );
}

type ContactTransaction = Parameters<Parameters<ContactWriteDatabase["$transaction"]>[0]>[0];

async function storeContactMessage(
  data: Omit<ContactAlertMessage, "id">,
  source: string,
  options: { now?: Date; secret?: string; db?: ContactWriteDatabase },
  waitlist?: { campaignCode: string; afterCreate: (tx: ContactTransaction, now: Date) => Promise<void> }
): Promise<ContactSubmitResult> {
  const db = options.db ?? prisma;
  const now = options.now ?? new Date();
  // Secret dédié CONTACT_HMAC_SECRET, repli sur la clé service (voir abuse-hmac.ts).
  const sourceHash = contactSourceHash(source, options.secret ?? getAbuseHmacSecret());
  const since = new Date(now.getTime() - CONTACT_WINDOW_MS);
  // Verrou consultatif de transaction : sans lui, des envois simultanés lisaient le même
  // compte et dépassaient les limites (PERF-02 : 56 acceptés pour 50).
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext('annona:contact-rate-limit'))`;
    const [fromSource, total] = await Promise.all([
      tx.contactMessage.count({ where: { sourceHash, createdAt: { gte: since } } }),
      tx.contactMessage.count({ where: { createdAt: { gte: since } } }),
    ]);
    if (fromSource >= CONTACT_SOURCE_LIMIT || total >= CONTACT_GLOBAL_LIMIT) return { status: "rate_limited" } as const;

    const stored = await tx.contactMessage.create({
      data: { ...data, sourceHash, ...(waitlist ? { campaignCode: waitlist.campaignCode } : {}) },
    });
    if (waitlist) await waitlist.afterCreate(tx, now);
    return {
      status: "accepted",
      stored: {
        id: stored.id,
        name: stored.name,
        email: stored.email,
        company: stored.company,
        phone: stored.phone,
        message: stored.message,
      },
    } as const;
  });
}

/**
 * Prévient l'équipe d'un nouveau message Contact. Le message est déjà enregistré et reste lisible
 * dans le back-office : une alerte ratée ne doit jamais faire échouer l'envoi du visiteur.
 */
export async function sendContactAlert(
  message: ContactAlertMessage,
  options: { env?: Record<string, string | undefined>; send?: typeof sendTransactionalEmail } = {}
): Promise<"sent" | "skipped" | "failed"> {
  const env = options.env ?? process.env;
  // Repli sur la boîte de recette : c'est déjà celle de l'équipe tant que l'envoi réel n'est pas ouvert.
  const to = env.CONTACT_ALERT_RECIPIENT?.trim() || env.EMAIL_TEST_RECIPIENT?.trim();
  if (!to) return "skipped";
  const appUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  try {
    const result = await (options.send ?? sendTransactionalEmail)({
      to,
      subject: message.message === WAITLIST_MESSAGE
        ? `Liste d'attente : ${message.company ?? message.name}`
        : `Nouveau message Contact : ${message.company ?? message.name}`,
      text: [
        `Nom : ${message.name}`,
        `E-mail : ${message.email}`,
        `Entreprise : ${message.company ?? "non indiquée"}`,
        `Téléphone : ${message.phone ?? "non indiqué"}`,
        "",
        message.message,
        ...(appUrl ? ["", `Lire dans le back-office : ${appUrl}${message.message === WAITLIST_MESSAGE ? "/admin/waitlist" : "/admin/contact"}`] : []),
      ].join("\n"),
      idempotencyKey: `contact-message:${message.id}`,
      // Un seul essai par message : aucune tentative antérieure n'a pu partir sous cette clé.
      replayWindowStart: null,
    });
    if (result.status === "disabled") {
      console.error("Contact alert skipped:", result.reason);
      return "skipped";
    }
    return "sent";
  } catch (error) {
    console.error("Contact alert failed:", error instanceof Error ? error.message : "unknown");
    return "failed";
  }
}

export function parseContactListParams(params: URLSearchParams) {
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "25");
  if (!Number.isInteger(page) || page < 1 || page > 10_000) return { error: "Page invalide" } as const;
  if (!CONTACT_PAGE_SIZES.includes(pageSize as (typeof CONTACT_PAGE_SIZES)[number])) {
    return { error: "Taille de page invalide" } as const;
  }
  return { query: { page, pageSize } } as const;
}

export async function listContactMessages(
  query: { page: number; pageSize: number },
  db: ContactDatabase = prisma
) {
  // ADMIN-ESPACE lot 2 : les inscriptions à la liste d'attente ont leur propre page (/admin/waitlist).
  const where = { NOT: { message: WAITLIST_MESSAGE } };
  const [total, items] = await Promise.all([
    db.contactMessage.count({ where }),
    db.contactMessage.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      // L'empreinte de source reste interne : elle n'est jamais renvoyée.
      select: { id: true, name: true, email: true, company: true, phone: true, message: true, createdAt: true },
    }),
  ]);
  return { items, total, page: query.page, pageSize: query.pageSize };
}
