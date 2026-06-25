import { z } from "zod";

export const invoiceLineItemSchema = z.object({
  label: z.string().min(1),
  amount: z.number().min(0),
  quantity: z.number().int().min(1).default(1),
  sourceType: z.enum(["ZONE", "FEE", "PURCHASE", "CUSTOM", "VAT"]),
  sourceId: z.string().optional(),
});

export const createOrderInvoiceSchema = z.object({
  zoneId: z.string().optional(),
  feeIds: z.array(z.string()).default([]),
  includePurchases: z.boolean().default(false),
  customLines: z
    .array(
      z.object({
        label: z.string().min(1),
        amount: z.number().min(0),
      })
    )
    .default([]),
  notes: z.string().optional(),
  dueDate: z.string().datetime().optional(),
});

export type InvoiceLineItem = z.infer<typeof invoiceLineItemSchema>;
export type CreateOrderInvoiceInput = z.infer<typeof createOrderInvoiceSchema>;
