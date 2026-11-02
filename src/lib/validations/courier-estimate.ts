import { z } from "zod";

// Champ absent ou null : null pour le service d'estimation.
const text = z.string().max(500).nullish().transform((value) => value ?? null);

/** Corps des routes d'estimation d'une course (portail et équipe), mis en forme pour le service. */
export const courierEstimateRequestSchema = z
  .object({
    pickupAddress: text,
    pickupCity: text,
    pickupPostalCode: text,
    shippingAddress: text,
    shippingCity: text,
    shippingPostalCode: text,
    requestedDeliveryDate: z.string().max(40).nullish().transform((value) => value ?? null),
  })
  .strict()
  .transform((body) => ({
    pickup: { address: body.pickupAddress, city: body.pickupCity, postalCode: body.pickupPostalCode },
    shipping: { address: body.shippingAddress, city: body.shippingCity, postalCode: body.shippingPostalCode },
    requestedDeliveryDate: body.requestedDeliveryDate,
  }));
