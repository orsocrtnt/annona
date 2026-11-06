import { z } from "zod";
import { abuseFingerprint, getAbuseHmacSecret } from "@/lib/security/abuse-hmac";
import { toParisDateTimeInput } from "@/lib/format/paris-datetime-input";
import { prisma } from "@/services/prisma/client";

/**
 * ADMIN-ESPACE, lot 2 : entonnoir de la page /tarifs (visites → clics « Rejoindre la liste » → inscriptions).
 * Seuls des compteurs par jour (Paris), campagne et étape sont écrits : ni cookie, ni adresse IP,
 * ni identifiant de visiteur, ni heure précise. L'empreinte de source ne vit qu'en mémoire, le temps du plafond.
 */

export const FUNNEL_DIRECT = "direct";
export const FUNNEL_CAMPAIGN_PATTERN = /^[a-z0-9-]{1,40}$/;
export const FUNNEL_PERIODS = [7, 30] as const;
/** Plafond par source (empreinte HMAC en mémoire) : visites et clics confondus, par fenêtre glissante. */
export const FUNNEL_SOURCE_LIMIT = 30;
export const FUNNEL_WINDOW_MS = 60 * 60 * 1000;
/** Taille maximale du corps accepté par la route publique (octets). */
export const FUNNEL_BODY_MAX_BYTES = 256;

export type FunnelEvent = "VISIT" | "CLICK" | "SIGNUP" | "MAIL_JOIN" | "MAIL_SITE";
/** Étapes de l'entonnoir de /tarifs ; les clics des mails de campagne (lot 5) sont lus à part. */
const PAGE_FUNNEL_EVENTS = ["VISIT", "CLICK", "SIGNUP"] as const;
export type FunnelPeriod = (typeof FUNNEL_PERIODS)[number];

/** Code de campagne lu dans `?c=` : accepté tel quel s'il respecte le format, sinon « direct ». */
export function normalizeCampaignCode(raw: unknown): string {
  return typeof raw === "string" && FUNNEL_CAMPAIGN_PATTERN.test(raw) ? raw : FUNNEL_DIRECT;
}

/**
 * Corps de la route publique : visite et clic de /tarifs, et clic d'un lien de mail de campagne (envoyé par la
 * page d'arrivée après un geste réel du visiteur) ; l'inscription est comptée par le serveur.
 */
export const funnelBeaconSchema = z
  .object({
    event: z.enum(["visit", "click", "mail_join", "mail_site"]),
    campaign: z.string().max(100).optional(),
  })
  .strict();

const BOT_USER_AGENT =
  /bot|crawl|spider|slurp|archiver|scrap|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|curl|wget|python|httpclient|http-client|okhttp|axios|node-fetch|undici|go-http|java\/|libwww|phantomjs|selenium|puppeteer|playwright|monitor|uptime|pingdom/i;

/** Robots évidents : user-agent vide, trop court ou annonçant un outil automatique. */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  const value = userAgent?.trim() ?? "";
  if (value.length < 20) return true;
  return BOT_USER_AGENT.test(value);
}

/* ---------- Jours à l'heure de Paris ---------- */

export function funnelDayKey(at: Date): string {
  return toParisDateTimeInput(at).slice(0, 10);
}

function shiftDay(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/* ---------- Plafond par source, en mémoire seulement ---------- */

export type FunnelSourceLimiter = { allow: (fingerprint: string, now: number) => boolean; size: () => number };

/**
 * Compteur en mémoire de l'instance (rien en base) : au plus `limit` événements par empreinte et par fenêtre.
 * Taille bornée : au-delà de `maxKeys`, les entrées expirées puis les plus anciennes sont retirées.
 */
export function createFunnelSourceLimiter(
  options: { limit?: number; windowMs?: number; maxKeys?: number } = {}
): FunnelSourceLimiter {
  const limit = options.limit ?? FUNNEL_SOURCE_LIMIT;
  const windowMs = options.windowMs ?? FUNNEL_WINDOW_MS;
  const maxKeys = options.maxKeys ?? 5_000;
  const buckets = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(fingerprint, now) {
      const bucket = buckets.get(fingerprint);
      if (!bucket || now - bucket.startedAt >= windowMs) {
        if (buckets.size >= maxKeys) {
          for (const [key, entry] of buckets) if (now - entry.startedAt >= windowMs) buckets.delete(key);
          while (buckets.size >= maxKeys) buckets.delete(buckets.keys().next().value as string);
        }
        buckets.delete(fingerprint);
        buckets.set(fingerprint, { startedAt: now, count: 1 });
        return true;
      }
      if (bucket.count >= limit) return false;
      bucket.count += 1;
      return true;
    },
    size: () => buckets.size,
  };
}

