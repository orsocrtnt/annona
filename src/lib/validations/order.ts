import { z } from "zod";

const numericField = (min: number, message: string) =>
  z.union([z.number(), z.string()]).transform((v) => Number(v)).pipe(
    z.number().refine((n) => !Number.isNaN(n) && n >= min, message)
  );

const optionalEstimatedPrice = z
  .union([z.number(), z.string(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  })
  .refine((v) => v === undefined || v >= 0, "Prix estimé invalide");

export const orderItemSchema = z.object({
  name: z.string().min(1, "Nom de l'article requis"),
  quantity: numericField(1, "Quantité minimale : 1"),
  estimatedPrice: optionalEstimatedPrice,
});

/** Ligne article en saisie — autorise le nom vide (filtré avant enregistrement). */
const draftOrderItemSchema = z.object({
  name: z.string().default(""),
  quantity: numericField(1, "Quantité minimale : 1"),
  estimatedPrice: optionalEstimatedPrice,
});

function filterNamedItems<T extends { name: string }>(items: T[]) {
  return items.filter((item) => item.name.trim().length > 0);
}

const addressField = (label: string) => z.string().min(5, `${label} requise`);
const cityField = (label: string) => z.string().min(2, `${label} requise`);
const postalField = (label: string) => z.string().min(4, `${label} requis`);

export const orderStopSchema = z.object({
  label: z.string().optional(),
  address: addressField("Adresse"),
  city: cityField("Ville"),
  postalCode: postalField("Code postal"),
  instructions: z.string().optional(),
});

/** Adresse mission spéciale — champs souples en saisie, contrôlés dans superRefine. */
const draftOrderStopSchema = z.object({
  label: z.string().optional(),
  address: z.string().default(""),
  city: z.string().default(""),
  postalCode: z.string().default(""),
  instructions: z.string().optional(),
});

/** Collecte course — champs souples en saisie, contrôlés dans superRefine (COURIER). */
export const pickupStopSchema = z.object({
  label: z.string().optional(),
  address: z.string().default(""),
  city: z.string().default(""),
  postalCode: z.string().default(""),
  instructions: z.string().optional(),
  items: z.array(draftOrderItemSchema).default([]),
});

export const createClientOrderSchema = z
  .object({
    deliveryCategory: z
      .enum(["STANDARD", "COURIER", "SPECIAL_MISSION"])
      .default("STANDARD"),
    items: z.array(draftOrderItemSchema).default([]),
    missionDescription: z.string().optional(),
    stops: z.array(draftOrderStopSchema).optional(),
    pickupStops: z.array(pickupStopSchema).optional(),
    pickupAddress: z.string().optional(),
    pickupCity: z.string().optional(),
    pickupPostalCode: z.string().optional(),
    pickupInstructions: z.string().optional(),
    shippingAddress: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingPostalCode: z.string().optional(),
    deliveryInstructions: z.string().optional(),
    requestedDeliveryDate: z.string().optional(),
    notes: z.string().optional(),
    saveAddress: z.boolean().optional(),
    addressLabel: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryCategory === "SPECIAL_MISSION") {
      if (!data.missionDescription || data.missionDescription.trim().length < 20) {
        ctx.addIssue({
          code: "custom",
          message: "Décrivez votre besoin (minimum 20 caractères)",
          path: ["missionDescription"],
        });
      }
      if (!data.stops || data.stops.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Ajoutez au moins une adresse",
          path: ["stops"],
        });
      }
      (data.stops ?? []).forEach((stop, index) => {
        if (!stop.address || stop.address.trim().length < 5) {
          ctx.addIssue({
            code: "custom",
            message: "Adresse requise",
            path: ["stops", index, "address"],
          });
        }
        if (!stop.city || stop.city.trim().length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Ville requise",
            path: ["stops", index, "city"],
          });
        }
        if (!stop.postalCode || stop.postalCode.trim().length < 4) {
          ctx.addIssue({
            code: "custom",
            message: "Code postal requis",
            path: ["stops", index, "postalCode"],
          });
        }
      });
      return;
    }

    if (!data.shippingAddress || data.shippingAddress.length < 5) {
      ctx.addIssue({
        code: "custom",
        message: "Adresse de livraison requise",
        path: ["shippingAddress"],
      });
    }
    if (!data.shippingCity || data.shippingCity.length < 2) {
      ctx.addIssue({
        code: "custom",
        message: "Ville de livraison requise",
        path: ["shippingCity"],
      });
    }
    if (!data.shippingPostalCode || data.shippingPostalCode.length < 4) {
      ctx.addIssue({
        code: "custom",
        message: "Code postal de livraison requis",
        path: ["shippingPostalCode"],
      });
    }
    if (!data.requestedDeliveryDate) {
      ctx.addIssue({
        code: "custom",
        message: "Date de livraison souhaitée requise",
        path: ["requestedDeliveryDate"],
      });
    }
    if (data.deliveryCategory === "STANDARD") {
      const namedItems = filterNamedItems(data.items);
      if (namedItems.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Ajoutez au moins un article",
          path: ["items"],
        });
      }
    }

    if (data.deliveryCategory === "COURIER") {
      const pickupStops = data.pickupStops ?? [];
      if (pickupStops.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Ajoutez au moins une adresse de collecte",
          path: ["pickupStops"],
        });
      }
      pickupStops.forEach((stop, index) => {
        if (!stop.address || stop.address.trim().length < 5) {
          ctx.addIssue({
            code: "custom",
            message: "Adresse de collecte requise",
            path: ["pickupStops", index, "address"],
          });
        }
        if (!stop.city || (stop.city ?? "").trim().length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Ville requise",
            path: ["pickupStops", index, "city"],
          });
        }
        if (!stop.postalCode || (stop.postalCode ?? "").trim().length < 4) {
          ctx.addIssue({
            code: "custom",
            message: "Code postal requis",
            path: ["pickupStops", index, "postalCode"],
          });
        }
        const namedItems = filterNamedItems(stop.items ?? []);
        if (namedItems.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "Ajoutez au moins un article à collecter à cette adresse",
            path: ["pickupStops", index, "items"],
          });
        }
      });
    }
  })
  .transform((data) => ({
    ...data,
    items: filterNamedItems(data.items).map((item) => ({
      ...item,
      name: item.name.trim(),
    })),
    stops:
      data.deliveryCategory === "SPECIAL_MISSION"
        ? data.stops?.map((stop) => ({
            ...stop,
            address: stop.address.trim(),
            city: (stop.city ?? "").trim(),
            postalCode: (stop.postalCode ?? "").trim(),
          }))
        : undefined,
    pickupStops:
      data.deliveryCategory === "COURIER"
        ? data.pickupStops?.map((stop) => ({
            ...stop,
            address: stop.address.trim(),
            city: (stop.city ?? "").trim(),
            postalCode: (stop.postalCode ?? "").trim(),
            items: filterNamedItems(stop.items ?? []).map((item) => ({
              ...item,
              name: item.name.trim(),
            })),
          }))
        : undefined,
  }));

