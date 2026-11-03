import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { deferredJobError, enqueueOperationJob, kickOperationJob } from "@/domains/operations/operation-job.service";
import { inboundEmailDomain } from "@/domains/public-order/intake-channels.service";
import { analyzeOrderMessage } from "./order-intake.service";
import { ORDER_INTAKE_MAX_TEXT_LENGTH } from "./order-intake.schema";

/** Tolérance de la signature : au-delà, un webhook capturé ne peut plus être rejoué. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
/** Plafond par entreprise : une adresse divulguée ne remplit ni la base ni le quota d'analyse. */
export const INBOUND_DAILY_LIMIT = 200;
export const INBOUND_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
/** MAIL-PONT : un e-mail « À trier » garde son texte 7 jours pour un éventuel rattrapage, puis disparaît. */
export const NOT_ORDER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Raison du rangement en « À trier », gardée dans `analysisError` (aucune colonne de plus). */
export type NotOrderReason = "not_order" | "attachments_only" | "empty";

/**
 * Un e-mail sans texte n'a rien à apprendre au modèle : on ne paie pas d'analyse. Un objet seul,
 * sans pièce jointe, peut porter une commande (« 3 colis rue X demain ») : il reste analysé.
 */
export function inboundSkipReason(email: { subject: string; bodyText: string; attachmentCount: number }): NotOrderReason | null {
  if (email.bodyText.trim()) return null;
  if (email.attachmentCount > 0) return "attachments_only";
  return email.subject.trim() ? null : "empty";
}

/** Statut après analyse : seul un e-mail reconnu comme commande affiche « Brouillon prêt ». */
export function inboundAnalysisUpdate(result: Awaited<ReturnType<typeof analyzeOrderMessage>>) {
  if (result.status !== "ok") return { status: "ANALYSIS_FAILED" as const, analysisError: result.status };
  const draft = result.draft as unknown as Prisma.InputJsonValue;
  return result.draft.kind === "other"
    ? { status: "NOT_ORDER" as const, draft, analysisError: "not_order" satisfies NotOrderReason }
    : { status: "ANALYZED" as const, draft, analysisError: null };
}

const FORWARD_HEADER = /^[\s>*]*(?:De|From|Expéditeur|Envoyé par)\s*:\s*(.+)$/im;
const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * MAIL-PONT : adresse de l'expéditeur cité dans un e-mail transféré à la main (Gmail « From: », Outlook
 * « De : », Apple Mail « De: »). Seul le premier bloc cité compte : c'est le dernier transfert, donc le
 * client. Aucune adresse lisible ou adresse identique à celle qui transfère : null.
 */
export function forwardedSender(body: string, forwarder: string): string | null {
  const line = FORWARD_HEADER.exec(body)?.[1];
  if (!line) return null;
  const address = (line.match(/<([^>]+)>/)?.[1] ?? line.match(EMAIL_IN_TEXT)?.[0] ?? "").trim().toLowerCase();
  if (!EMAIL_IN_TEXT.test(address) || address === forwarder) return null;
  return dbSafeText(address, 200);
}

