/** Lecture seule. Exécuter avec les variables de l'environnement explicitement choisi. */
import { prisma } from "../src/services/prisma/client";
import { proposeLegacyDeliveryRecovery } from "../src/domains/invoice/legacy-billing-recovery";

async function main() {
  const orders = await prisma.order.findMany({
    where: { OR: [{ status: { in: ["INVOICED", "PAID"] } }, { deliveries: { some: { status: { in: ["INVOICED", "PAID"] } } } }] },
    select: {
      id: true, companyId: true, status: true, updatedAt: true,
      invoices: { select: { id: true, status: true, paidAt: true } },
      deliveries: { select: {
        id: true, status: true, completedAt: true, podOutcome: true, updatedAt: true,
        trackingEvents: { select: { label: true, occurredAt: true }, orderBy: { occurredAt: "asc" } },
      } },
    },
  });
  console.log(JSON.stringify({ readOnly: true, generatedAt: new Date(), orders: orders.map(order => ({
    ...order, deliveries: order.deliveries.map(delivery => ({ ...delivery, proposal: proposeLegacyDeliveryRecovery(delivery) })),
  })) }, null, 2));
}
main().catch(() => { console.error("Diagnostic impossible ; vérifier l’accès à la base choisie."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
