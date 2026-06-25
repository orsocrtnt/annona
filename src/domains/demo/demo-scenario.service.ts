import { prisma } from "@/services/prisma/client";
import type {
  DeliveryCategory,
  DeliveryStatus,
  InvoiceStatus,
  OrderStatus,
} from "@prisma/client";
import {
  generateDeliveryReference,
  generateOrderReference,
} from "@/lib/order-reference";
import { getPrimaryCourierPickupFields } from "@/lib/order/courier-pickups";

interface DemoActors {
  companyId: string;
  clientId: string;
  clientEmail: string;
  driverId: string;
  driverName: string;
}

interface TrackingSeed {
  label: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  offsetHours: number;
}

interface ScenarioItem {
  label: string;
  deliveryCategory: DeliveryCategory;
  orderStatus: OrderStatus;
  deliveryStatus: DeliveryStatus;
  assignDriver: boolean;
  requestedDeliveryDateOffsetHours: number;
  scheduledAtOffsetHours?: number;
  completedAtOffsetHours?: number;
  estimatedArrivalOffsetHours?: number;
  missionStartedAtOffsetHours?: number;
  shipping: { address: string; city: string; postalCode: string };
  pickup?: { address: string; city: string; postalCode: string };
  pickupStops?: Array<{
    label: string;
    address: string;
    city: string;
    postalCode: string;
    items: Array<{ name: string; quantity: number; unitPrice: number }>;
  }>;
  items?: Array<{ name: string; quantity: number; unitPrice: number }>;
  notes?: string;
  deliveryInstructions?: string;
  tracking: TrackingSeed[];
  invoice?: { status: InvoiceStatus; dueInDays?: number; paidDaysAgo?: number };
  supportTicket?: { subject: string; message: string };
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function buildScenario(): ScenarioItem[] {
  return [
    {
      label: "Livrée + facture payée",
      deliveryCategory: "STANDARD",
      orderStatus: "PAID",
      deliveryStatus: "DELIVERED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -72,
      completedAtOffsetHours: -24,
      shipping: {
        address: "12 Rue de Rivoli",
        city: "Paris",
        postalCode: "75001",
      },
      items: [
        { name: "Colis documents", quantity: 2, unitPrice: 29.95 },
        { name: "Emballage fragile", quantity: 1, unitPrice: 30.0 },
      ],
      notes: "Livraison démo — historique client",
      tracking: [
        { label: "Commande reçue", offsetHours: -72 },
        { label: "En préparation", offsetHours: -48 },
        { label: "En livraison", offsetHours: -30, latitude: 48.8566, longitude: 2.3522 },
        {
          label: "Livré",
          description: "Colis remis au destinataire",
          offsetHours: -24,
          latitude: 48.8566,
          longitude: 2.3522,
        },
      ],
      invoice: { status: "PAID", paidDaysAgo: 2 },
    },
    {
      label: "En livraison (suivi actif)",
      deliveryCategory: "STANDARD",
      orderStatus: "IN_DELIVERY",
      deliveryStatus: "IN_DELIVERY",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: -4,
      estimatedArrivalOffsetHours: 2,
      shipping: {
        address: "45 Avenue des Champs-Élysées",
        city: "Paris",
        postalCode: "75008",
      },
      items: [{ name: "Livraison express", quantity: 1, unitPrice: 45.0 }],
      deliveryInstructions: "Sonner à l'interphone — 3e étage",
      tracking: [
        { label: "Commande reçue", offsetHours: -6 },
        { label: "Assignée", description: "Chauffeur affecté", offsetHours: -3 },
        {
          label: "En livraison",
          description: "Le chauffeur est en route",
          offsetHours: -1,
          latitude: 48.8698,
          longitude: 2.3078,
        },
      ],
      invoice: { status: "PENDING", dueInDays: 15 },
      supportTicket: {
        subject: "Question sur l'heure de livraison",
        message:
          "Bonjour, pouvez-vous me confirmer l'heure estimée d'arrivée du chauffeur ? Merci.",
      },
    },
    {
      label: "En attente dispatch",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 24,
      scheduledAtOffsetHours: 24,
      shipping: {
        address: "8 Boulevard Haussmann",
        city: "Paris",
        postalCode: "75009",
      },
      items: [{ name: "Carton 5 kg", quantity: 1, unitPrice: 38.5 }],
      tracking: [
        {
          label: "Commande reçue",
          description: "En attente d'assignation chauffeur",
          offsetHours: -2,
        },
      ],
    },
    {
      label: "En retard",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: -48,
      scheduledAtOffsetHours: -48,
      shipping: {
        address: "22 Rue de la Roquette",
        city: "Paris",
        postalCode: "75011",
      },
      items: [{ name: "Pièces détachées", quantity: 1, unitPrice: 62.0 }],
      notes: "Date demandée dépassée — priorité dispatch",
      tracking: [
        { label: "Commande reçue", offsetHours: -72 },
        { label: "En attente chauffeur", description: "Retard sur la date prévue", offsetHours: -24 },
      ],
    },
    {
      label: "Planifiée à venir",
      deliveryCategory: "STANDARD",
      orderStatus: "PENDING",
      deliveryStatus: "PENDING",
      assignDriver: false,
      requestedDeliveryDateOffsetHours: 48,
      scheduledAtOffsetHours: 48,
      shipping: {
        address: "5 Place de la Bastille",
        city: "Paris",
        postalCode: "75012",
      },
      items: [{ name: "Fournitures bureau", quantity: 3, unitPrice: 18.0 }],
      tracking: [{ label: "Commande reçue", description: "Livraison planifiée", offsetHours: -1 }],
    },
    {
      label: "Course simple — en achat",
      deliveryCategory: "COURIER",
      orderStatus: "PURCHASING",
      deliveryStatus: "PURCHASING",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 4,
      estimatedArrivalOffsetHours: 6,
      missionStartedAtOffsetHours: -1,
      pickup: {
        address: "2 Rue du Louvre",
        city: "Paris",
        postalCode: "75001",
      },
      shipping: {
        address: "18 Rue de Vaugirard",
        city: "Paris",
        postalCode: "75015",
      },
      pickupStops: [
        {
          label: "Collecte pharmacie",
          address: "2 Rue du Louvre",
          city: "Paris",
          postalCode: "75001",
          items: [{ name: "Ordonnance urgente", quantity: 1, unitPrice: 25.0 }],
        },
      ],
      deliveryInstructions: "Livraison en main propre",
      tracking: [
        { label: "Course reçue", offsetHours: -3 },
        { label: "Chauffeur en route collecte", offsetHours: -1, latitude: 48.8606, longitude: 2.3376 },
        { label: "En cours d'achat", description: "Récupération en cours", offsetHours: 0 },
      ],
    },
    {
      label: "Course — collectes multiples",
      deliveryCategory: "COURIER",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 8,
      estimatedArrivalOffsetHours: 10,
      shipping: {
        address: "14 Avenue de la République",
        city: "Boulogne-Billancourt",
        postalCode: "92100",
      },
      pickupStops: [
        {
          label: "Collecte 1 — Imprimerie",
          address: "30 Rue de la Boétie",
          city: "Paris",
          postalCode: "75008",
          items: [{ name: "Documents à signer", quantity: 1, unitPrice: 0 }],
        },
        {
          label: "Collecte 2 — Showroom",
          address: "15 Rue Oberkampf",
          city: "Paris",
          postalCode: "75011",
          items: [{ name: "Échantillons produits", quantity: 2, unitPrice: 35.0 }],
        },
        {
          label: "Collecte 3 — Entrepôt",
          address: "4 Place d'Italie",
          city: "Paris",
          postalCode: "75013",
          items: [{ name: "Petit colis", quantity: 1, unitPrice: 12.0 }],
        },
      ],
      notes: "Course multi-points démo",
      tracking: [
        { label: "Course reçue", offsetHours: -2 },
        { label: "Collecte 1", description: "30 Rue de la Boétie, Paris", offsetHours: -1 },
        { label: "Collecte 2", description: "15 Rue Oberkampf, Paris", offsetHours: 0 },
        { label: "Collecte 3", description: "4 Place d'Italie, Paris", offsetHours: 0 },
        {
          label: "Livraison",
          description: "14 Avenue de la République, Boulogne-Billancourt",
          offsetHours: 0,
        },
      ],
    },
    {
      label: "Commande multi-articles",
      deliveryCategory: "STANDARD",
      orderStatus: "ASSIGNED",
      deliveryStatus: "ASSIGNED",
      assignDriver: true,
      requestedDeliveryDateOffsetHours: 12,
      estimatedArrivalOffsetHours: 14,
      shipping: {
        address: "27 Rue Gabriel Péri",
        city: "Levallois-Perret",
        postalCode: "92300",
      },
      items: [
        { name: "Matériel informatique", quantity: 1, unitPrice: 120.0 },
        { name: "Câbles réseau", quantity: 4, unitPrice: 15.0 },
        { name: "Écran 24 pouces", quantity: 1, unitPrice: 189.0 },
        { name: "Souris sans fil", quantity: 2, unitPrice: 25.0 },
        { name: "Clavier mécanique", quantity: 1, unitPrice: 89.0 },
      ],
      deliveryInstructions: "Accès parking livraison — badge à l'accueil",
      tracking: [
        { label: "Commande reçue", offsetHours: -4 },
        { label: "Assignée au chauffeur", offsetHours: -2 },
      ],
    },
  ];
}

async function purgeDemoTransactionalData(companyId: string) {
  const drivers = await prisma.user.findMany({
    where: { companyId, role: { systemRole: "DRIVER" } },
    select: { id: true },
  });
  const driverIds = drivers.map((d) => d.id);

  await prisma.$transaction([
    prisma.supportTicket.deleteMany({ where: { companyId } }),
    prisma.invoice.deleteMany({ where: { companyId } }),
    ...(driverIds.length > 0
      ? [prisma.driverLocation.deleteMany({ where: { driverId: { in: driverIds } } })]
      : []),
    prisma.order.deleteMany({ where: { companyId } }),
  ]);
}

async function ensureRecurringOrder(actors: DemoActors) {
  const existing = await prisma.recurringOrder.findFirst({
    where: { companyId: actors.companyId, customerId: actors.clientId },
  });

  const payload = {
    label: "Livraison hebdomadaire fournitures",
    frequency: "WEEKLY" as const,
    intervalValue: 1,
    intervalUnit: "WEEKS" as const,
    status: "ACTIVE" as const,
    startAt: hoursFromNow(-168),
    nextRunAt: hoursFromNow(120),
    deliveryCategory: "STANDARD" as const,
    shippingAddress: "11 Rue de la Paix",
    shippingCity: "Neuilly-sur-Seine",
    shippingPostalCode: "92200",
    deliveryInstructions: "Déposer au bureau — étage 2",
    notes: "Commande récurrente démo",
    items: [{ name: "Pack fournitures", quantity: 1, estimatedPrice: 55 }],
  };

  if (existing) {
    await prisma.recurringOrder.update({
      where: { id: existing.id },
      data: payload,
    });
    return existing.id;
  }

  const created = await prisma.recurringOrder.create({
    data: {
      ...payload,
      companyId: actors.companyId,
      customerId: actors.clientId,
    },
  });
  return created.id;
}

async function createScenarioDelivery(
  actors: DemoActors,
  scenario: ScenarioItem
): Promise<{ orderId: string; deliveryId: string }> {
  const isCourier = scenario.deliveryCategory === "COURIER";
  const pickupStops = scenario.pickupStops ?? [];
  const firstPickup = pickupStops[0] ?? scenario.pickup;

  const items = scenario.items ?? [];
  const courierItems = pickupStops.flatMap((stop) => stop.items);
  const totalAmount = isCourier
    ? courierItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    : items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemCount = isCourier
    ? courierItems.reduce((sum, item) => sum + item.quantity, 0)
    : items.reduce((sum, item) => sum + item.quantity, 0);

  const orderReference = await generateOrderReference(scenario.deliveryCategory);
  const deliveryReference = await generateDeliveryReference();
  const primaryPickup = isCourier
    ? getPrimaryCourierPickupFields(
        pickupStops.map((stop) => ({
          address: stop.address,
          city: stop.city,
          postalCode: stop.postalCode,
          label: stop.label,
        }))
      )
    : null;

  const order = await prisma.order.create({
    data: {
      reference: orderReference,
      status: scenario.orderStatus,
      source: "CLIENT",
      totalAmount,
      itemCount: Math.max(itemCount, 1),
      notes: scenario.notes ?? null,
      deliveryCategory: scenario.deliveryCategory,
      pickupAddress: isCourier ? (primaryPickup?.pickupAddress ?? firstPickup?.address ?? null) : null,
      pickupCity: isCourier ? (primaryPickup?.pickupCity ?? firstPickup?.city ?? null) : null,
      pickupPostalCode: isCourier
        ? (primaryPickup?.pickupPostalCode ?? firstPickup?.postalCode ?? null)
        : null,
      shippingAddress: scenario.shipping.address,
      shippingCity: scenario.shipping.city,
      shippingPostalCode: scenario.shipping.postalCode,
      deliveryInstructions: scenario.deliveryInstructions ?? null,
      requestedDeliveryDate: hoursFromNow(scenario.requestedDeliveryDateOffsetHours),
      companyId: actors.companyId,
      customerId: actors.clientId,
      customerEmail: actors.clientEmail,
      items: !isCourier
        ? {
            create: items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          }
        : undefined,
      stops:
        isCourier && pickupStops.length > 0
          ? {
              create: pickupStops.map((stop, index) => ({
                sequence: index,
                label: stop.label,
                address: stop.address,
                city: stop.city,
                postalCode: stop.postalCode,
              })),
            }
          : undefined,
    },
    include: {
      stops: { orderBy: { sequence: "asc" } },
    },
  });

  if (isCourier && pickupStops.length > 0 && order.stops.length > 0) {
    const itemRows = order.stops.flatMap((stop) => {
      const stopInput = pickupStops[stop.sequence];
      return (stopInput?.items ?? []).map((item) => ({
        orderId: order.id,
        orderStopId: stop.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }));
    });
    if (itemRows.length > 0) {
      await prisma.orderItem.createMany({ data: itemRows });
    }
  }

  const delivery = await prisma.delivery.create({
    data: {
      reference: deliveryReference,
      status: scenario.deliveryStatus,
      deliveryCategory: scenario.deliveryCategory,
      pickupAddress: isCourier ? (primaryPickup?.pickupAddress ?? null) : null,
      pickupCity: isCourier ? (primaryPickup?.pickupCity ?? null) : null,
      pickupPostalCode: isCourier ? (primaryPickup?.pickupPostalCode ?? null) : null,
      address: scenario.shipping.address,
      city: scenario.shipping.city,
      postalCode: scenario.shipping.postalCode,
      driverId: scenario.assignDriver ? actors.driverId : null,
      driverName: scenario.assignDriver ? actors.driverName : null,
      companyId: actors.companyId,
      orderId: order.id,
      customerId: actors.clientId,
      scheduledAt:
        scenario.scheduledAtOffsetHours != null
          ? hoursFromNow(scenario.scheduledAtOffsetHours)
          : hoursFromNow(scenario.requestedDeliveryDateOffsetHours),
      estimatedArrival:
        scenario.estimatedArrivalOffsetHours != null
          ? hoursFromNow(scenario.estimatedArrivalOffsetHours)
          : null,
      completedAt:
        scenario.completedAtOffsetHours != null
          ? hoursFromNow(scenario.completedAtOffsetHours)
          : null,
      missionStartedAt:
        scenario.missionStartedAtOffsetHours != null
          ? hoursFromNow(scenario.missionStartedAtOffsetHours)
          : null,
      trackingEvents: {
        create: scenario.tracking.map((event) => ({
          label: event.label,
          description: event.description ?? null,
          latitude: event.latitude ?? null,
          longitude: event.longitude ?? null,
          occurredAt: hoursFromNow(event.offsetHours),
        })),
      },
    },
  });

  if (scenario.invoice) {
    const invoiceRef = `FAC-DEMO-${deliveryReference.slice(-6)}`;
    await prisma.invoice.create({
      data: {
        reference: invoiceRef,
        status: scenario.invoice.status,
        amount: totalAmount,
        lineItems: items.length
          ? items.map((item) => ({
              label: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              sourceType: "ITEM",
            }))
          : courierItems.map((item) => ({
              label: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              sourceType: "ITEM",
            })),
        companyId: actors.companyId,
        orderId: order.id,
        customerId: actors.clientId,
        dueDate: scenario.invoice.dueInDays
          ? new Date(Date.now() + scenario.invoice.dueInDays * 24 * 60 * 60 * 1000)
          : null,
        paidAt: scenario.invoice.paidDaysAgo
          ? new Date(Date.now() - scenario.invoice.paidDaysAgo * 24 * 60 * 60 * 1000)
          : null,
      },
    });
  }

  if (scenario.supportTicket) {
    await prisma.supportTicket.create({
      data: {
        subject: scenario.supportTicket.subject,
        message: scenario.supportTicket.message,
        status: "OPEN",
        priority: "NORMAL",
        contactType: "ADMIN",
        companyId: actors.companyId,
        customerId: actors.clientId,
        relatedOrderId: order.id,
        relatedDeliveryId: delivery.id,
        messages: {
          create: {
            body: scenario.supportTicket.message,
            isStaff: false,
            authorId: actors.clientId,
          },
        },
      },
    });
  }

  return { orderId: order.id, deliveryId: delivery.id };
}

export async function resetDemoScenario(companyId: string): Promise<{ deliveries: number }> {
  const personas = await prisma.user.findMany({
    where: { companyId },
    include: { role: true },
  });

  const client = personas.find((u) => u.role.systemRole === "CLIENT");
  const driver = personas.find((u) => u.role.systemRole === "DRIVER");

  if (!client || !driver) {
    throw new Error("DEMO_PERSONAS_MISSING");
  }

  const actors: DemoActors = {
    companyId,
    clientId: client.id,
    clientEmail: client.email,
    driverId: driver.id,
    driverName: `${driver.firstName} ${driver.lastName}`,
  };

  await purgeDemoTransactionalData(companyId);
  await ensureRecurringOrder(actors);

  const scenarios = buildScenario();
  for (const scenario of scenarios) {
    await createScenarioDelivery(actors, scenario);
  }

  await prisma.driverLocation.upsert({
    where: { driverId: driver.id },
    create: {
      driverId: driver.id,
      latitude: 48.8698,
      longitude: 2.3078,
      accuracy: 12,
    },
    update: {
      latitude: 48.8698,
      longitude: 2.3078,
      accuracy: 12,
    },
  });

  const addressCount = await prisma.customerAddress.count({
    where: { userId: client.id },
  });
  if (addressCount === 0) {
    await prisma.customerAddress.createMany({
      data: [
        {
          userId: client.id,
          label: "Siège",
          address: "12 Rue de Rivoli",
          city: "Paris",
          postalCode: "75001",
          isDefault: true,
        },
        {
          userId: client.id,
          label: "Entrepôt",
          address: "9 Rue de la Gare",
          city: "Montreuil",
          postalCode: "93100",
          isDefault: false,
        },
      ],
    });
  }

  return { deliveries: scenarios.length };
}
