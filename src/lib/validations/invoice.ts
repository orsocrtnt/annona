import { z } from "zod";

/** FACT-1 — saisies des factures (ADM-10, RG-07) et du portail commerçant (CLI-10). */
const id = z.string().trim().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.");
const optionalId = id.nullish().transform((value) => value || null);
const optionalDate = date.nullish().or(z.literal("")).transform((value) => value || null);

export const billingPeriodSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
export const paymentMethodSchema = z.enum(["VIREMENT", "PRELEVEMENT", "ESPECES"]);

export const generateInvoicesSchema = z.object({ periodType: billingPeriodSchema, date, merchantId: optionalId }).strict();

export const adminInvoiceListQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
  merchantId: optionalId,
  status: z.enum(["TO_PAY", "PARTIAL", "PAID", "OVERDUE"]).nullish().or(z.literal("")).transform((value) => value || null),
});

export const recordPaymentSchema = z
  .object({
    /** Centimes : jamais de virgule flottante sur un montant. */
    amountCents: z.number().int().min(1).max(99_999_999),
    method: paymentMethodSchema,
    paidAt: date,
    reference: z.string().trim().max(120).nullish(),
  })
  .strict();

export const portalInvoiceQuerySchema = z.object({ periodType: billingPeriodSchema, date });

export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;
export type RecordPaymentBody = z.infer<typeof recordPaymentSchema>;
