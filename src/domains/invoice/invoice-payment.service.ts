/**
 * FACT-1 — règlements (RG-07, ADM-10). Le paiement se fait hors application : l'administrateur
 * enregistre chaque règlement reçu (montant, date, mode VIREMENT / PRELEVEMENT / ESPECES, référence).
 *
 * Statut de règlement calculé (jamais saisi) : à régler (rien reçu), partiellement réglée, réglée
 * (reçu ≥ total TTC). La facture passe en PAID au règlement complet (date et mode du dernier
 * règlement) ; la suppression d'un règlement saisi par erreur la ramène « à régler » (PENDING, le
 * retard est recalculé à la lecture). Un règlement au-delà du reste dû est refusé.
 *
 * Écritures sérialisées par facture (`FOR UPDATE`) : deux saisies simultanées ne peuvent pas dépasser
 * le total. Chaque écriture est journalisée (AuditLog, entité Invoice).
 */
import type { InvoiceStatus, PaymentMethod, Prisma } from "@prisma/client";
import { todayKey } from "@/domains/invoice/billing-period";
import { INVOICE_AUDIT_ENTITY } from "@/domains/invoice/invoice-email-keys";
import { settlementStatus } from "@/domains/invoice/invoice-settlement";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { fr } from "@/lib/i18n/fr";
import { prisma } from "@/services/prisma/client";

const t = fr.invoices.errors;

export { settlementStatus, type SettlementStatus } from "@/domains/invoice/invoice-settlement";

type Tx = Pick<Prisma.TransactionClient, "invoice" | "payment" | "auditLog" | "$queryRaw">;
export type PaymentDb = { $transaction: <T>(fn: (tx: Tx) => Promise<T>, options?: { maxWait?: number; timeout?: number }) => Promise<T> };

export interface PaymentActor {
  companyId: string;
  userId: string;
}

export interface RecordPaymentInput {
  amountCents: number;
  method: PaymentMethod;
  /** Jour du règlement, « AAAA-MM-JJ ». */
  paidAt: string;
  reference?: string | null;
}

async function lockInvoice(tx: Tx, companyId: string, invoiceId: string) {
  await tx.$queryRaw`SELECT id FROM "invoices" WHERE id = ${invoiceId} AND company_id = ${companyId} FOR UPDATE`;
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, companyId },
    select: { id: true, status: true, totalCents: true, reference: true },
  });
  if (!invoice) throw new DomainRuleError(404, t.notFound, "INVOICE_NOT_FOUND");
  return invoice;
}

async function paidSoFar(tx: Tx, companyId: string, invoiceId: string) {
  const payments = await tx.payment.findMany({
    where: { companyId, invoiceId },
    select: { id: true, amountCents: true, method: true, paidAt: true },
  });
  return payments;
}

function statusAfter(current: InvoiceStatus, totalCents: number, paidCents: number): InvoiceStatus {
  if (paidCents >= totalCents) return "PAID";
  // Plus réglée en totalité : de nouveau à régler ; le retard se recalcule à la lecture et par le cron.
  return current === "PAID" ? "PENDING" : current;
}

export async function recordPayment(actor: PaymentActor, invoiceId: string, input: RecordPaymentInput, now = new Date(), db: PaymentDb = prisma as unknown as PaymentDb) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new DomainRuleError(400, t.amountInvalid, "PAYMENT_AMOUNT_INVALID");
  const paidAt = new Date(`${input.paidAt}T12:00:00.000Z`);
  if (Number.isNaN(paidAt.getTime())) throw new DomainRuleError(400, t.dateInvalid, "PAYMENT_DATE_INVALID");
  // Pas de règlement daté d'après aujourd'hui (jour lu à Paris).
  if (input.paidAt > todayKey(now, "Europe/Paris")) throw new DomainRuleError(400, t.dateInFuture, "PAYMENT_DATE_IN_FUTURE");

  return db.$transaction(async (tx) => {
    const invoice = await lockInvoice(tx, actor.companyId, invoiceId);
    if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") throw new DomainRuleError(409, t.notPayable, "INVOICE_NOT_PAYABLE");
    const payments = await paidSoFar(tx, actor.companyId, invoiceId);
    const paidCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const remaining = invoice.totalCents - paidCents;
    if (remaining <= 0) throw new DomainRuleError(409, t.alreadyPaid, "INVOICE_ALREADY_PAID");
    if (input.amountCents > remaining) throw new DomainRuleError(400, t.amountAboveRemaining(remaining), "PAYMENT_ABOVE_REMAINING");

    const payment = await tx.payment.create({
      data: {
        companyId: actor.companyId,
        invoiceId,
        amountCents: input.amountCents,
        method: input.method,
        paidAt,
        note: input.reference?.trim() || null,
        recordedById: actor.userId,
      },
      select: { id: true },
    });
    const newPaid = paidCents + input.amountCents;
    const status = statusAfter(invoice.status, invoice.totalCents, newPaid);
    await tx.invoice.update({
      where: { id: invoiceId },
      data: status === "PAID" ? { status, paidAt, paymentMethod: input.method } : { status },
    });
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        actorId: actor.userId,
        entityType: INVOICE_AUDIT_ENTITY,
        entityId: invoiceId,
        action: "PAYMENT_RECORDED",
        before: { paidCents, status: invoice.status },
        after: { paymentId: payment.id, amountCents: input.amountCents, method: input.method, paidAt: input.paidAt, paidCents: newPaid, status },
      },
    });
    return { paymentId: payment.id, paidCents: newPaid, settlement: settlementStatus(invoice.totalCents, newPaid), status };
  }, { maxWait: 10_000, timeout: 30_000 });
}

/** Suppression d'un règlement saisi par erreur (journalisée) ; le statut est recalculé. */
export async function deletePayment(actor: PaymentActor, invoiceId: string, paymentId: string, db: PaymentDb = prisma as unknown as PaymentDb) {
  return db.$transaction(async (tx) => {
    const invoice = await lockInvoice(tx, actor.companyId, invoiceId);
    const payments = await paidSoFar(tx, actor.companyId, invoiceId);
    const target = payments.find((payment) => payment.id === paymentId);
    if (!target) throw new DomainRuleError(404, t.paymentNotFound, "PAYMENT_NOT_FOUND");
    await tx.payment.delete({ where: { id: target.id } });
    const rest = payments.filter((payment) => payment.id !== paymentId);
    const paidCents = rest.reduce((sum, payment) => sum + payment.amountCents, 0);
    const status = statusAfter(invoice.status, invoice.totalCents, paidCents);
    const last = [...rest].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())[0];
    await tx.invoice.update({
      where: { id: invoiceId },
      data: status === "PAID" ? { status, paidAt: last?.paidAt ?? null, paymentMethod: last?.method ?? null } : { status, paidAt: null, paymentMethod: null },
    });
    await tx.auditLog.create({
      data: {
        companyId: actor.companyId,
        actorId: actor.userId,
        entityType: INVOICE_AUDIT_ENTITY,
        entityId: invoiceId,
        action: "PAYMENT_DELETED",
        before: { paymentId, amountCents: target.amountCents, method: target.method, status: invoice.status },
        after: { paidCents, status },
      },
    });
    return { paidCents, settlement: settlementStatus(invoice.totalCents, paidCents), status };
  }, { maxWait: 10_000, timeout: 30_000 });
}