export const recurringOrderItemSchema = orderItemSchema;

const recurrenceIntervalValue = numericField(1, "L'intervalle doit être au moins 1");

export const createRecurringOrderSchema = z
  .object({
    label: z.string().min(2, "Libellé requis"),
    deliveryCategory: z.enum(["STANDARD", "COURIER"]).default("STANDARD"),
    intervalValue: recurrenceIntervalValue,
    intervalUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]),
    startAt: z.string().min(1, "Date de début requise"),
    endAt: z.string().optional(),
    pickupStops: z.array(pickupStopSchema).optional(),
    pickupAddress: z.string().optional(),
    pickupCity: z.string().optional(),
    pickupPostalCode: z.string().optional(),
    pickupInstructions: z.string().optional(),
    shippingAddress: addressField("Adresse de livraison"),
    shippingCity: cityField("Ville de livraison"),
    shippingPostalCode: postalField("Code postal de livraison"),
    deliveryInstructions: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(draftOrderItemSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.deliveryCategory === "STANDARD") {
      const namedItems = filterNamedItems(data.items);
      if (namedItems.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Ajoutez au moins un article",
          path: ["items"],
        });
      }
    }
    if (data.deliveryCategory === "COURIER") {
      const pickupStops = data.pickupStops ?? [];
      if (pickupStops.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "Ajoutez au moins une adresse de collecte",
          path: ["pickupStops"],
        });
      }
      pickupStops.forEach((stop, index) => {
        if (!stop.address || stop.address.trim().length < 5) {
          ctx.addIssue({
            code: "custom",
            message: "Adresse de collecte requise",
            path: ["pickupStops", index, "address"],
          });
        }
        if (!stop.city || (stop.city ?? "").trim().length < 2) {
          ctx.addIssue({
            code: "custom",
            message: "Ville requise",
            path: ["pickupStops", index, "city"],
          });
        }
        if (!stop.postalCode || (stop.postalCode ?? "").trim().length < 4) {
          ctx.addIssue({
            code: "custom",
            message: "Code postal requis",
            path: ["pickupStops", index, "postalCode"],
          });
        }
        const namedItems = filterNamedItems(stop.items ?? []);
        if (namedItems.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: "Ajoutez au moins un article à collecter à cette adresse",
            path: ["pickupStops", index, "items"],
          });
        }
      });
    }
    if (data.endAt && data.startAt) {
      const start = new Date(data.startAt);
      const end = new Date(data.endAt);
      if (end < start) {
        ctx.addIssue({
          code: "custom",
          message: "La date de fin doit être après le début",
          path: ["endAt"],
        });
      }
    }
  })
  .transform((data) => ({
    ...data,
    items: filterNamedItems(data.items).map((item) => ({
      ...item,
      name: item.name.trim(),
    })),
    pickupStops:
      data.deliveryCategory === "COURIER"
        ? data.pickupStops?.map((stop) => ({
            ...stop,
            address: stop.address.trim(),
            city: (stop.city ?? "").trim(),
            postalCode: (stop.postalCode ?? "").trim(),
            items: filterNamedItems(stop.items ?? []).map((item) => ({
              ...item,
              name: item.name.trim(),
            })),
          }))
        : undefined,
  }));

