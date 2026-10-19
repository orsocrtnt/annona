import { z } from "zod";

export const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(3, "Le sujet doit contenir au moins 3 caractères").max(160),
  message: z.string().trim().min(10, "Le message doit contenir au moins 10 caractères").max(4000),
  relatedOrderId: z.string().min(1).max(100).optional(),
  relatedDeliveryId: z.string().min(1).max(100).optional(),
  contactType: z.enum(["ADMIN", "DRIVER"]).optional(),
}).strict();

export const supportMessageSchema = z.object({
  body: z.string().trim().min(1, "Message requis").max(4000),
}).strict();

export const updateSupportTicketStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
}).strict();

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;
