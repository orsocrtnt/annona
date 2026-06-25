import { prisma } from "@/services/prisma/client";
import type { DeliveryStatus } from "@prisma/client";
import { formatDriverFromParts } from "@/lib/format/person-labels";

const DRIVER_CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;

function isDriverContactEligible(
  status: DeliveryStatus,
  completedAt: Date | null
): boolean {
  if (status === "IN_DELIVERY" || status === "PURCHASING" || status === "ASSIGNED") return true;
  if (status === "DELIVERED" && completedAt) {
    return Date.now() - completedAt.getTime() < DRIVER_CONTACT_WINDOW_MS;
  }
  return false;
}

export async function getSupportContactsForClient(
  customerId: string,
  companyId: string | null | undefined,
  deliveryId?: string
) {
  if (!companyId) {
    return { recommended: "ADMIN" as const, admin: null, driver: null, delivery: null };
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      email: true,
      phone: true,
      users: {
        where: { role: { systemRole: "COMPANY_ADMIN" }, status: "ACTIVE" },
        take: 1,
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
    },
  });

  const adminUser = company?.users[0];
  const admin = {
    name: adminUser
      ? `${adminUser.firstName} ${adminUser.lastName}`
      : company?.name ?? "Administrateur",
    email: adminUser?.email ?? company?.email ?? null,
    phone: adminUser?.phone ?? company?.phone ?? null,
  };

  let delivery = null;
  let driver = null;

  if (deliveryId) {
    delivery = await prisma.delivery.findFirst({
      where: { id: deliveryId, customerId },
      select: {
        id: true,
        reference: true,
        status: true,
        completedAt: true,
        driverName: true,
        driver: {
          select: { firstName: true, lastName: true, phone: true },
        },
      },
    });

    if (delivery && isDriverContactEligible(delivery.status, delivery.completedAt)) {
      const d = delivery.driver;
      driver = {
        name: formatDriverFromParts(d, delivery.driverName),
        phone: d?.phone ?? null,
        deliveryReference: delivery.reference,
      };
    }
  } else {
    const activeDelivery = await prisma.delivery.findFirst({
      where: {
        customerId,
        OR: [
          { status: { in: ["IN_DELIVERY", "PURCHASING", "ASSIGNED"] } },
          {
            status: "DELIVERED",
            completedAt: { gte: new Date(Date.now() - DRIVER_CONTACT_WINDOW_MS) },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        reference: true,
        status: true,
        completedAt: true,
        driverName: true,
        driver: {
          select: { firstName: true, lastName: true, phone: true },
        },
      },
    });

    if (activeDelivery) {
      delivery = activeDelivery;
      const d = activeDelivery.driver;
      driver = {
        name: formatDriverFromParts(d, activeDelivery.driverName),
        phone: d?.phone ?? null,
        deliveryReference: activeDelivery.reference,
      };
    }
  }

  return {
    recommended: driver ? ("DRIVER" as const) : ("ADMIN" as const),
    admin,
    driver,
    delivery,
  };
}
