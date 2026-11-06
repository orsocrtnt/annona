import { resolveMx } from "node:dns/promises";
import { z } from "zod";
import { prisma } from "@/services/prisma/client";
import { FUNNEL_CAMPAIGN_PATTERN, funnelRate } from "@/domains/growth/waitlist-funnel.service";
import { renderProspectEmail } from "@/domains/growth/prospect/prospect-email";
import {
  PROSPECT_SET_ASIDE_PREFIX,
  findStrictProviders,
  setAsideDetail,
  type MxLookup,
} from "@/domains/growth/prospect/prospect-mail-provider";
import {
  createProspectMailer,
  describeMailerError,
  readProspectMailerConfig,
  type ProspectMailer,
} from "@/domains/growth/prospect/prospect-mailer";

/**
 * ADMIN-ESPACE lot 5 : campagnes de prospection (décisions du propriétaire du 5 novembre 2026).
 * - un mail par adresse et par campagne, jamais à une adresse qui a répondu STOP ;
 * - envoi un par un, espacé d'au moins `PROSPECT_MIN_INTERVAL_MS`, depuis la boîte OVH ;
 * - suivi par campagne seulement : envois, clics des deux liens, inscriptions, réponses saisies à la main.
 */

export const PROSPECT_CODE_PREFIX = "il-en-est-ou-";
export const PROSPECT_MIN_INTERVAL_MS = 25_000;
/** Pause conseillée entre deux envois côté navigateur. */
export const PROSPECT_SEND_PACE_MS = 30_000;
/** Un envoi resté « en cours » plus longtemps est considéré interrompu (jamais renvoyé automatiquement). */
export const PROSPECT_STALE_CLAIM_MS = 10 * 60 * 1000;
export const PROSPECT_MAX_ADDRESSES_PER_PASTE = 500;
export const PROSPECT_TEST_CODE = "test";
export const PROSPECT_DEFAULT_ADDRESS_SOURCE = "Google Maps ou le site de votre entreprise";

const noControl = (value: string) => !/[\u0000-\u001f\u007f]/.test(value);

export const createProspectCampaignSchema = z
  .object({
    name: z.string().trim().min(2).max(80).refine(noControl),
    city: z.string().trim().min(2).max(60).refine(noControl),
    addressSource: z.string().trim().min(2).max(120).refine(noControl),
  })
  .strict();

export const prospectAddressesSchema = z.object({ addresses: z.string().max(60_000) }).strict();
export const prospectRepliesSchema = z.object({ delta: z.union([z.literal(1), z.literal(-1)]) }).strict();
export const prospectSendSchema = z.object({ mode: z.enum(["next", "test"]) }).strict();
export const prospectReleaseSchema = z.object({ action: z.literal("release_set_aside") }).strict();

/* ---------- Fonctions pures ---------- */

/** Ville → code de lien : minuscules, sans accent, tirets (ex. « Aix-en-Provence » → il-en-est-ou-aix-en-provence). */
export function prospectCampaignCode(city: string): string {
  const slug = city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40 - PROSPECT_CODE_PREFIX.length - 3)
    .replace(/-+$/g, "");
  return `${PROSPECT_CODE_PREFIX}${slug || "ville"}`;
}

const emailSchema = z.string().email().max(200);

/** Adresses collées (lignes, virgules, points-virgules ou espaces) : minuscules, sans doublon, invalides à part. */
export function parseProspectAddresses(text: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const value = raw.trim().replace(/^<|>$/g, "").toLowerCase();
    if (!value) continue;
    if (emailSchema.safeParse(value).success) valid.add(value);
    else invalid.add(raw.trim().slice(0, 80));
  }
  return { valid: [...valid], invalid: [...invalid] };
}

/* ---------- Lecture ---------- */

export type ProspectRecipientStatus = "PENDING" | "SENDING" | "SENT" | "FAILED" | "SKIPPED";

export type ProspectCampaignStats = {
  recipients: number;
  pending: number;
  sent: number;
  failed: number;
  /** Annulés après un STOP. */
  skipped: number;
  /** Mis de côté (Microsoft, filtres d'entreprise stricts) : ajoutés mais pas envoyés. */
  setAside: number;
  joinClicks: number;
  siteClicks: number;
  pageVisits: number;
  signups: number;
  replies: number;
  rates: { joinPerSent: number | null; signupPerSent: number | null; signupPerJoin: number | null };
};

export type ProspectCampaignSummary = {
  id: string;
  code: string;
  name: string;
  city: string;
  addressSource: string;
  createdAt: string;
  lastSentAt: string | null;
  stats: ProspectCampaignStats;
};

