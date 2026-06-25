import { z } from "zod";

export const createSupportTicketSchema = z.object({
  subject: z.string().min(3, "Le sujet doit contenir au moins 3 caractères"),
  message: z.string().min(10, "Le message doit contenir au moins 10 caractères"),
  relatedOrderId: z.string().optional(),
  relatedDeliveryId: z.string().optional(),
  contactType: z.enum(["ADMIN", "DRIVER"]).optional(),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
