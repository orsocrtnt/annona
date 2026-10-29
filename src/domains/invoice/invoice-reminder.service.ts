import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { enqueueOperationJob, kickOperationJob, permanentJobError } from "@/domains/operations/operation-job.service";
import { getClientSettings } from "@/domains/client-portal/settings.service";
import { emailSendOutcome, isIdempotentReplaySafe, sendTransactionalEmail } from "@/lib/email/transactional-email";
import { invoiceDaysOverdue, isInvoiceOutstanding } from "@/domains/invoice/invoice-due";

/**
 * Relance d'une facture de livraison (DEMO-3).
 * - Trace systématique : qui, quand, canal (EMAIL), résultat.
 * - Anti-doublon : une seule relance envoyée (ou en cours d'envoi) par facture
 *   sur 24 heures ; un nouveau clic dans ce délai rejoue la relance existante.
 *   Une tentative non envoyée (e-mail non configuré, pas de destinataire) ou
 *   dont l'envoi a définitivement échoué ne bloque pas une nouvelle relance.
 * - L'e-mail part par une tâche durable CLIENT_NOTIFICATION (reprise par le cron).
 * - Réservation d'envoi par facture (C1) : sous le verrou consultatif de la facture, une relance
 *   passe SENDING avant l'envoi ; aucune autre relance de la facture ne peut alors être créée ni
 *   envoyée. L'e-mail part hors transaction, puis la relance passe SENT.
 * - Issues d'envoi (C4, C5) — invariant : QUEUED ⇒ aucune tentative n'a pu être acceptée.
 *   · refus certain d'une première tentative (réservée depuis QUEUED) : retour à QUEUED (rejeu,
 *     même clé ; FAILED quand la tâche est épuisée) ;
 *   · issue inconnue (expiration, réseau, 5xx, 409 concurrent), ou refus certain d'une reprise
 *     (une tentative antérieure a pu partir) : la relance reste SENDING ; reprise par la tâche
 *     après expiration de la réservation, même clé et même contenu ;
 *   · non confirmée (409 `invalid_idempotent_request`, fenêtre de 23 h dépassée pour une reprise,
 *     ou reprise devenue sans objet) : SEND_UNCONFIRMED, terminal, tâche FAILED avec un `lastError`
 *     explicite ; aucun renvoi automatique, l'administrateur décide.
 *   Pendant SENDING, `completedAt` porte l'heure de la réservation (pas de migration).
 * - Contenu stable par clé : le texte est calculé à la date de création de la relance, jamais à
 *   l'heure de l'envoi, pour qu'une reprise (6 min ou le lendemain) envoie le même contenu.
 */
export const INVOICE_REMINDER_COOLDOWN_HOURS = 24;
const COOLDOWN_MS = INVOICE_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
/**
 * Une réservation SENDING orpheline (processus arrêté pendant l'envoi) peut être reprise par la
 * tâche de la même relance après 5 minutes : c'est le bail des tâches durables (une tâche bloquée
 * est reprise au même moment), bien au-delà du délai d'envoi (10 s), et très en deçà de la fenêtre
 * d'idempotence du fournisseur (24 h). La reprise réutilise la clé d'idempotence de la relance :
 * un e-mail déjà accepté par le fournisseur n'est pas renvoyé.
 */
export const INVOICE_REMINDER_SENDING_TTL_MINUTES = 5;
const SENDING_TTL_MS = INVOICE_REMINDER_SENDING_TTL_MINUTES * 60 * 1000;

export type InvoiceReminderResult =
  | "QUEUED"
  | "SENDING"
  | "SENT"
  | "NOT_SENT_EMAIL_NOT_CONFIGURED"
  | "NOT_SENT_NO_RECIPIENT"
  | "NOT_SENT_CLIENT_PREFERENCES"
  | "NOT_SENT_INVOICE_SETTLED"
  | "SKIPPED_SUPERSEDED"
  | "SEND_UNCONFIRMED";

/** Une relance non confirmée a peut-être été reçue : elle bloque comme une relance envoyée. */
const BLOCKING_RESULTS: InvoiceReminderResult[] = ["QUEUED", "SENT", "SEND_UNCONFIRMED"];

type ReminderState = { result: string; createdAt: Date; completedAt?: Date | null; operationJob?: { status: string } | null };