export type ProspectCampaignList = {
  mailerReady: boolean;
  paceMs: number;
  optOuts: number;
  campaigns: ProspectCampaignSummary[];
};

export type ProspectRecipientRow = {
  id: string;
  email: string;
  status: ProspectRecipientStatus;
  detail: string | null;
  sentAt: string | null;
};

export type ProspectCampaignDetail = ProspectCampaignSummary & { recipients: ProspectRecipientRow[] };

type CampaignRow = {
  id: string;
  code: string;
  name: string;
  city: string;
  addressSource: string;
  repliesCount: number;
  createdAt: Date;
};

const campaignSelect = {
  id: true,
  code: true,
  name: true,
  city: true,
  addressSource: true,
  repliesCount: true,
  createdAt: true,
} as const;

function emptyStats(replies: number): Omit<ProspectCampaignStats, "rates"> {
  return { recipients: 0, pending: 0, sent: 0, failed: 0, skipped: 0, setAside: 0, joinClicks: 0, siteClicks: 0, pageVisits: 0, signups: 0, replies };
}

function withRates(stats: Omit<ProspectCampaignStats, "rates">): ProspectCampaignStats {
  return {
    ...stats,
    rates: {
      joinPerSent: funnelRate(stats.joinClicks, stats.sent),
      signupPerSent: funnelRate(stats.signups, stats.sent),
      signupPerJoin: funnelRate(stats.signups, stats.joinClicks),
    },
  };
}

async function summarize(campaigns: CampaignRow[]): Promise<ProspectCampaignSummary[]> {
  if (campaigns.length === 0) return [];
  const ids = campaigns.map((campaign) => campaign.id);
  const codes = campaigns.map((campaign) => campaign.code);
  const [statusRows, setAsideRows, lastSent, clickRows, signupRows] = await Promise.all([
    prisma.prospectCampaignRecipient.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.prospectCampaignRecipient.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids }, status: "SKIPPED", detail: { startsWith: PROSPECT_SET_ASIDE_PREFIX } },
      _count: { _all: true },
    }),
    prisma.prospectCampaignRecipient.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids }, status: "SENT" },
      _max: { sentAt: true },
    }),
    prisma.waitlistFunnelDaily.groupBy({
      by: ["campaignCode", "event"],
      where: { campaignCode: { in: codes }, event: { in: ["MAIL_JOIN", "MAIL_SITE", "VISIT"] } },
      _sum: { count: true },
    }),
    prisma.contactMessage.groupBy({
      by: ["campaignCode"],
      where: { campaignCode: { in: codes } },
      _count: { _all: true },
    }),
  ]);
  const stats = new Map(campaigns.map((campaign) => [campaign.id, emptyStats(campaign.repliesCount)]));
  const byCode = new Map(campaigns.map((campaign) => [campaign.code, stats.get(campaign.id)!]));
  for (const row of statusRows) {
    const entry = stats.get(row.campaignId);
    if (!entry) continue;
    const count = row._count._all;
    entry.recipients += count;
    if (row.status === "PENDING" || row.status === "SENDING") entry.pending += count;
    if (row.status === "SENT") entry.sent += count;
    if (row.status === "FAILED") entry.failed += count;
    if (row.status === "SKIPPED") entry.skipped += count;
  }
  for (const row of setAsideRows) {
    const entry = stats.get(row.campaignId);
    if (!entry) continue;
    entry.setAside += row._count._all;
    entry.skipped -= row._count._all;
  }
  for (const row of clickRows) {
    const entry = byCode.get(row.campaignCode);
    if (!entry) continue;
    const count = row._sum.count ?? 0;
    if (row.event === "MAIL_JOIN") entry.joinClicks += count;
    if (row.event === "MAIL_SITE") entry.siteClicks += count;
    if (row.event === "VISIT") entry.pageVisits += count;
  }
  for (const row of signupRows) {
    const entry = row.campaignCode ? byCode.get(row.campaignCode) : undefined;
    if (entry) entry.signups += row._count._all;
  }
  const lastSentAt = new Map(lastSent.map((row) => [row.campaignId, row._max.sentAt]));
  return campaigns.map((campaign) => ({
    id: campaign.id,
    code: campaign.code,
    name: campaign.name,
    city: campaign.city,
    addressSource: campaign.addressSource,
    createdAt: campaign.createdAt.toISOString(),
    lastSentAt: lastSentAt.get(campaign.id)?.toISOString() ?? null,
    stats: withRates(stats.get(campaign.id)!),
  }));
}

