import type { SupportTicketPriority, SupportTicketStatus } from "@prisma/client";

export interface CompanySupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  contactType: "ADMIN" | "DRIVER" | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  relatedOrder: { id: string; reference: string } | null;
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    authorId: string;
    createdAt: string;
  }>;
}