/**
 * Résultat affiché :
 * - QUEUED dont la tâche a définitivement échoué : FAILED (rien n'est parti, c'est certain) ;
 * - SENDING dont la tâche a définitivement échoué, ou réservée depuis plus de 24 h sans reprise :
 *   SEND_UNCONFIRMED (l'e-mail est peut-être parti, plus aucune reprise automatique en cours).
 */
export function effectiveReminderResult(reminder: ReminderState, now: Date = new Date()): string {
  if (reminder.result === "QUEUED" && reminder.operationJob?.status === "FAILED") return "FAILED";
  if (reminder.result === "SENDING") {
    const reservedAt = (reminder.completedAt ?? reminder.createdAt).getTime();
    if (reminder.operationJob?.status === "FAILED" || reservedAt < now.getTime() - COOLDOWN_MS) return "SEND_UNCONFIRMED";
  }
  return reminder.result;
}

/** Vrai si cette relance interdit d'en envoyer une nouvelle maintenant (délai anti-doublon). */
export function reminderBlocksNewOne(reminder: ReminderState, now: Date): boolean {
  // Réservée : l'e-mail est peut-être parti ; bloque 24 h à partir de la réservation.
  if (reminder.result === "SENDING") {
    return (reminder.completedAt ?? reminder.createdAt).getTime() >= now.getTime() - COOLDOWN_MS;
  }
  return (BLOCKING_RESULTS as string[]).includes(effectiveReminderResult(reminder))
    && reminder.createdAt.getTime() >= now.getTime() - COOLDOWN_MS;
}

type ReminderDatabase = Pick<PrismaClient, "$transaction">;

