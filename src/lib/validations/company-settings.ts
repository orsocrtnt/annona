import { z } from "zod";

export const companyDeliveryOptionsSchema = z
  .object({
    deliveryCategories: z.object({
      STANDARD: z.boolean(),
      COURIER: z.boolean(),
      SPECIAL_MISSION: z.boolean(),
    }),
  })
  .refine(
    (data) =>
      data.deliveryCategories.STANDARD ||
      data.deliveryCategories.COURIER ||
      data.deliveryCategories.SPECIAL_MISSION,
    { message: "Au moins une option doit rester active" }
  );

export type CompanyDeliveryOptions = z.infer<typeof companyDeliveryOptionsSchema>;
