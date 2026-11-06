import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/services/prisma/client";
import {
  addStaffTicketMessage,
  getStaffTicketById,
  getStaffTickets,
  updateStaffTicketStatus,
} from "../src/domains/support/support.service";
import {
  supportMessageSchema,
  updateSupportTicketStatusSchema,
} from "../src/lib/validations/support";

test("SUPPORT-1 : les listes staff restent limitées à l’entreprise et à ses ressources", async (t) => {
  const calls: Array<Record<string, unknown>> = [];
  const findMany = Reflect.get(prisma.supportTicket, "findMany");
  const findFirst = Reflect.get(prisma.supportTicket, "findFirst");
  Reflect.set(prisma.supportTicket, "findMany", async (input: Record<string, unknown>) => {
    calls.push(input);
    return [];
  });
  Reflect.set(prisma.supportTicket, "findFirst", async (input: Record<string, unknown>) => {
    calls.push(input);
    return null;
  });
  t.after(() => {
    Reflect.set(prisma.supportTicket, "findMany", findMany);
    Reflect.set(prisma.supportTicket, "findFirst", findFirst);
  });

  await getStaffTickets("company-a");
  await getStaffTicketById("company-a", "ticket-a");

  assert.equal(calls.length, 2);
  for (const call of calls) {
    const where = call.where as Record<string, unknown>;
    assert.equal(where.companyId, "company-a");
    assert.deepEqual(where.OR, [{ relatedOrderId: null }, { relatedOrder: { is: { companyId: "company-a" } } }]);
    assert.deepEqual(where.customer, { is: { companyId: "company-a" } });
  }
  assert.equal((calls[1]!.where as Record<string, unknown>).id, "ticket-a");
});

test("SUPPORT-1 : réponse staff atomique, notification client et aucun accès étranger", async (t) => {
  const messages: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  let currentStatus = "OPEN";
  const tx = {
    supportTicket: {
      findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: unknown }) => {
        if (where.companyId !== "company-a") return null;
        return include
          ? { id: "ticket-a", customerId: "client-a", status: currentStatus, messages: [] }
          : { id: "ticket-a", customerId: "client-a", status: currentStatus };
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        updates.push(data);
        if (where.status === currentStatus) currentStatus = String(data.status);
        return { count: 1 };
      },
    },
    supportTicketMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        messages.push(data);
        return { id: "message-a", ...data };
      },
    },
    clientNotification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        notifications.push(data);
        return data;
      },
    },
  };
  t.mock.method(prisma, "$transaction", async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

  assert.equal(
    await addStaffTicketMessage("staff-b", "company-b", "ticket-a", "Réponse étrangère"),
    null
  );
  assert.equal(messages.length, 0);
  assert.equal(notifications.length, 0);

  const result = await addStaffTicketMessage(
    "staff-a",
    "company-a",
    "ticket-a",
    "Votre demande est prise en charge."
  );
  assert.equal(result?.ticket.status, "IN_PROGRESS");
  assert.deepEqual(messages[0], {
    companyId: "company-a",
    ticketId: "ticket-a",
    body: "Votre demande est prise en charge.",
    authorId: "staff-a",
    isStaff: true,
  });
  assert.equal(updates[0]!.status, "IN_PROGRESS");
  assert.deepEqual(notifications[0], {
    companyId: "company-a",
    userId: "client-a",
    type: "SUPPORT",
    title: "Nouvelle réponse du support",
    body: "Votre demande est prise en charge.",
    href: "/portal/support/ticket-a",
  });

  currentStatus = "RESOLVED";
  await addStaffTicketMessage("staff-a", "company-a", "ticket-a", "Précision après résolution");
  assert.equal(currentStatus, "RESOLVED", "une réponse ne rétrograde pas une résolution concurrente");
});

test("SUPPORT-1 : résolution notifiée, rejeu sans doublon et entrées bornées", async (t) => {
  let currentStatus = "IN_PROGRESS";
  const notifications: Array<Record<string, unknown>> = [];
  const tx = {
    supportTicket: {
      findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: unknown }) => {
        if (where.companyId !== "company-a") return null;
        return include
          ? { id: "ticket-a", customerId: "client-a", status: currentStatus, messages: [] }
          : { id: "ticket-a", customerId: "client-a", status: currentStatus };
      },
      update: async ({ data }: { data: { status: string } }) => {
        currentStatus = data.status;
        return { id: "ticket-a", customerId: "client-a", status: currentStatus, messages: [] };
      },
    },
    clientNotification: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        notifications.push(data);
        return data;
      },
    },
  };
  t.mock.method(prisma, "$transaction", async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx));

  const resolved = await updateStaffTicketStatus("company-a", "ticket-a", "RESOLVED");
  assert.equal(resolved?.status, "RESOLVED");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]!.type, "SUPPORT");
  assert.match(String(notifications[0]!.title), /résolue/i);

  await updateStaffTicketStatus("company-a", "ticket-a", "RESOLVED");
  assert.equal(notifications.length, 1, "un rejeu du même statut ne renvoie pas de notification");
  assert.equal(await updateStaffTicketStatus("company-b", "ticket-a", "CLOSED"), null);

  assert.equal(supportMessageSchema.safeParse({ body: "  réponse  " }).data?.body, "réponse");
  assert.equal(supportMessageSchema.safeParse({ body: "" }).success, false);
  assert.equal(supportMessageSchema.safeParse({ body: "x".repeat(4001) }).success, false);
  assert.equal(updateSupportTicketStatusSchema.safeParse({ status: "RESOLVED" }).success, true);
  assert.equal(updateSupportTicketStatusSchema.safeParse({ status: "UNKNOWN" }).success, false);
});
