/**
 * FACT-1 — envoi d'une facture par e-mail au commerçant, PDF en pièce jointe (ADM-10).
 *
 * L'envoi passe par une tâche durable (`OperationJob`, type CLIENT_NOTIFICATION, nature INVOICE_EMAIL),
 * créée à l'émission de la facture puis à chaque « Renvoyer ». Destinataire : l'adresse de facturation
 * du commerçant, sinon celle de son contact.
 *
 * Échec propre et relançable : sans service d'e-mail configuré (clé Resend absente, mode « disabled »),
 * ou sans destinataire, la tâche se termine « ignorée » avec la cause (`SKIPPED:INVOICE_EMAIL_DISABLED`,
 * `SKIPPED:INVOICE_EMAIL_NO_RECIPIENT`) : rien n'est envoyé, la fiche facture l'affiche et propose
 * « Renvoyer ». Une erreur du fournisseur suit les reprises habituelles des tâches (puis « échec »).
 * La clé de la tâche est la clé d'idempotence du fournisseur : une reprise n'envoie jamais deux fois.
 */
import type { Prisma } from "@prisma/client";
import { periodRangeLabel, dbDateKey } from "@/domains/invoice/billing-period";
import { invoiceEmailAttempt, invoiceEmailJobKey, invoiceEmailJobPrefix, INVOICE_EMAIL_KIND } from "@/domains/invoice/invoice-email-keys";
import { loadFacturXInvoice, renderClassicInvoicePdf } from "@/domains/invoice/facturx/facturx.service";
import { safeFilename } from "@/domains/invoice/facturx/facturx-document";
import { enqueueOperationJob, kickOperationJob, skippedJobError } from "@/domains/operations/operation-job.service";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import {
  getTransactionalEmailConfiguration,
  sendTransactionalEmail,
  type EmailContentFreezer,
  type ReplayWindowStart,
} from "@/lib/email/transactional-email";
import { prisma } from "@/services/prisma/client";

const t = fr.invoices;

