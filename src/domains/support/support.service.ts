import type { Prisma, SupportTicketStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import type { CreateSupportTicketInput } from "@/lib/validations/support";
import { CLIENT_TICKETS_TAKE } from "@/lib/query/list-limits";

export class InvalidSupportReferenceError extends Error {
  constructor() {
    super("Référence introuvable");
    this.name = "InvalidSupportReferenceError";
  }
}
// Masquer aussi les anciens tickets liés à des ressources hors du périmètre client.
function clientTicketScope(customerId: string, companyId: string): Prisma.SupportTicketWhereInput {
  const owner = { customerId, companyId };
  return {
    ...owner,
    AND: [
      { OR: [{ relatedOrderId: null }, { relatedOrder: { is: owner } }] },
      {
        OR: [
          { relatedDeliveryId: null },
          { relatedDelivery: { is: { ...owner, order: { is: owner } } } },
        ],
      },
    ],
  };
}

export async function getClientTickets(customerId: string, companyId: string) {
  return prisma.supportTicket.findMany({
    where: clientTicketScope(customerId, companyId),
    include: {
      messages: { orderBy: { createdAt: "asc" }, take: 5 },
      relatedOrder: { select: { reference: true } },
      relatedDelivery: { select: { reference: true } },
    },
    orderBy: { createdAt: "desc" },
    take: CLIENT_TICKETS_TAKE,
  });
}

export async function getClientTicketById(customerId: string, companyId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, ...clientTicketScope(customerId, companyId) },
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
  return prisma.$transaction(async (tx) => {
    const owner = { customerId, companyId };
    if (data.relatedOrderId !== undefined) {
      const order = await tx.order.findFirst({
        where: { id: data.relatedOrderId, ...owner },
        select: { id: true },
      });
      if (!order) throw new InvalidSupportReferenceError();
    }
    if (data.relatedDeliveryId !== undefined) {
      const delivery = await tx.delivery.findFirst({
        where: {
          id: data.relatedDeliveryId,
          ...owner,
          order: { is: owner },
          ...(data.relatedOrderId !== undefined ? { orderId: data.relatedOrderId } : {}),
        },
        select: { id: true },
      });
      if (!delivery) throw new InvalidSupportReferenceError();
    }
    return tx.supportTicket.create({
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
  });
}

export async function addClientTicketMessage(
  customerId: string,
  companyId: string,
  ticketId: string,
  body: string
) {
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, ...clientTicketScope(customerId, companyId) },
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

function staffTicketScope(companyId: string): Prisma.SupportTicketWhereInput {
  return {
    companyId,
    customer: { is: { companyId } },
    AND: [
      { OR: [{ relatedOrderId: null }, { relatedOrder: { is: { companyId } } }] },
      {
        OR: [
          { relatedDeliveryId: null },
          {
            relatedDelivery: {
              is: { companyId, order: { is: { companyId } } },
            },
          },
        ],
      },
    ],
  };
}

const staffTicketInclude = {
  customer: {
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  },
  messages: { orderBy: { createdAt: "asc" as const } },
  relatedOrder: { select: { id: true, reference: true } },
  relatedDelivery: { select: { id: true, reference: true } },
} satisfies Prisma.SupportTicketInclude;

export async function getStaffTickets(companyId: string) {
  return prisma.supportTicket.findMany({
    where: staffTicketScope(companyId),
    include: staffTicketInclude,
    orderBy: { updatedAt: "desc" },
    take: CLIENT_TICKETS_TAKE,
  });
}

export async function getStaffTicketById(companyId: string, ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, ...staffTicketScope(companyId) },
    include: staffTicketInclude,
  });
}

function supportNotification(status: SupportTicketStatus) {
  const copy: Record<SupportTicketStatus, { title: string; body: string }> = {
    OPEN: { title: "Demande de support rouverte", body: "Votre demande a été rouverte." },
    IN_PROGRESS: { title: "Demande prise en charge", body: "Votre demande est en cours de traitement." },
    RESOLVED: { title: "Demande résolue", body: "Votre demande a été marquée comme résolue." },
    CLOSED: { title: "Demande clôturée", body: "Votre demande a été clôturée." },
  };
  return copy[status];
}

export async function addStaffTicketMessage(
  staffId: string,
  companyId: string,
  ticketId: string,
  body: string
) {
  return prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.findFirst({
      where: { id: ticketId, ...staffTicketScope(companyId) },
      select: { id: true, customerId: true, status: true },
    });
    if (!ticket) return null;

    const message = await tx.supportTicketMessage.create({
      data: { ticketId, body, authorId: staffId, isStaff: true },
    });
    // Une résolution concurrente doit gagner : seule une demande encore OPEN
    // passe automatiquement à IN_PROGRESS lors de la première réponse.
    await tx.supportTicket.updateMany({
      where: { id: ticketId, companyId, status: "OPEN" },
      data: { status: "IN_PROGRESS", updatedAt: new Date() },
    });
    const updated = await tx.supportTicket.findFirst({
      where: { id: ticketId, ...staffTicketScope(companyId) },
      include: staffTicketInclude,
    });
    if (!updated) return null;
    await tx.clientNotification.create({
      data: {
        userId: ticket.customerId,
        type: "SUPPORT",
        title: "Nouvelle réponse du support",
        body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
        href: `/portal/support/${ticketId}`,
      },
    });
    return { ticket: updated, message };
  });
}

export async function updateStaffTicketStatus(
  companyId: string,
  ticketId: string,
  status: SupportTicketStatus
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.supportTicket.findFirst({
      where: { id: ticketId, ...staffTicketScope(companyId) },
      select: { id: true, customerId: true, status: true },
    });
    if (!current) return null;

    if (current.status === status) {
      return tx.supportTicket.findFirst({
        where: { id: ticketId, ...staffTicketScope(companyId) },
        include: staffTicketInclude,
      });
    }

    const updated = await tx.supportTicket.update({
      where: { id: ticketId },
      data: { status, updatedAt: new Date() },
      include: staffTicketInclude,
    });
    const copy = supportNotification(status);
    await tx.clientNotification.create({
      data: {
        userId: current.customerId,
        type: "SUPPORT",
        title: copy.title,
        body: copy.body,
        href: `/portal/support/${ticketId}`,
      },
    });
    return updated;
  });
}
