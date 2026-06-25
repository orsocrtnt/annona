import { z } from "zod";

export const clientSettingsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  deliveryAlerts: z.boolean().optional(),
  invoiceAlerts: z.boolean().optional(),
});

export type ClientSettingsInput = z.infer<typeof clientSettingsSchema>;