/** Verrou consultatif de la facture, partagé par la création et la réservation d'envoi. */
async function lockInvoiceReminders(tx: Pick<Prisma.TransactionClient, "$queryRaw">, invoiceId: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended('invoice-reminder:' || ${invoiceId}::text, 0))`;
}

/** Clé d'idempotence fournisseur : une par relance, identique à chaque reprise. */
export function invoiceReminderIdempotencyKey(reminderId: string) {
  return `client-notification:invoice-reminder:${reminderId}`;
}
type ReminderTx = Pick<Prisma.TransactionClient, "invoice" | "invoiceReminder" | "operationJob" | "$queryRaw">;

export type InvoiceReminderView = {
  id: string;
  channel: string;
  result: string;
  createdAt: Date;
};

/** Vue renvoyée à la route : ni auteur ni tâche (identifiants internes). */
function view(row: InvoiceReminderView): InvoiceReminderView {
  return { id: row.id, channel: row.channel, result: row.result, createdAt: row.createdAt };
}

function hasUsableEmail(customer: { email: string; companyId: string | null } | null, companyId: string) {
  return Boolean(customer && customer.companyId === companyId && customer.email.trim());
}

export async function remindInvoice(
  input: { companyId: string; invoiceId: string; userId: string; emailConfigured: boolean; now?: Date },
  deps: { db?: ReminderDatabase; kick?: (jobId: string) => void } = {}
): Promise<{ reminder: InvoiceReminderView; duplicate: boolean } | null> {
  const db = deps.db ?? prisma;
  const now = input.now ?? new Date();

  const outcome = await db.$transaction(async (transaction) => {
    const tx = transaction as unknown as ReminderTx;
    // Verrou de la facture : deux clics simultanés sont sérialisés.
    await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${input.invoiceId} AND company_id = ${input.companyId} FOR UPDATE`;
    // Même verrou que la réservation d'envoi : un clic ne peut pas se glisser pendant un envoi.
    await lockInvoiceReminders(tx, input.invoiceId);
    const invoice = await tx.invoice.findFirst({
      where: { id: input.invoiceId, companyId: input.companyId },
      select: { id: true, status: true, customer: { select: { email: true, companyId: true } } },
    });
    if (!invoice) return null;
    if (!isInvoiceOutstanding(invoice.status)) throw new Error("INVOICE_NOT_REMINDABLE");

    // Une relance réservée (SENDING) refuse toute nouvelle relance, même créée il y a plus de 24 h.
    const sending = await tx.invoiceReminder.findFirst({
      where: {
        invoiceId: invoice.id,
        companyId: input.companyId,
        result: "SENDING",
        completedAt: { gte: new Date(now.getTime() - COOLDOWN_MS) },
      },
      orderBy: { createdAt: "desc" },
    });
    if (sending) return { reminder: view(sending), duplicate: true, jobId: null };

    const recent = await tx.invoiceReminder.findFirst({
      where: {
        invoiceId: invoice.id,
        companyId: input.companyId,
        result: { in: BLOCKING_RESULTS },
        createdAt: { gte: new Date(now.getTime() - COOLDOWN_MS) },
      },
      orderBy: { createdAt: "desc" },
      include: { operationJob: { select: { status: true } } },
    });
    if (recent && reminderBlocksNewOne(recent, now)) {
      return { reminder: view(recent), duplicate: true, jobId: null };
    }

    const result: InvoiceReminderResult = !input.emailConfigured
      ? "NOT_SENT_EMAIL_NOT_CONFIGURED"
      : hasUsableEmail(invoice.customer, input.companyId)
        ? "QUEUED"
        : "NOT_SENT_NO_RECIPIENT";
    if (result !== "QUEUED") {
      // Même tentative non envoyée dans le délai : rejouée, pas de nouvelle trace (pas de croissance par clics).
      const sameAttempt = await tx.invoiceReminder.findFirst({
        where: {
          invoiceId: invoice.id,
          companyId: input.companyId,
          result,
          createdAt: { gte: new Date(now.getTime() - COOLDOWN_MS) },
        },
        orderBy: { createdAt: "desc" },
      });
      if (sameAttempt) return { reminder: view(sameAttempt), duplicate: true, jobId: null };
    }
    const reminder = await tx.invoiceReminder.create({
      data: {
        invoiceId: invoice.id,
        companyId: input.companyId,
        sentById: input.userId,
        channel: "EMAIL",
        result,
        completedAt: result === "QUEUED" ? null : now,
      },
    });
    if (result !== "QUEUED") return { reminder: view(reminder), duplicate: false, jobId: null };

    const job = await enqueueOperationJob(tx, {
      jobKey: invoiceReminderIdempotencyKey(reminder.id),
      type: "CLIENT_NOTIFICATION",
      companyId: input.companyId,
      payload: { kind: "INVOICE_REMINDER", reminderId: reminder.id, companyId: input.companyId },
    });
    await tx.invoiceReminder.update({ where: { id: reminder.id }, data: { operationJobId: job.id } });
    return { reminder: view(reminder), duplicate: false, jobId: job.id };
  }, { maxWait: 10_000, timeout: 30_000 });

  if (!outcome) return null;
  if (outcome.jobId) (deps.kick ?? kickOperationJob)(outcome.jobId);
  return { reminder: outcome.reminder, duplicate: outcome.duplicate };
}

type DeliveryDatabase = Pick<PrismaClient, "invoiceReminder" | "$transaction">;
type DeliveryTx = Pick<Prisma.TransactionClient, "invoiceReminder" | "$queryRaw">;

const REMINDER_INVOICE_SELECT = {
  id: true,
  reference: true,
  status: true,
  amount: true,
  dueDate: true,
  companyId: true,
  customerId: true,
  customer: { select: { email: true, companyId: true } },
  company: { select: { name: true } },
} satisfies Prisma.InvoiceSelect;

type DeliveryDeps = {
  db?: DeliveryDatabase;
  now?: Date;
  appUrl?: string;
  getClientSettings?: typeof getClientSettings;
  send?: (input: { to: string; subject: string; text: string; idempotencyKey: string; replayWindowStart: Date | null }) => Promise<{ status: string }>;
};

const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

function readPayload(payload: Prisma.JsonValue) {
  const value = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const reminderId = typeof value.reminderId === "string" ? value.reminderId : null;
  const companyId = typeof value.companyId === "string" ? value.companyId : null;
  if (!reminderId || !companyId) throw new Error("INVOICE_REMINDER_PAYLOAD_INVALID");
  return { reminderId, companyId };
}