const defaultLimiter = createFunnelSourceLimiter();

/* ---------- Écriture ---------- */

type FunnelWriteDatabase = Pick<typeof prisma, "$executeRaw">;

/**
 * Incrément atomique (une seule requête `INSERT … ON CONFLICT DO UPDATE SET count = count + 1`) :
 * deux visites simultanées ne se perdent jamais, même sur une ligne qui n'existe pas encore.
 */
export async function incrementFunnelCounter(
  event: FunnelEvent,
  campaign: string,
  now: Date,
  db: FunnelWriteDatabase = prisma
): Promise<void> {
  const day = funnelDayKey(now);
  const code = normalizeCampaignCode(campaign);
  await db.$executeRaw`INSERT INTO "waitlist_funnel_daily" ("day", "campaign_code", "event", "count")
    VALUES (${day}::date, ${code}, ${event}::"WaitlistFunnelEvent", 1)
    ON CONFLICT ("day", "campaign_code", "event")
    DO UPDATE SET "count" = "waitlist_funnel_daily"."count" + 1`;
}

export type FunnelBeaconResult = "recorded" | "ignored" | "invalid" | "limited";

const BEACON_EVENTS = { visit: "VISIT", click: "CLICK", mail_join: "MAIL_JOIN", mail_site: "MAIL_SITE" } as const;

/** Visite ou clic envoyé par le navigateur : validation stricte, robots ignorés, plafond par source. */
export async function recordFunnelBeacon(
  raw: unknown,
  request: { userAgent: string | null; source: string },
  deps: { now?: Date; secret?: string; limiter?: FunnelSourceLimiter; db?: FunnelWriteDatabase } = {}
): Promise<FunnelBeaconResult> {
  const parsed = funnelBeaconSchema.safeParse(raw);
  if (!parsed.success) return "invalid";
  if (isLikelyBot(request.userAgent)) return "ignored";
  const campaign = normalizeCampaignCode(parsed.data.campaign);
  const event = BEACON_EVENTS[parsed.data.event];
  // Un clic de mail n'a de sens qu'avec le code de sa campagne.
  if ((event === "MAIL_JOIN" || event === "MAIL_SITE") && campaign === FUNNEL_DIRECT) return "ignored";
  const now = deps.now ?? new Date();
  const fingerprint = abuseFingerprint("funnel-source", request.source, deps.secret ?? getAbuseHmacSecret());
  if (!(deps.limiter ?? defaultLimiter).allow(fingerprint, now.getTime())) return "limited";
  await incrementFunnelCounter(event, campaign, now, deps.db);
  return "recorded";
}

/* ---------- Liens des mails de campagne (ADMIN-ESPACE lot 5) ---------- */

export const MAIL_LINK_TARGETS = { rejoindre: "MAIL_JOIN", site: "MAIL_SITE" } as const;
export type MailLinkTarget = keyof typeof MAIL_LINK_TARGETS;

export function isMailLinkTarget(value: string): value is MailLinkTarget {
  return Object.prototype.hasOwnProperty.call(MAIL_LINK_TARGETS, value);
}

/**
 * Page ouverte après le clic ; `c` suit pour l'inscription, `m` dit quel lien a été suivi. Le clic n'est plus
 * compté par la redirection (les antivirus des messageries ouvrent tous les liens) mais par la page d'arrivée,
 * après un geste réel du visiteur (`MailLinkBeacon`).
 */
