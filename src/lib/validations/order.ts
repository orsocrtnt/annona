import { z } from "zod";

/**
 * Saisies du portail client (CMD-1 : CLI-04, CLI-05, CLI-08, CLI-09, RG-08). La date est un jour civil
 * « AAAA-MM-JJ » ; le créneau est toujours un identifiant de la liste, jamais une heure libre (RG-08).
 */
export const MAX_LINE_QUANTITY = 9999;
export const MAX_ORDER_LINES = 300;

const id = z.string().trim().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date de livraison invalide.");

export const orderLineSchema = z
  .object({
    productId: id,
    quantity: z.number().int("Quantité entière.").min(1, "Quantité minimale : 1.").max(MAX_LINE_QUANTITY, "Quantité maximale : 9 999."),
  })
  .strict();

export const saveOrderSchema = z
  .object({
    deliveryDate: date,
    slotId: id,
    lines: z.array(orderLineSchema).min(1, "Ajoutez au moins un produit.").max(MAX_ORDER_LINES),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const reorderSchema = z.object({ deliveryDate: date, slotId: id }).strict();

export const orderLookupSchema = z.object({ date, slotId: id });

export const recurringOrderSchema = z
  .object({
    label: z.string().trim().max(80).nullable().optional(),
    slotId: id,
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Choisissez au moins un jour.").max(7),
    lines: z.array(orderLineSchema).min(1, "Ajoutez au moins un produit.").max(MAX_ORDER_LINES),
    active: z.boolean().optional(),
  })
  .strict();

export const updateRecurringOrderSchema = recurringOrderSchema.partial().strict();

export type OrderLineInput = z.infer<typeof orderLineSchema>;
export type SaveOrderInput = z.infer<typeof saveOrderSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type RecurringOrderInput = z.infer<typeof recurringOrderSchema>;
export type UpdateRecurringOrderInput = z.infer<typeof updateRecurringOrderSchema>;