/** Vérification Svix (format des webhooks Resend) sur le corps brut, à temps constant. */
export function verifyInboundWebhook(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  now = new Date()
): boolean {
  if (!secret || !headers.id || !headers.timestamp || !headers.signature) return false;
  const timestamp = Number(headers.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(now.getTime() / 1000 - timestamp) > WEBHOOK_TOLERANCE_SECONDS) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${headers.id}.${headers.timestamp}.${body}`).digest();
  return headers.signature.split(" ").some((entry) => {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

/** Partie locale de la première adresse du domaine de réception, sous forme « Nom <a@b> » ou nue. */
export function inboundTokenFromRecipients(recipients: unknown[], domain: string): string | null {
  for (const recipient of recipients) {
    if (typeof recipient !== "string") continue;
    const address = (recipient.match(/<([^>]+)>/)?.[1] ?? recipient).trim().toLowerCase();
    const [local, host] = address.split("@");
    if (host === domain && local && /^[0-9a-f]{32}$/.test(local)) return local;
  }
  return null;
}

export function senderAddress(from: string) {
  return dbSafeText((from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase(), 200);
}

/** Texte brut d'un e-mail HTML : suffisant pour l'analyse, jamais réaffiché comme du HTML. */
export function htmlToText(html: string) {
  return html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

/**
 * Texte accepté par PostgreSQL : sans caractère nul ni moitié d'émoji (erreur 22021). Appliqué
 * après la coupe, qui peut elle-même séparer un émoji. Sans cela, l'écriture échoue à chaque
 * renvoi du webhook et l'e-mail est perdu sans alerte.
 */
export function dbSafeText(value: string, maxLength: number) {
  return value
    .slice(0, maxLength)
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "\uFFFD");
}

/** Des e-mails simultanés de la même entreprise attendent le verrou au lieu d'échouer (P2028). */
const INGEST_TX = { maxWait: 10_000, timeout: 15_000 } as const;

type ReceivedEmail = { from?: unknown; subject?: unknown; text?: unknown; html?: unknown; attachments?: unknown };

async function fetchReceivedEmail(emailId: string, apiKey: string, fetcher: typeof fetch): Promise<ReceivedEmail> {
  const response = await fetcher(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`INBOUND_FETCH_${response.status}`);
  return (await response.json()) as ReceivedEmail;
}

export type InboundIngestResult = "stored" | "duplicate" | "ignored" | "over_limit";

/**
 * Enregistre un e-mail reçu puis programme son analyse. Rien n'est créé côté commandes.
 * Une panne du fournisseur remonte : le webhook répond 503 et Resend renvoie l'événement.
 */
export async function ingestInboundEmail(
  event: unknown,
  deps: { env?: Record<string, string | undefined>; fetcher?: typeof fetch; now?: Date } = {}
): Promise<InboundIngestResult> {
  const env = deps.env ?? process.env;
  const now = deps.now ?? new Date();
  const payload = event as { type?: unknown; data?: { email_id?: unknown; to?: unknown; received_for?: unknown } } | null;
  if (payload?.type !== "email.received") return "ignored";
  const emailId = payload.data?.email_id;
  const domain = inboundEmailDomain(env);
  if (typeof emailId !== "string" || !emailId || emailId.length > 128 || !domain) return "ignored";

  const recipients = [payload.data?.received_for, payload.data?.to].flatMap((list) => (Array.isArray(list) ? list : []));
  const token = inboundTokenFromRecipients(recipients, domain);
  if (!token) return "ignored";
  const channel = await prisma.companyIntakeChannel.findUnique({
    where: { inboundEmailToken: token },
    select: { companyId: true, inboundEmailEnabled: true },
  });
  if (!channel?.inboundEmailEnabled) return "ignored";
  const { companyId } = channel;

  if (await prisma.inboundOrderEmail.findUnique({ where: { providerEmailId: emailId }, select: { id: true } })) return "duplicate";
  const dayWindow = { companyId, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
  // Premier contrôle sans verrou : un plafond déjà atteint n'appelle pas le fournisseur.
  if ((await prisma.inboundOrderEmail.count({ where: dayWindow })) >= INBOUND_DAILY_LIMIT) return "over_limit";

  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("INBOUND_NOT_CONFIGURED");
  const email = await fetchReceivedEmail(emailId, apiKey, deps.fetcher ?? fetch);
  const body = typeof email.text === "string" && email.text.trim()
    ? email.text.trim()
    : typeof email.html === "string" ? htmlToText(email.html) : "";

  const from = senderAddress(typeof email.from === "string" ? email.from : "");
  // Transfert à la main par l'équipe (un renvoi automatique garde, lui, le client en expéditeur) :
  // on cherche le client dans le bloc cité. Jamais pour un expéditeur extérieur, qui pourrait citer n'importe qui.
  const fromTeam = from && await prisma.user.count({
    where: { companyId, email: { equals: from, mode: "insensitive" }, role: { systemRole: { not: "CLIENT" } } },
  }) > 0;
  const originalSender = fromTeam ? forwardedSender(body, from) : null;

  const jobId = await prisma.$transaction(async (tx) => {
    // Recompte sous verrou par entreprise : des e-mails simultanés ne dépassent plus le plafond.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`tutelliv:inbound-email:${companyId}`}))`;
    if ((await tx.inboundOrderEmail.count({ where: dayWindow })) >= INBOUND_DAILY_LIMIT) return "over_limit" as const;
    const created = await tx.inboundOrderEmail.createMany({
      data: [{
        companyId,
        providerEmailId: emailId,
        fromAddress: from,
        originalSender,
        subject: dbSafeText(typeof email.subject === "string" ? email.subject : "", 300),
        bodyText: dbSafeText(body, ORDER_INTAKE_MAX_TEXT_LENGTH),
        attachmentCount: Array.isArray(email.attachments) ? email.attachments.length : 0,
      }],
      skipDuplicates: true,
    });
    if (created.count === 0) return null;
    const row = await tx.inboundOrderEmail.findUniqueOrThrow({ where: { providerEmailId: emailId }, select: { id: true } });
    const job = await enqueueOperationJob(tx, {
      jobKey: `inbound-email:${row.id}`,
      type: "INBOUND_EMAIL",
      companyId,
      payload: { inboundEmailId: row.id },
    });
    return job.id;
  }, INGEST_TX);
  if (jobId === "over_limit") return "over_limit";
  if (!jobId) return "duplicate";
  kickOperationJob(jobId);
  // Purge au fil de l'eau : aucun e-mail reçu ne survit à la durée de conservation.
  await prisma.inboundOrderEmail.deleteMany({
    where: {
      OR: [
        { createdAt: { lt: new Date(now.getTime() - INBOUND_RETENTION_MS) } },
        { status: "NOT_ORDER", createdAt: { lt: new Date(now.getTime() - NOT_ORDER_RETENTION_MS) } },
      ],
    },
  }).catch((error) => console.error("Inbound purge failed:", error instanceof Error ? error.message : "unknown"));
  return "stored";
}

