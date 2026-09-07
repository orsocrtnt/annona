import { z } from "zod";
import { POD_FAILURE_CODES } from "@/lib/pod/codes";

export const assignDeliverySchema = z.object({
  driverId: z.string().min(1, "Chauffeur requis"),
  force: z.boolean().optional(),
});

const driverPurchaseItemSchema = z.object({
  id: z.string().min(1),
  unitPrice: z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .pipe(z.number().min(0, "Le prix doit être positif ou nul")),
});

export const updateDriverDeliveryStatusSchema = z.object({
  status: z.enum(["PURCHASING", "IN_DELIVERY", "DELIVERED", "FAILED"]),
  purchaseItems: z.array(driverPurchaseItemSchema).optional(),
  confirmOutOfRange: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  podOutcome: z.enum(["SUCCESS", "FAILED"]).optional(),
  podFailureCode: z.enum(POD_FAILURE_CODES).optional(),
  podNote: z.string().max(400).optional(),
  podPhotoPath: z.string().min(1).optional(),
});

export const adminUpdateDeliverySchema = z.object({
  status: z
    .enum([
      "PENDING",
      "ASSIGNED",
      "PURCHASING",
      "IN_DELIVERY",
      "DELIVERED",
      "INVOICED",
      "PAID",
      "CANCELLED",
      "FAILED",
    ])
    .optional(),
  address: z.string().min(5).optional(),
  city: z.string().min(2).optional(),
  postalCode: z.string().min(4).optional(),
  pickupAddress: z.string().optional(),
  pickupCity: z.string().optional(),
  pickupPostalCode: z.string().optional(),
  scheduledAt: z.string().optional().nullable(),
  estimatedArrival: z.string().optional().nullable(),
  unassignDriver: z.boolean().optional(),
  reason: z.string().optional(),
});

export type AssignDeliveryInput = z.infer<typeof assignDeliverySchema>;
export type UpdateDriverDeliveryStatusInput = z.infer<typeof updateDriverDeliveryStatusSchema>;
export type AdminUpdateDeliveryInput = z.infer<typeof adminUpdateDeliverySchema>;
