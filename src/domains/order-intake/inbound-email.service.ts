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
const EMAIL_IN_TEXT_GLOBAL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

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

export const GMAIL_FORWARDING_SENDER = "forwarding-noreply@google.com";
export const FORWARDING_CONFIRMATION_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Lien d'approbation du renvoi Gmail : seulement en https vers mail-settings.google.com ou
 * mail.google.com (chemin /mail/), pour qu'un faux e-mail ne fasse jamais afficher un autre site.
 */
export function gmailApprovalLink(value: string | null | undefined): string | null {
  if (!value || value.length > 1_000) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (host !== "mail-settings.google.com" && host !== "mail.google.com") return null;
    return url.pathname.startsWith("/mail/") ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * MAIL-PONT : e-mail que Gmail envoie à l'adresse TutelLiv quand l'entreprise ajoute un renvoi. Ancien
 * format : code à 9 chiffres (« (#123456789) Gmail Forwarding Confirmation »). Format relevé le
 * 4 novembre 2026 : « (Gmail) Confirmation de transfert – Recevez les messages de x@gmail.com », sans code,
 * avec un lien d'approbation. On n'en garde que le code ou le lien et l'adresse qui demande le renvoi ;
 * jamais envoyé au modèle.
 */
export function gmailForwardingConfirmation(
  from: string,
  subject: string,
  body: string
): { code: string | null; link: string | null; requester: string | null } | null {
  if (from !== GMAIL_FORWARDING_SENDER) return null;
  const code = subject.match(/\(#\s*(\d{6,12})\)/)?.[1] ?? body.match(/(?:code|confirmation)[^\d]{0,40}(\d{6,12})/i)?.[1] ?? null;
  const link = gmailApprovalLink(body.match(/https:\/\/mail(?:-settings)?\.google\.com\/mail\/[^\s<>"')\]]+/i)?.[0]);
  if (!code && !link) return null;
  const requester = [subject, body].join("\n").match(EMAIL_IN_TEXT_GLOBAL)?.find((address) => !/@google\.com$/i.test(address) && !/@commandes\./i.test(address))?.toLowerCase() ?? null;
  return { code, link, requester };
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
  // Premier contrôle sans verrou : un plafond déjà atteint n'appelle pas le fournisseur.
  if ((await prisma.inboundOrderEmail.count({ where: inboundDayWindow(companyId, now) })) >= INBOUND_DAILY_LIMIT) return "over_limit";

  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("INBOUND_NOT_CONFIGURED");
  const email = await fetchReceivedEmail(emailId, apiKey, deps.fetcher ?? fetch);
  const body = typeof email.text === "string" && email.text.trim()
    ? email.text.trim()
    : typeof email.html === "string" ? htmlToText(email.html) : "";

  const from = senderAddress(typeof email.from === "string" ? email.from : "");
  const subject = typeof email.subject === "string" ? email.subject : "";
  const confirmation = gmailForwardingConfirmation(from, subject, body);
  if (confirmation) {
    // Ni analyse ni tâche : le code s'affiche dans Paramètres. Seuls le code et l'adresse sont gardés.
    const created = await prisma.inboundOrderEmail.createMany({
      data: [{
        companyId,
        providerEmailId: emailId,
        fromAddress: from,
        subject: "Confirmation de renvoi Gmail",
        bodyText: JSON.stringify(confirmation),
        status: "FORWARDING_CONFIRMATION",
      }],
      skipDuplicates: true,
    });
    return created.count === 0 ? "duplicate" : "stored";
  }
  // Transfert à la main par l'équipe (un renvoi automatique garde, lui, le client en expéditeur) :
  // on cherche le client dans le bloc cité. Jamais pour un expéditeur extérieur, qui pourrait citer n'importe qui.
  const fromTeam = from && await prisma.user.count({
    where: { companyId, email: { equals: from, mode: "insensitive" }, role: { systemRole: { not: "CLIENT" } } },
  }) > 0;
  const originalSender = fromTeam ? forwardedSender(body, from) : null;

  return queueInboundMessage(companyId, {
    providerEmailId: emailId,
    fromAddress: from,
    originalSender,
    subject,
    bodyText: body,
    attachmentCount: Array.isArray(email.attachments) ? email.attachments.length : 0,
  }, now);
}

const inboundDayWindow = (companyId: string, now: Date) => ({ companyId, createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } });

export type InboundMessageData = {
  providerEmailId: string;
  channel?: "EMAIL" | "WHATSAPP";
  fromAddress: string;
  originalSender?: string | null;
  subject: string;
  bodyText: string;
  attachmentCount: number;
};

/**
 * Commun à l'e-mail et à WhatsApp (WHATSAPP-1) : enregistre le message reçu sous le plafond quotidien
 * de l'entreprise, programme son analyse dans la même transaction, puis purge ce qui a expiré.
 */
export async function queueInboundMessage(companyId: string, message: InboundMessageData, now = new Date()): Promise<InboundIngestResult> {
  const dayWindow = inboundDayWindow(companyId, now);
  const jobId = await prisma.$transaction(async (tx) => {
    // Recompte sous verrou par entreprise : des messages simultanés ne dépassent plus le plafond.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`tutelliv:inbound-email:${companyId}`}))`;
    if ((await tx.inboundOrderEmail.count({ where: dayWindow })) >= INBOUND_DAILY_LIMIT) return "over_limit" as const;
    const created = await tx.inboundOrderEmail.createMany({
      data: [{
        companyId,
        providerEmailId: message.providerEmailId,
        channel: message.channel ?? "EMAIL",
        fromAddress: message.fromAddress,
        originalSender: message.originalSender ?? null,
        subject: dbSafeText(message.subject, 300),
        bodyText: dbSafeText(message.bodyText, ORDER_INTAKE_MAX_TEXT_LENGTH),
        attachmentCount: message.attachmentCount,
      }],
      skipDuplicates: true,
    });
    if (created.count === 0) return null;
    const row = await tx.inboundOrderEmail.findUniqueOrThrow({ where: { providerEmailId: message.providerEmailId }, select: { id: true } });
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
  // Purge au fil de l'eau : aucun message reçu ne survit à la durée de conservation.
  await prisma.inboundOrderEmail.deleteMany({
    where: {
      OR: [
        { createdAt: { lt: new Date(now.getTime() - INBOUND_RETENTION_MS) } },
        { status: "NOT_ORDER", createdAt: { lt: new Date(now.getTime() - NOT_ORDER_RETENTION_MS) } },
        { status: "FORWARDING_CONFIRMATION", createdAt: { lt: new Date(now.getTime() - FORWARDING_CONFIRMATION_RETENTION_MS) } },
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
  // WHATSAPP-1 : l'expéditeur est le membre de l'équipe qui a transféré, jamais le client. Le client
  // est cherché par le téléphone ou l'e-mail écrit dans le message ; l'e-mail lu devient le destinataire
  // de la confirmation, comme le client cité d'un e-mail transféré à la main.
  const whatsapp = email.channel === "WHATSAPP";
  const result = await analyze(whatsapp
    ? { companyId: email.companyId, text, matchCustomerFromText: true }
    : { companyId: email.companyId, text, sender: email.originalSender ?? email.fromAddress });
  if (result.status === "rate_limited") {
    const now = deps.now ?? new Date();
    throw deferredJobError("INBOUND_ANALYSIS_QUOTA", new Date(now.getTime() + result.retryAfterSeconds * 1000));
  }
  const readClient = whatsapp && result.status === "ok" && result.draft.senderEmail ? { originalSender: result.draft.senderEmail } : {};
  await prisma.inboundOrderEmail.updateMany({ where: { id, status: "RECEIVED" }, data: { ...inboundAnalysisUpdate(result), ...readClient } });
}

/** Codes de confirmation Gmail des dernières 24 heures, du plus récent au plus ancien. */
export async function listForwardingConfirmations(
  companyId: string,
  now = new Date(),
  db: Pick<typeof prisma, "inboundOrderEmail"> = prisma
) {
  const rows = await db.inboundOrderEmail.findMany({
    where: { companyId, status: "FORWARDING_CONFIRMATION", createdAt: { gte: new Date(now.getTime() - FORWARDING_CONFIRMATION_RETENTION_MS) } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { bodyText: true, createdAt: true },
  });
  if (!rows.length) return [];
  // Essai réel du 4 novembre : un e-mail ordinaire reçu après la demande prouve que le renvoi marche ;
  // la demande n'est plus affichée (sinon « Approuver » restait 24 h après l'approbation).
  const later = await db.inboundOrderEmail.findFirst({
    where: { companyId, status: { not: "FORWARDING_CONFIRMATION" }, fromAddress: { not: GMAIL_FORWARDING_SENDER }, createdAt: { gt: rows[rows.length - 1]!.createdAt } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return rows.filter((row) => !later || row.createdAt > later.createdAt).flatMap((row) => {
    try {
      const parsed = JSON.parse(row.bodyText) as { code?: unknown; link?: unknown; requester?: unknown };
      const code = typeof parsed.code === "string" ? parsed.code : null;
      const link = typeof parsed.link === "string" ? gmailApprovalLink(parsed.link) : null;
      if (!code && !link) return [];
      return [{ code, link, requester: typeof parsed.requester === "string" ? parsed.requester : null, receivedAt: row.createdAt.toISOString() }];
    } catch { return []; }
  });
}

export async function listInboundEmails(companyId: string) {
  const rows = await prisma.inboundOrderEmail.findMany({
    where: { companyId, status: { in: ["RECEIVED", "ANALYZED", "ANALYSIS_FAILED", "NOT_ORDER"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, channel: true, fromAddress: true, originalSender: true, subject: true, bodyText: true, attachmentCount: true, status: true, draft: true, analysisError: true, createdAt: true },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

/** Destinataire de la confirmation : le client d'origine, jamais un membre de l'équipe. */
async function confirmationRecipient(companyId: string, email: { channel: "EMAIL" | "WHATSAPP"; fromAddress: string; originalSender: string | null }) {
  if (email.originalSender) return email.originalSender;
  // WhatsApp : `fromAddress` est le téléphone d'un membre de l'équipe, jamais une adresse de client.
  if (!email.fromAddress || email.channel === "WHATSAPP") return null;
  const team = await prisma.user.count({
    where: { companyId, email: { equals: email.fromAddress, mode: "insensitive" }, role: { systemRole: { not: "CLIENT" } } },
  });
  return team > 0 ? null : email.fromAddress;
}

export type CloseInboundEmailInput = {
  status: "CONVERTED" | "DISMISSED";
  orderId?: string;
  /** Toutes les commandes créées depuis l'e-mail (une par livraison). */
  orderIds?: string[];
  /** MAIL-PONT, étape 5 : envoyer la confirmation au client (case cochée par défaut). */
  confirm?: boolean;
};

/**
 * Traité ou classé : le contenu n'a plus de raison d'être conservé. Converti avec `confirm` : une seule
 * confirmation par e-mail (clé de tâche par e-mail), programmée dans la même transaction que la clôture.
 * Renvoie false si l'e-mail n'existe pas dans l'entreprise ; `confirmation` dit ce qui a été programmé.
 */
export async function closeInboundEmail(companyId: string, id: string, input: CloseInboundEmailInput) {
  const email = await prisma.inboundOrderEmail.findFirst({
    where: { id, companyId },
    select: { channel: true, fromAddress: true, originalSender: true, status: true },
  });
  if (!email) return { closed: false as const };
  const ids = [...new Set([...(input.orderIds ?? []), ...(input.orderId ? [input.orderId] : [])])].slice(0, 10);
  const orders = input.status === "CONVERTED" && ids.length
    ? await prisma.order.findMany({ where: { id: { in: ids }, companyId }, select: { id: true }, orderBy: { createdAt: "asc" } })
    : [];
  const orderId = orders[0]?.id ?? null;
  const recipient = input.status === "CONVERTED" && input.confirm && orders.length && email.status !== "CONVERTED"
    ? await confirmationRecipient(companyId, email)
    : null;
  const channel = recipient
    ? await prisma.companyIntakeChannel.findUnique({ where: { companyId }, select: { orderMailboxAddress: true } })
    : null;

  const jobId = await prisma.$transaction(async (tx) => {
    let job: string | null = null;
    if (recipient) {
      const { trackingLinksForConfirmation } = await import("@/domains/public-order/public-order.service");
      const linkIds = await trackingLinksForConfirmation(tx, companyId, orders.map((order) => order.id), recipient);
      if (linkIds.length) {
        const queued = await enqueueOperationJob(tx, {
          jobKey: `inbound-confirmation:${id}`,
          type: "CLIENT_NOTIFICATION",
          companyId,
          payload: { kind: "INBOUND_ORDER_CONFIRMATION", linkIds, replyTo: channel?.orderMailboxAddress ?? null },
        });
        job = queued.id;
      }
    }
    await tx.inboundOrderEmail.updateMany({
      where: { id, companyId },
      data: { status: input.status, orderId, bodyText: "", draft: Prisma.DbNull, subject: "", analysisError: null, originalSender: null },
    });
    return job;
  });
  if (jobId) kickOperationJob(jobId);
  return { closed: true as const, confirmation: recipient && jobId ? recipient : null };
}