/** Tâche durable : l'analyse réutilise le domaine existant (quota, activation, clé, garde-fous). */
export async function analyzeInboundEmailJob(
  payload: unknown,
  deps: { analyze?: typeof analyzeOrderMessage; now?: Date } = {}
) {
  const id = (payload as { inboundEmailId?: unknown } | null)?.inboundEmailId;
  if (typeof id !== "string") throw new Error("INBOUND_EMAIL_PAYLOAD_INVALID");
  const email = await prisma.inboundOrderEmail.findUnique({ where: { id } });
  if (!email || email.status !== "RECEIVED") return;
  const skip = inboundSkipReason(email);
  if (skip) {
    await prisma.inboundOrderEmail.updateMany({ where: { id, status: "RECEIVED" }, data: { status: "NOT_ORDER", analysisError: skip } });
    return;
  }

  const text = [email.subject ? `Objet : ${email.subject}` : "", email.bodyText].filter(Boolean).join("\n\n").slice(0, ORDER_INTAKE_MAX_TEXT_LENGTH);
  const analyze = deps.analyze ?? analyzeOrderMessage;
  const result = await analyze({ companyId: email.companyId, text, sender: email.originalSender ?? email.fromAddress });
  if (result.status === "rate_limited") {
    const now = deps.now ?? new Date();
    throw deferredJobError("INBOUND_ANALYSIS_QUOTA", new Date(now.getTime() + result.retryAfterSeconds * 1000));
  }
  await prisma.inboundOrderEmail.updateMany({ where: { id, status: "RECEIVED" }, data: inboundAnalysisUpdate(result) });
}

export async function listInboundEmails(companyId: string) {
  const rows = await prisma.inboundOrderEmail.findMany({
    where: { companyId, status: { in: ["RECEIVED", "ANALYZED", "ANALYSIS_FAILED", "NOT_ORDER"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, fromAddress: true, originalSender: true, subject: true, bodyText: true, attachmentCount: true, status: true, draft: true, analysisError: true, createdAt: true },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** Traité ou classé : le contenu n'a plus de raison d'être conservé. */
export async function closeInboundEmail(companyId: string, id: string, input: { status: "CONVERTED" | "DISMISSED"; orderId?: string }) {
  const orderId = input.status === "CONVERTED" && input.orderId
    ? (await prisma.order.findFirst({ where: { id: input.orderId, companyId }, select: { id: true } }))?.id ?? null
    : null;
  const updated = await prisma.inboundOrderEmail.updateMany({
    where: { id, companyId },
    data: { status: input.status, orderId, bodyText: "", draft: Prisma.DbNull, subject: "", analysisError: null, originalSender: null },
  });
  return updated.count > 0;
}
