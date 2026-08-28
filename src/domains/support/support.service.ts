import { prisma } from "@/services/prisma/client";
import type { CreateSupportTicketInput } from "@/lib/validations/support";
import { CLIENT_TICKETS_TAKE } from "@/lib/query/list-limits";

export async function getClientTickets(customerId: string) {
  return prisma.supportTicket.findMany({
    where: { customerId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 5 },
      relatedOrder: { select: { reference: true } },
      relatedDelivery: { select: { reference: true } },
    },
    orderBy: { createdAt: "desc" },
    take: CLIENT_TICKETS_TAKE,
  });
}

export async function getClientTicketById(customerId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      relatedOrder: { select: { reference: true } },
      relatedDelivery: { select: { reference: true } },
    },
  });
}

export async function createClientTicket(
  customerId: string,
  companyId: string,
  data: CreateSupportTicketInput
) {
  const ticket = await prisma.supportTicket.create({
    data: {
      subject: data.subject,
      message: data.message,
      customerId,
      companyId,
      status: "OPEN",
      priority: "NORMAL",
      contactType: data.contactType,
      relatedOrderId: data.relatedOrderId,
      relatedDeliveryId: data.relatedDeliveryId,
      messages: {
        create: {
          body: data.message,
          authorId: customerId,
          isStaff: false,
        },
      },
    },
    include: {
      messages: true,
      relatedOrder: { select: { reference: true } },
      relatedDelivery: { select: { reference: true } },
    },
  });

  return ticket;
}

export async function addClientTicketMessage(
  customerId: string,
  ticketId: string,
  body: string
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId },
  });
  if (!ticket) return null;

  const message = await prisma.supportTicketMessage.create({
    data: { ticketId, body, authorId: customerId, isStaff: false },
  });

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "OPEN", updatedAt: new Date() },
  });

  return message;
}