export function mailLinkDestination(code: string, target: MailLinkTarget): string {
  const query = `?c=${encodeURIComponent(code)}&m=${target}`;
  return target === "rejoindre" ? `/tarifs${query}` : `/${query}`;
}

/* ---------- Lecture (super-administrateur) ---------- */

export type FunnelCounts = { visits: number; clicks: number; signups: number };
export type FunnelDay = FunnelCounts & { day: string };
export type FunnelCampaign = FunnelCounts & { code: string };
export type FunnelRates = { visitToClick: number | null; clickToSignup: number | null; visitToSignup: number | null };

export type WaitlistFunnel = {
  days: FunnelPeriod;
  from: string;
  to: string;
  totals: FunnelCounts;
  rates: FunnelRates;
  series: FunnelDay[];
  campaigns: FunnelCampaign[];
};

type FunnelRow = { day: Date; campaignCode: string; event: FunnelEvent; count: number };
type FunnelReadDatabase = {
  waitlistFunnelDaily: { findMany: (args: Record<string, unknown>) => Promise<FunnelRow[]> };
};

export function parseFunnelParams(search: URLSearchParams): { query: { days: FunnelPeriod } } | { error: string } {
  for (const key of search.keys()) if (key !== "days") return { error: "Paramètre inconnu" };
  const raw = search.get("days") ?? "30";
  const days = Number(raw);
  if (!FUNNEL_PERIODS.includes(days as FunnelPeriod)) return { error: "Période invalide" };
  return { query: { days: days as FunnelPeriod } };
}

/** Taux de passage arrondi au dixième de pour cent ; `null` quand l'étape précédente est vide. */
export function funnelRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

const FIELD: Partial<Record<FunnelEvent, keyof FunnelCounts>> = { VISIT: "visits", CLICK: "clicks", SIGNUP: "signups" };

export function summarizeFunnel(rows: FunnelRow[], days: FunnelPeriod, now: Date): WaitlistFunnel {
  const today = funnelDayKey(now);
  const from = shiftDay(today, -(days - 1));
  const series: FunnelDay[] = Array.from({ length: days }, (_, index) => ({
    day: shiftDay(from, index),
    visits: 0,
    clicks: 0,
    signups: 0,
  }));
  const byDay = new Map(series.map((entry) => [entry.day, entry]));
  const byCampaign = new Map<string, FunnelCampaign>();
  const totals: FunnelCounts = { visits: 0, clicks: 0, signups: 0 };
  for (const row of rows) {
    const day = byDay.get(row.day.toISOString().slice(0, 10));
    if (!day) continue;
    const field = FIELD[row.event];
    if (!field) continue;
    day[field] += row.count;
    totals[field] += row.count;
    const campaign = byCampaign.get(row.campaignCode) ?? { code: row.campaignCode, visits: 0, clicks: 0, signups: 0 };
    campaign[field] += row.count;
    byCampaign.set(row.campaignCode, campaign);
  }
  const campaigns = [...byCampaign.values()].sort(
    (a, b) => b.signups - a.signups || b.visits - a.visits || a.code.localeCompare(b.code)
  );
  return {
    days,
    from,
    to: today,
    totals,
    rates: {
      visitToClick: funnelRate(totals.clicks, totals.visits),
      clickToSignup: funnelRate(totals.signups, totals.clicks),
      visitToSignup: funnelRate(totals.signups, totals.visits),
    },
    series,
    campaigns,
  };
}

export async function readWaitlistFunnel(
  query: { days: FunnelPeriod },
  deps: { now?: Date; db?: FunnelReadDatabase } = {}
): Promise<WaitlistFunnel> {
  const now = deps.now ?? new Date();
  const db = deps.db ?? (prisma as unknown as FunnelReadDatabase);
  const from = shiftDay(funnelDayKey(now), -(query.days - 1));
  const rows = await db.waitlistFunnelDaily.findMany({
    where: { day: { gte: new Date(`${from}T00:00:00.000Z`) }, event: { in: [...PAGE_FUNNEL_EVENTS] } },
    select: { day: true, campaignCode: true, event: true, count: true },
  });
  return summarizeFunnel(rows, query.days, now);
}