export const updateRecurringOrderSchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED"]).optional(),
  label: z.string().min(2).optional(),
  deliveryCategory: z.enum(["STANDARD", "COURIER"]).optional(),
  intervalValue: recurrenceIntervalValue.optional(),
  intervalUnit: z.enum(["DAYS", "WEEKS", "MONTHS"]).optional(),
  startAt: z.string().optional(),
  endAt: z.string().nullable().optional(),
  pickupStops: z.array(pickupStopSchema).optional(),
  pickupAddress: z.string().optional(),
  pickupCity: z.string().optional(),
  pickupPostalCode: z.string().optional(),
  pickupInstructions: z.string().optional(),
  shippingAddress: z.string().min(5).optional(),
  shippingCity: z.string().min(2).optional(),
  shippingPostalCode: z.string().min(4).optional(),
  deliveryInstructions: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(recurringOrderItemSchema).min(1).optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    "QUOTE_REQUESTED",
    "PENDING",
    "ASSIGNED",
    "PURCHASING",
    "IN_DELIVERY",
    "DELIVERED",
    "INVOICED",
    "PAID",
    "CANCELLED",
    "FAILED",
  ]).refine((status): boolean => status !== "INVOICED" && status !== "PAID", "Utilisez les actions de facturation dédiées"),
});

export type CreateClientOrderInput = z.infer<typeof createClientOrderSchema>;
export type CreateClientOrderFormInput = z.input<typeof createClientOrderSchema>;
export type OrderStopInput = z.infer<typeof orderStopSchema>;
export type PickupStopInput = z.infer<typeof pickupStopSchema>;
export type CreateRecurringOrderInput = z.infer<typeof createRecurringOrderSchema>;
export type CreateRecurringOrderFormInput = z.input<typeof createRecurringOrderSchema>;
export type UpdateRecurringOrderInput = z.infer<typeof updateRecurringOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
