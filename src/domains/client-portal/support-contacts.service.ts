import { prisma } from "@/services/prisma/client";
import { getPortalShowDriverPhone } from "@/domains/company/portal-settings.service";

/** Le livreur reste joignable pendant sa tournée et les 24 h qui suivent la livraison. */
const DRIVER_CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Contacts proposés au client pour une réclamation : l'administrateur de l'entreprise et, si une
 * commande de son commerçant est en tournée (ou livrée depuis moins de 24 h), le prénom du livreur.
 * Le nom de famille du livreur ne sort jamais ; son téléphone seulement si l'entreprise l'autorise.
 */
export async function getSupportContactsForClient(
  customerId: string,
  companyId: string | null | undefined,
  orderId?: string
) {
  if (!companyId) {
    return { recommended: "ADMIN" as const, admin: null, driver: null, delivery: null };
  }

  const [adminUser, company] = await Promise.all([
    prisma.user.findFirst({
      where: { companyId, role: { systemRole: "ADMIN" }, status: "ACTIVE" },
      orderBy: { createdAt: "asc" },
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, email: true, phone: true } }),
  ]);

  const admin = {
    name: adminUser ? `${adminUser.firstName} ${adminUser.lastName}` : company?.name ?? "Administrateur",
    email: adminUser?.email ?? company?.email ?? null,
    phone: adminUser?.phone ?? company?.phone ?? null,
  };

  const showDriverPhone = await getPortalShowDriverPhone(companyId);
  const stop = await prisma.stop.findFirst({
    where: {
      companyId,
      ...(orderId ? { orderId } : {}),
      order: { is: { companyId, merchant: { is: { users: { some: { id: customerId, companyId } } } } } },
      round: { is: { companyId, driverId: { not: null } } },
      OR: [
        { status: "PENDING", round: { is: { status: "IN_PROGRESS" } } },
        { status: "DELIVERED", deliveredAt: { gte: new Date(Date.now() - DRIVER_CONTACT_WINDOW_MS) } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      status: true,
      order: { select: { id: true, reference: true } },
      round: { select: { driver: { select: { firstName: true, phone: true, companyId: true } } } },
    },
  });

  const driverUser = stop?.round.driver?.companyId === companyId ? stop.round.driver : null;
  const driver = stop && driverUser
    ? {
        name: driverUser.firstName || "Livreur",
        phone: showDriverPhone ? driverUser.phone ?? null : null,
        deliveryReference: stop.order.reference,
      }
    : null;

  return {
    recommended: driver ? ("DRIVER" as const) : ("ADMIN" as const),
    admin,
    driver,
    delivery: stop ? { id: stop.order.id, reference: stop.order.reference, status: stop.status } : null,
  };
}