/** « Renvoyer » : nouvelle tentative, sauf si une tentative est encore en cours (rejouée telle quelle). */
export async function requestInvoiceEmail(
  actor: { companyId: string },
  invoiceId: string,
  deps: { kick?: (jobId: string) => void } = {}
): Promise<{ attempt: number; alreadyPending: boolean }> {
  const outcome = await prisma.$transaction(async (tx) => {
    // Verrou de la facture : deux clics simultanés ne créent pas deux tentatives.
    await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${invoiceId} AND company_id = ${actor.companyId} FOR UPDATE`;
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, companyId: actor.companyId }, select: { id: true, status: true } });
    if (!invoice) throw new DomainRuleError(404, t.errors.notFound, "INVOICE_NOT_FOUND");
    if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") throw new DomainRuleError(409, t.errors.notSendable, "INVOICE_NOT_SENDABLE");
    const jobs = await tx.operationJob.findMany({
      where: { companyId: actor.companyId, jobKey: { startsWith: invoiceEmailJobPrefix(invoiceId) } },
      select: { id: true, jobKey: true, status: true },
    });
    const latest = jobs.sort((a, b) => invoiceEmailAttempt(b.jobKey) - invoiceEmailAttempt(a.jobKey))[0];
    if (latest && (latest.status === "PENDING" || latest.status === "PROCESSING")) {
      return { attempt: invoiceEmailAttempt(latest.jobKey), alreadyPending: true, jobId: latest.id };
    }
    const attempt = (latest ? invoiceEmailAttempt(latest.jobKey) : 0) + 1;
    const job = await enqueueOperationJob(tx, {
      jobKey: invoiceEmailJobKey(invoiceId, attempt),
      type: "CLIENT_NOTIFICATION",
      companyId: actor.companyId,
      payload: { kind: INVOICE_EMAIL_KIND, invoiceId, companyId: actor.companyId },
    });
    return { attempt, alreadyPending: false, jobId: job.id };
  }, { maxWait: 10_000, timeout: 30_000 });
  (deps.kick ?? kickOperationJob)(outcome.jobId);
  return { attempt: outcome.attempt, alreadyPending: outcome.alreadyPending };
}

function readPayload(payload: Prisma.JsonValue) {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const invoiceId = typeof value.invoiceId === "string" ? value.invoiceId : null;
  const companyId = typeof value.companyId === "string" ? value.companyId : null;
  if (!invoiceId || !companyId) throw Object.assign(new Error("INVOICE_EMAIL_PAYLOAD_INVALID"), { permanent: true });
  return { invoiceId, companyId };
}

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const longDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });

/** Texte de l'e-mail (sans donnée d'un autre commerçant) ; le PDF porte le détail et les mentions. */
export function invoiceEmailText(input: {
  reference: string;
  companyName: string;
  periodSentence: string;
  totalCents: number;
  dueDate: Date | null;
  link: string | null;
}) {
  return [
    "Bonjour,",
    "",
    `Veuillez trouver ci-joint la facture ${input.reference} de ${input.companyName} pour vos livraisons ${input.periodSentence}, d'un montant de ${euros.format(input.totalCents / 100)} TTC${input.dueDate ? `, à régler avant le ${longDate.format(input.dueDate)}` : ""}.`,
    ...(input.link ? ["", `Vous la retrouvez aussi dans votre espace client : ${input.link}`] : []),
    "",
    "Merci pour votre confiance.",
  ].join("\n");
}

/** Exécutée par la tâche durable : relit tout en base, rend le PDF et envoie une fois. */
export async function deliverInvoiceEmailJob(
  rawPayload: Prisma.JsonValue,
  jobKey: string,
  options: { replayWindowStart: ReplayWindowStart; freezeContent?: EmailContentFreezer; appUrl?: string }
) {
  const { invoiceId, companyId } = readPayload(rawPayload);
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: {
      reference: true,
      status: true,
      totalCents: true,
      dueDate: true,
      periodStart: true,
      periodEnd: true,
      company: { select: { name: true, legalName: true, email: true } },
      merchant: { select: { billingEmail: true, contactEmail: true } },
    },
  });
  // Facture supprimée ou d'une autre entreprise : rien à envoyer.
  if (!invoice) throw skippedJobError("INVOICE_EMAIL_NOT_FOUND");
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") throw skippedJobError("INVOICE_EMAIL_NOT_SENDABLE");
  const to = (invoice.merchant.billingEmail ?? invoice.merchant.contactEmail ?? "").trim();
  if (!to) throw skippedJobError("INVOICE_EMAIL_NO_RECIPIENT");
  const configuration = getTransactionalEmailConfiguration();
  // E-mail non configuré (local, clé absente) : échec propre, rien n'est parti, « Renvoyer » reste possible.
  if (!configuration.enabled) throw skippedJobError(`INVOICE_EMAIL_DISABLED:${configuration.reason}`);

  const loaded = await loadFacturXInvoice({ invoiceId, companyId });
  if (!loaded) throw skippedJobError("INVOICE_EMAIL_NOT_FOUND");
  const pdf = await renderClassicInvoicePdf(loaded);
  const companyName = oneLine(invoice.company.legalName || invoice.company.name);
  const appUrl = (options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL)?.replace(/\/+$/, "");
  const sent = await sendTransactionalEmail({
    to,
    subject: t.emailSubject(oneLine(invoice.reference), companyName),
    text: invoiceEmailText({
      reference: oneLine(invoice.reference),
      companyName,
      periodSentence: periodRangeLabel({ start: dbDateKey(invoice.periodStart), end: dbDateKey(invoice.periodEnd) }),
      totalCents: invoice.totalCents,
      dueDate: invoice.dueDate,
      link: appUrl ? `${appUrl}/portal/invoices` : null,
    }),
    replyTo: invoice.company.email,
    senderName: companyName,
    idempotencyKey: jobKey,
    replayWindowStart: options.replayWindowStart,
    freezeContent: options.freezeContent,
    attachments: [{ filename: `${safeFilename(invoice.reference)}.pdf`, content: Buffer.from(pdf).toString("base64") }],
  });
  // Configuration retirée entre le contrôle et l'envoi : même issue propre.
  if (sent.status === "disabled") throw skippedJobError("INVOICE_EMAIL_DISABLED");
}