export async function listProspectCampaigns(): Promise<ProspectCampaignList> {
  const [campaigns, optOuts] = await Promise.all([
    prisma.prospectCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 100, select: campaignSelect }),
    prisma.prospectOptOut.count(),
  ]);
  return {
    mailerReady: readProspectMailerConfig() !== null,
    paceMs: PROSPECT_SEND_PACE_MS,
    optOuts,
    campaigns: await summarize(campaigns),
  };
}

export async function readProspectCampaign(id: string): Promise<ProspectCampaignDetail | null> {
  const campaign = await prisma.prospectCampaign.findUnique({ where: { id }, select: campaignSelect });
  if (!campaign) return null;
  const [summary] = await summarize([campaign]);
  const recipients = await prisma.prospectCampaignRecipient.findMany({
    where: { campaignId: id },
    orderBy: [{ createdAt: "asc" }, { email: "asc" }],
    take: 2_000,
    select: { id: true, email: true, status: true, detail: true, sentAt: true },
  });
  return {
    ...summary!,
    recipients: recipients.map((row) => ({ ...row, sentAt: row.sentAt?.toISOString() ?? null })),
  };
}

/* ---------- Écritures ---------- */

export async function createProspectCampaign(
  input: z.infer<typeof createProspectCampaignSchema>,
  actorId: string
): Promise<{ id: string; code: string }> {
  const base = prospectCampaignCode(input.city);
  const taken = new Set(
    (
      await prisma.prospectCampaign.findMany({ where: { code: { startsWith: base } }, select: { code: true } })
    ).map((row) => row.code)
  );
  let code = base;
  for (let suffix = 2; taken.has(code); suffix += 1) code = `${base}-${suffix}`;
  if (!FUNNEL_CAMPAIGN_PATTERN.test(code)) throw new Error("Code de campagne invalide");
  const created = await prisma.prospectCampaign.create({
    data: { code, name: input.name, city: input.city, addressSource: input.addressSource, createdById: actorId },
    select: { id: true, code: true },
  });
  return created;
}

export type AddAddressesResult = {
  added: number;
  /** Parmi les ajoutées, adresses mises de côté (Microsoft, filtres stricts) : pas envoyées. */
  setAside: number;
  alreadyInCampaign: number;
  optedOut: number;
  invalid: string[];
};

const dnsMxLookup: MxLookup = async (domain) => (await resolveMx(domain)).map((record) => record.exchange);

export async function addProspectRecipients(
  campaignId: string,
  text: string,
  lookup: MxLookup = dnsMxLookup
): Promise<{ status: "ok"; result: AddAddressesResult } | { status: "not_found" } | { status: "too_many" }> {
  const campaign = await prisma.prospectCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return { status: "not_found" };
  const { valid, invalid } = parseProspectAddresses(text);
  if (valid.length > PROSPECT_MAX_ADDRESSES_PER_PASTE) return { status: "too_many" };
  const optedOut = new Set(
    (await prisma.prospectOptOut.findMany({ where: { email: { in: valid } }, select: { email: true } })).map((row) => row.email)
  );
  const allowed = valid.filter((email) => !optedOut.has(email));
  const existing = new Set(
    (
      await prisma.prospectCampaignRecipient.findMany({
        where: { campaignId, email: { in: allowed } },
        select: { email: true },
      })
    ).map((row) => row.email)
  );
  const fresh = allowed.filter((email) => !existing.has(email));
  const strict = await findStrictProviders(fresh, lookup);
  const created = await prisma.prospectCampaignRecipient.createMany({
    data: fresh.map((email) => {
      const provider = strict.get(email);
      return provider ? { campaignId, email, status: "SKIPPED" as const, detail: setAsideDetail(provider) } : { campaignId, email };
    }),
    skipDuplicates: true,
  });
  return {
    status: "ok",
    result: {
      added: created.count,
      setAside: Math.min(strict.size, created.count),
      alreadyInCampaign: allowed.length - created.count,
      optedOut: optedOut.size,
      invalid: invalid.slice(0, 20),
    },
  };
}

/** Remet dans l'envoi les adresses mises de côté de la campagne (les STOP restent bloqués à l'envoi). */
export async function releaseSetAsideRecipients(campaignId: string): Promise<{ status: "ok"; released: number } | { status: "not_found" }> {
  const campaign = await prisma.prospectCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return { status: "not_found" };
  const released = await prisma.prospectCampaignRecipient.updateMany({
    where: { campaignId, status: "SKIPPED", detail: { startsWith: PROSPECT_SET_ASIDE_PREFIX } },
    data: { status: "PENDING", detail: null },
  });
  return { status: "ok", released: released.count };
}

