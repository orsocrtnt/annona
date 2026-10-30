import { z } from "zod";

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");

const deliverySlotSchema = z
  .object({ start: timeOfDay, end: timeOfDay })
  .refine((slot) => slot.start < slot.end, { message: "La fin du créneau doit suivre son début" });

export const companyDeliverySlotsSchema = z
  .object({
    mode: z.enum(["DAY", "SLOTS"]),
    slots: z.array(deliverySlotSchema).max(8, "8 créneaux au maximum"),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "SLOTS" && value.slots.length === 0) {
      ctx.addIssue({ code: "custom", message: "Ajoutez au moins un créneau", path: ["slots"] });
    }
    const sorted = [...value.slots].sort((a, b) => a.start.localeCompare(b.start));
    if (sorted.some((slot, index) => index > 0 && slot.start < sorted[index - 1]!.end)) {
      ctx.addIssue({ code: "custom", message: "Deux créneaux se chevauchent", path: ["slots"] });
    }
  });

export type CompanyDeliverySlots = z.infer<typeof companyDeliverySlotsSchema>;
export type DeliverySlot = CompanyDeliverySlots["slots"][number];

/** « Au jour » par défaut : une entreprise qui n'a rien réglé garde son fonctionnement. */
export const DEFAULT_DELIVERY_SLOTS: CompanyDeliverySlots = {
  mode: "DAY",
  slots: [
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "18:00" },
  ],
};

export function parseDeliverySlots(raw: unknown): CompanyDeliverySlots {
  const parsed = companyDeliverySlotsSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_DELIVERY_SLOTS;
  return { ...parsed.data, slots: [...parsed.data.slots].sort((a, b) => a.start.localeCompare(b.start)) };
}

export const deliverySlotKey = (slot: DeliverySlot) => `${slot.start}-${slot.end}`;
export const deliverySlotLabel = (slot: DeliverySlot) => `${slot.start} – ${slot.end}`;