function reminderText(input: {
  reference: string;
  companyName: string;
  amount: number;
  dueDate: Date | null;
  daysOverdue: number;
  link: string | null;
}) {
  const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(input.amount);
  const due = input.dueDate
    ? `, échue le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" }).format(input.dueDate)}`
    : "";
  const late = input.daysOverdue > 0
    ? ` (en retard de ${input.daysOverdue} jour${input.daysOverdue > 1 ? "s" : ""})`
    : "";
  return [
    "Bonjour,",
    "",
    `Sauf erreur de notre part, la facture ${input.reference} de ${input.companyName}, d'un montant de ${amount}${due}, reste à régler${late}.`,
    ...(input.link ? ["", `Consultez-la dans votre espace client : ${input.link}`] : []),
    "",
    "Si votre règlement est déjà parti, merci de ne pas tenir compte de ce message.",
  ].join("\n");
}

/** Exécutée par la tâche durable : relit tout en base, n'envoie qu'une fois. */
export async function deliverInvoiceReminderJob(
  rawPayload: Prisma.JsonValue,
  _eventKey: string,
  deps: DeliveryDeps = {}
) {
  const { reminderId, companyId } = readPayload(rawPayload);
  const db = deps.db ?? prisma;
  const now = deps.now ?? new Date();
  const found = await db.invoiceReminder.findFirst({
    where: { id: reminderId, companyId },
    select: { id: true, invoiceId: true, result: true, invoice: { select: { companyId: true, customerId: true } } },
  });
  // Relance supprimée, d'une autre entreprise, ou déjà traitée : rien à faire (rejeu idempotent).
  if (!found || found.invoice.companyId !== companyId) return;
  if (found.result !== "QUEUED" && found.result !== "SENDING") return;
  // Préférences lues avant le verrou (aucune écriture) ; appliquées après les contrôles de la facture.
  const settings = found.invoice.customerId
    ? await (deps.getClientSettings ?? getClientSettings)(found.invoice.customerId)
    : null;

  // Réservation courte sous le verrou de la facture : contrôles puis passage en SENDING.
  const reservation = await db.$transaction(async (transaction) => {
    const tx = transaction as unknown as DeliveryTx;
    await lockInvoiceReminders(tx, found.invoiceId);
    const reminder = await tx.invoiceReminder.findFirst({
      where: { id: reminderId, companyId },
      include: { invoice: { select: REMINDER_INVOICE_SELECT } },
    });
    if (!reminder || reminder.invoice.companyId !== companyId) return null;
    // Reprise : une tentative précédente (issue inconnue ou processus arrêté) a peut-être été acceptée.
    const resuming = reminder.result === "SENDING";
    if (resuming) {
      const reservedAt = reminder.completedAt ?? reminder.createdAt;
      // Une autre exécution envoie peut-être en ce moment : la tâche réessaiera plus tard.
      if (reservedAt.getTime() > now.getTime() - SENDING_TTL_MS) throw new Error("INVOICE_REMINDER_SEND_IN_PROGRESS");
      // Réservation orpheline expirée : reprise avec la même clé d'idempotence et le même contenu.
    } else if (reminder.result !== "QUEUED") {
      return null; // Déjà traitée : rejeu idempotent.
    }
    const claim = { id: reminder.id, result: reminder.result, completedAt: reminder.completedAt };
    // Une reprise qui s'arrête ne peut pas affirmer « non envoyée » : elle devient non confirmée.
    const finish = async (result: InvoiceReminderResult) => {
      const updated = await tx.invoiceReminder.updateMany({
        where: claim,
        data: { result: resuming ? "SEND_UNCONFIRMED" : result, completedAt: now },
      });
      return resuming && updated.count === 1 ? { unconfirmed: result } : null;
    };

    // Fenêtre de déduplication du fournisseur : la première tentative a eu lieu après la création
    // de la relance, une reprise avant création + 23 h est donc encore dédupliquée. Au-delà, jamais
    // de renvoi automatique.
    if (resuming && !isIdempotentReplaySafe(reminder.createdAt, now)) return finish("SEND_UNCONFIRMED");

    // Tâche relancée tard (ex. reprise des tâches en échec) : jamais un second e-mail si une
    // relance plus récente existe, ou si une autre est réservée ou partie dans les 24 h.
    const superseding = await tx.invoiceReminder.findFirst({
      where: {
        invoiceId: reminder.invoiceId,
        companyId,
        id: { not: reminder.id },
        OR: [
          { createdAt: { gt: reminder.createdAt } },
          { result: { in: ["SENDING", "SENT", "SEND_UNCONFIRMED"] }, completedAt: { gte: new Date(now.getTime() - COOLDOWN_MS) } },
        ],
      },
      select: { id: true },
    });
    if (superseding) return finish("SKIPPED_SUPERSEDED");

    const invoice = reminder.invoice;
    if (!isInvoiceOutstanding(invoice.status)) return finish("NOT_SENT_INVOICE_SETTLED");
    if (!invoice.customerId || !hasUsableEmail(invoice.customer, companyId)) return finish("NOT_SENT_NO_RECIPIENT");
    if (!settings?.invoiceAlerts || !settings.emailNotifications) return finish("NOT_SENT_CLIENT_PREFERENCES");

    const reserved = await tx.invoiceReminder.updateMany({ where: claim, data: { result: "SENDING", completedAt: now } });
    if (reserved.count !== 1) return null;
    return { reminderId: reminder.id, invoice, reservedAt: now, resuming, createdAt: reminder.createdAt };
  }, { maxWait: 10_000, timeout: 30_000 });
  if (!reservation) return;
  if ("unconfirmed" in reservation) {
    // Terminal et visible : la tâche passe en échec avec la cause, sans nouvel essai.
    throw permanentJobError(`INVOICE_REMINDER_SEND_UNCONFIRMED:${reservation.unconfirmed}`);
  }

  // Envoi hors transaction ; la relance quitte SENDING seulement si la réservation est toujours la sienne.
  const held = { id: reservation.reminderId, result: "SENDING", completedAt: reservation.reservedAt };
  const { invoice } = reservation;
  const appUrl = (deps.appUrl ?? process.env.NEXT_PUBLIC_APP_URL)?.replace(/\/+$/, "");
  const reference = oneLine(invoice.reference);
  let sent: { status: string };
  try {
    sent = await (deps.send ?? sendTransactionalEmail)({
      to: invoice.customer!.email,
      subject: `Rappel : facture ${reference}`,
      text: reminderText({
        reference,
        companyName: oneLine(invoice.company.name),
        amount: Number(invoice.amount),
        dueDate: invoice.dueDate,
        // Gelé à la création de la relance : même contenu à chaque reprise sous la même clé.
        daysOverdue: invoiceDaysOverdue(invoice.dueDate, reservation.createdAt),
        link: appUrl ? `${appUrl}/portal/invoices/${invoice.id}` : null,
      }),
      idempotencyKey: invoiceReminderIdempotencyKey(reservation.reminderId),
      // Première tentative : aucune tentative antérieure n'a pu être acceptée (invariant QUEUED).
      replayWindowStart: reservation.resuming ? reservation.createdAt : null,
    });
  } catch (error) {
    const outcome = emailSendOutcome(error);
    if (outcome === "rejected" && !reservation.resuming) {
      // Refus certain d'une première tentative : rien n'est parti, la réservation est rendue.
      await db.invoiceReminder.updateMany({ where: held, data: { result: "QUEUED", completedAt: null } });
    } else if (outcome === "unconfirmed") {
      // Clé déjà utilisée avec un autre contenu, ou fenêtre dépassée : terminal, jamais de renvoi.
      await db.invoiceReminder.updateMany({ where: held, data: { result: "SEND_UNCONFIRMED", completedAt: now } });
    }
    // Sinon (issue inconnue, ou refus d'une reprise) : SENDING gardé, « Relancer » refuse, la tâche
    // reprendra avec la même clé et le même contenu après expiration de la réservation.
    throw error;
  }
  if (sent.status === "disabled" && reservation.resuming) {
    // E-mail désactivé entre deux tentatives : la première a peut-être été acceptée.
    await db.invoiceReminder.updateMany({ where: held, data: { result: "SEND_UNCONFIRMED", completedAt: now } });
    throw permanentJobError("INVOICE_REMINDER_SEND_UNCONFIRMED:EMAIL_DISABLED");
  }
  await db.invoiceReminder.updateMany({
    where: held,
    data: { result: sent.status === "disabled" ? "NOT_SENT_EMAIL_NOT_CONFIGURED" : "SENT", completedAt: now },
  });
}