/** Adresses STOP : enregistrées pour toujours ; leurs envois encore en attente sont annulés. */
export async function addProspectOptOuts(
  text: string,
  actorId: string
): Promise<{ status: "ok"; added: number; cancelled: number; invalid: string[] } | { status: "too_many" }> {
  const { valid, invalid } = parseProspectAddresses(text);
  if (valid.length > PROSPECT_MAX_ADDRESSES_PER_PASTE) return { status: "too_many" };
  const [created, cancelled] = await prisma.$transaction([
    prisma.prospectOptOut.createMany({
      data: valid.map((email) => ({ email, createdById: actorId })),
      skipDuplicates: true,
    }),
    prisma.prospectCampaignRecipient.updateMany({
      where: { email: { in: valid }, status: "PENDING" },
      data: { status: "SKIPPED", detail: "STOP" },
    }),
  ]);
  return { status: "ok", added: created.count, cancelled: cancelled.count, invalid: invalid.slice(0, 20) };
}

export async function adjustProspectReplies(campaignId: string, delta: 1 | -1): Promise<number | null> {
  const rows = await prisma.$queryRaw<Array<{ replies_count: number }>>`
    UPDATE "prospect_campaigns"
    SET "replies_count" = GREATEST("replies_count" + ${delta}, 0), "updated_at" = NOW()
    WHERE "id" = ${campaignId}
    RETURNING "replies_count"`;
  return rows[0]?.replies_count ?? null;
}

/* ---------- Envoi ---------- */

export type ClaimedRecipient = { id: string; email: string };

export type ProspectSendRepository = {
  findCampaign: (id: string) => Promise<{ id: string; code: string; city: string; addressSource: string } | null>;
  /** Réserve la prochaine adresse en attente, ou indique combien attendre avant le prochain envoi. */
  claimNext: (campaignId: string, now: Date) => Promise<{ kind: "claimed"; recipient: ClaimedRecipient } | { kind: "wait"; waitMs: number } | { kind: "empty" }>;
  isOptedOut: (email: string) => Promise<boolean>;
  finish: (recipientId: string, outcome: { status: "SENT" | "FAILED" | "SKIPPED"; detail: string | null; at: Date }) => Promise<void>;
  remaining: (campaignId: string) => Promise<number>;
};

export type ProspectSendResult =
  | { status: "sent"; email: string; remaining: number; waitMs: number }
  | { status: "skipped"; email: string; remaining: number; waitMs: number }
  | { status: "failed"; email: string; detail: string; remaining: number; waitMs: number }
  | { status: "wait"; waitMs: number; remaining: number }
  | { status: "done"; remaining: 0 }
  | { status: "not_found" }
  | { status: "not_configured" };

export function createPrismaProspectSendRepository(db: typeof prisma = prisma): ProspectSendRepository {
  return {
    findCampaign: (id) =>
      db.prospectCampaign.findUnique({ where: { id }, select: { id: true, code: true, city: true, addressSource: true } }),
    claimNext: (campaignId, now) =>
      db.$transaction(async (tx) => {
        // Verrou de la campagne : deux onglets ou deux appels simultanés n'envoient jamais en parallèle.
        await tx.$queryRaw`SELECT "id" FROM "prospect_campaigns" WHERE "id" = ${campaignId} FOR UPDATE`;
        const staleBefore = new Date(now.getTime() - PROSPECT_STALE_CLAIM_MS);
        await tx.prospectCampaignRecipient.updateMany({
          where: { campaignId, status: "SENDING", claimedAt: { lt: staleBefore } },
          data: { status: "FAILED", detail: "Envoi interrompu : vérifier dans la boîte d'envoi avant de renvoyer." },
        });
        const last = await tx.prospectCampaignRecipient.findFirst({
          where: { campaignId, claimedAt: { not: null } },
          orderBy: [{ claimedAt: "desc" }],
          select: { claimedAt: true, status: true },
        });
        if (last?.status === "SENDING") return { kind: "wait" as const, waitMs: PROSPECT_MIN_INTERVAL_MS };
        if (last?.claimedAt) {
          const elapsed = now.getTime() - last.claimedAt.getTime();
          if (elapsed < PROSPECT_MIN_INTERVAL_MS) return { kind: "wait" as const, waitMs: PROSPECT_MIN_INTERVAL_MS - elapsed };
        }
        const next = await tx.prospectCampaignRecipient.findFirst({
          where: { campaignId, status: "PENDING" },
          orderBy: [{ createdAt: "asc" }, { email: "asc" }],
          select: { id: true, email: true },
        });
        if (!next) return { kind: "empty" as const };
        await tx.prospectCampaignRecipient.update({ where: { id: next.id }, data: { status: "SENDING", claimedAt: now } });
        return { kind: "claimed" as const, recipient: next };
      }),
    isOptedOut: async (email) => (await db.prospectOptOut.count({ where: { email } })) > 0,
    finish: async (recipientId, outcome) => {
      await db.prospectCampaignRecipient.update({
        where: { id: recipientId },
        data: { status: outcome.status, detail: outcome.detail, sentAt: outcome.status === "SENT" ? outcome.at : null },
      });
    },
    remaining: (campaignId) => db.prospectCampaignRecipient.count({ where: { campaignId, status: "PENDING" } }),
  };
}

