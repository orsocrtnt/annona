import { prisma } from "@/services/prisma/client";
import { COMPANY_CLIENTS_TAKE, DRIVER_TODAY_EVENTS_TAKE } from "@/lib/query/list-limits";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getCompanyClients(companyId: string) {
  const today = startOfToday();

  const clients = await prisma.user.findMany({
    where: { companyId, role: { systemRole: "CLIENT" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          ordersAsCustomer: true,
          deliveriesAsCustomer: true,
        },
      },
      ordersAsCustomer: {
        where: { createdAt: { gte: today } },
        select: { id: true, reference: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: COMPANY_CLIENTS_TAKE,
  });

  const clientIds = clients.map((client) => client.id);
  const eventsMap = new Map(clientIds.map((id) => [id, 0]));

  if (clientIds.length > 0) {
    const eventsToday = await prisma.delivery.findMany({
      where: {
        companyId,
        customerId: { in: clientIds },
        trackingEvents: { some: { occurredAt: { gte: today } } },
      },
      select: {
        customerId: true,
        _count: {
          select: { trackingEvents: { where: { occurredAt: { gte: today } } } },
        },
      },
    });

    for (const row of eventsToday) {
      const customerId = row.customerId;
      if (!customerId) continue;
      eventsMap.set(customerId, (eventsMap.get(customerId) ?? 0) + row._count.trackingEvents);
    }
  }

  return clients.map(({ ordersAsCustomer, ...client }) => ({
    ...client,
    ordersToday: ordersAsCustomer.length,
    eventsToday: eventsMap.get(client.id) ?? 0,
  }));
}

export async function getCompanyClientDetail(companyId: string, clientId: string) {
  const today = startOfToday();

  const client = await prisma.user.findFirst({
    where: { id: clientId, companyId, role: { systemRole: "CLIENT" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      settings: true,
      addresses: { orderBy: { createdAt: "desc" } },
      ordersAsCustomer: {
        where: { companyId },
        select: {
          id: true,
          reference: true,
          status: true,
          deliveryCategory: true,
          totalAmount: true,
          source: true,
          createdAt: true,
          shippingAddress: true,
          shippingCity: true,
          deliveries: { select: { id: true, reference: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      deliveriesAsCustomer: {
        where: { companyId },
        select: {
          id: true,
          reference: true,
          status: true,
          deliveryCategory: true,
          address: true,
          city: true,
          createdAt: true,
          driverName: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      // Noms des relations du schéma (User.invoicesAsCustomer / User.supportTickets).
      invoicesAsCustomer: {
        where: { companyId },
        select: {
          id: true,
          reference: true,
          status: true,
          amount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      recurringOrders: {
        where: { companyId },
        select: {
          id: true,
          label: true,
          status: true,
          nextRunAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      supportTickets: {
        where: { companyId },
        select: {
          id: true,
          subject: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!client) return null;

  const todayEvents = await prisma.trackingEvent.findMany({
    where: {
      occurredAt: { gte: today },
      delivery: { customerId: clientId, companyId },
    },
    include: {
      delivery: { select: { reference: true, status: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: DRIVER_TODAY_EVENTS_TAKE,
  });

  const ordersToday = client.ordersAsCustomer.filter(
    (o) => new Date(o.createdAt) >= today
  );

  const activityToday = [
    ...ordersToday.map((o) => ({
      type: "order" as const,
      at: o.createdAt,
      label: `Commande ${o.reference} créée`,
      status: o.status,
    })),
    ...todayEvents.map((e) => ({
      type: "tracking" as const,
      at: e.occurredAt,
      label: e.label,
      description: e.description,
      deliveryRef: e.delivery.reference,
      status: e.delivery.status,
    })),
    ...(client.lastLoginAt && new Date(client.lastLoginAt) >= today
      ? [
          {
            type: "login" as const,
            at: client.lastLoginAt,
            label: "Connexion au portail",
            status: null,
          },
        ]
      : []),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // La fiche attend `invoices` et `tickets` : même forme qu'avant, relations valides.
  const { invoicesAsCustomer, supportTickets, ...profile } = client;
  return { client: { ...profile, invoices: invoicesAsCustomer, tickets: supportTickets }, activityToday, todayEvents };
}
