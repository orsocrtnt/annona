/**
 * Recette LOT1-D5 (suivi des livreurs) : remet une tournée de démonstration du jour en état « assignée »
 * pour qu'un livreur la démarre dans le navigateur. Les deux premiers arrêts restent livrés, les autres
 * repassent « à livrer » (commandes préparées, quantités livrées effacées). Données de démonstration
 * uniquement (`demo_`), annona-dev uniquement ; `npm run db:seed` remet l'historique d'origine.
 *
 * Usage : npx dotenv -e .env.local -- npx tsx scripts/e2e/lot1-d5-round-fixture.ts
 */
import { PrismaClient } from "@prisma/client";
import { validateDevEnvironment } from "../env2/verify-dev-env";
import { companyToday, deliveryDateToDb } from "../../src/domains/order/order-deadline";

const COMPANY_ID = "demo_company_boulangerie";
const ROUND_NAME = "Tournée Sud matin · A";
const KEEP_DELIVERED = 2;

async function main() {
  const errors = validateDevEnvironment(process.env);
  if (errors.length > 0) throw new Error(`Base de développement non vérifiée : ${errors.join(", ")}`);
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findUniqueOrThrow({ where: { id: COMPANY_ID }, select: { timezone: true } });
    const date = deliveryDateToDb(companyToday(new Date(), company.timezone));
    const round = await prisma.round.findFirst({
      where: { companyId: COMPANY_ID, date, name: ROUND_NAME, id: { startsWith: "demo_" } },
      select: { id: true, driverId: true },
    });
    if (!round?.driverId) throw new Error(`Tournée « ${ROUND_NAME} » du jour introuvable : relancer npm run db:seed.`);
    const stops = await prisma.stop.findMany({ where: { roundId: round.id }, orderBy: { sequence: "asc" }, select: { id: true, orderId: true } });
    const pending = stops.slice(KEEP_DELIVERED);
    const pendingOrderIds = pending.map((stop) => stop.orderId);
    await prisma.$transaction([
      prisma.round.update({ where: { id: round.id }, data: { status: "ASSIGNED", startedAt: null, completedAt: null } }),
      prisma.stop.updateMany({
        where: { id: { in: pending.map((stop) => stop.id) } },
        data: { status: "PENDING", deliveredAt: null, incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null },
      }),
      prisma.order.updateMany({ where: { id: { in: pendingOrderIds } }, data: { status: "PREPARED", deliveredAt: null } }),
      prisma.orderLine.updateMany({ where: { orderId: { in: pendingOrderIds } }, data: { quantityDelivered: null } }),
      prisma.driverLocation.deleteMany({ where: { driverId: round.driverId } }),
    ]);
    console.log(JSON.stringify({ roundId: round.id, round: ROUND_NAME, stops: stops.length, pending: pending.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