function defaultMailer(): ProspectMailer | null {
  const config = readProspectMailerConfig();
  return config ? createProspectMailer(config) : null;
}

/** Un seul mail par appel : le navigateur rappelle toutes les 30 secondes tant que l'envoi est lancé. */
export async function sendNextProspectEmail(
  campaignId: string,
  baseUrl: string,
  deps: { repository?: ProspectSendRepository; mailer?: ProspectMailer | null; now?: () => Date } = {}
): Promise<ProspectSendResult> {
  const repository = deps.repository ?? createPrismaProspectSendRepository();
  const mailer = deps.mailer === undefined ? defaultMailer() : deps.mailer;
  const now = deps.now ?? (() => new Date());
  const campaign = await repository.findCampaign(campaignId);
  if (!campaign) return { status: "not_found" };
  if (!mailer) return { status: "not_configured" };

  const claim = await repository.claimNext(campaignId, now());
  if (claim.kind === "empty") return { status: "done", remaining: 0 };
  if (claim.kind === "wait") return { status: "wait", waitMs: claim.waitMs, remaining: await repository.remaining(campaignId) };

  const { recipient } = claim;
  if (await repository.isOptedOut(recipient.email)) {
    await repository.finish(recipient.id, { status: "SKIPPED", detail: "STOP", at: now() });
    return { status: "skipped", email: recipient.email, remaining: await repository.remaining(campaignId), waitMs: 0 };
  }
  const email = renderProspectEmail({ city: campaign.city, linkCode: campaign.code, addressSource: campaign.addressSource, baseUrl });
  try {
    await mailer.send(recipient.email, email);
  } catch (error) {
    const detail = describeMailerError(error);
    await repository.finish(recipient.id, { status: "FAILED", detail, at: now() });
    return { status: "failed", email: recipient.email, detail, remaining: await repository.remaining(campaignId), waitMs: PROSPECT_SEND_PACE_MS };
  }
  await repository.finish(recipient.id, { status: "SENT", detail: null, at: now() });
  return { status: "sent", email: recipient.email, remaining: await repository.remaining(campaignId), waitMs: PROSPECT_SEND_PACE_MS };
}

/** Mail d'essai à l'adresse du super-administrateur : liens au code « test », rien n'est compté pour la campagne. */
export async function sendProspectTestEmail(
  campaignId: string,
  to: string,
  baseUrl: string,
  deps: { repository?: ProspectSendRepository; mailer?: ProspectMailer | null } = {}
): Promise<{ status: "sent"; to: string } | { status: "failed"; detail: string } | { status: "not_found" } | { status: "not_configured" }> {
  const repository = deps.repository ?? createPrismaProspectSendRepository();
  const mailer = deps.mailer === undefined ? defaultMailer() : deps.mailer;
  const campaign = await repository.findCampaign(campaignId);
  if (!campaign) return { status: "not_found" };
  if (!mailer) return { status: "not_configured" };
  const email = renderProspectEmail({ city: campaign.city, linkCode: PROSPECT_TEST_CODE, addressSource: campaign.addressSource, baseUrl });
  try {
    await mailer.send(to, { ...email, subject: `[Essai] ${email.subject}` });
    return { status: "sent", to };
  } catch (error) {
    return { status: "failed", detail: describeMailerError(error) };
  }
}

/** Origine des liens : `PROSPECT_LINK_BASE_URL` si défini, sinon l'adresse par laquelle le super-admin travaille. */
export function prospectLinkBaseUrl(requestUrl: string, env: Record<string, string | undefined> = process.env): string {
  const configured = env.PROSPECT_LINK_BASE_URL?.trim();
  if (configured && /^https?:\/\/[^\s/]+$/.test(configured.replace(/\/+$/, ""))) return configured.replace(/\/+$/, "");
  return new URL(requestUrl).origin;
}
