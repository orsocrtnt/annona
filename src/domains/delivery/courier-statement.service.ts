import { prisma } from "@/services/prisma/client";
import { buildCourierStatement, parisDayStart } from "./courier-statement";

/** Plafond de lignes par relevé : au-delà, le relevé est tronqué et signalé comme tel. */
export const COURIER_STATEMENT_MAX_ROWS = 5000;

const FINISHED_STATUSES = ["DELIVERED", "FAILED", "INVOICED", "PAID"] as const;

/**
 * Courses terminées par livreur sur une période (dates incluses, heure de Paris). L'entreprise est
 * toujours celle de la session : un identifiant de livreur d'une autre entreprise ne renvoie rien.
 */
export async function getCourierStatement(input: { companyId: string; from: string; to: string; driverId?: string }) {
  const start = parisDayStart(input.from);
  // Fin exclusive : minuit (Paris) du lendemain du dernier jour demandé.
  const endExclusive = parisDayStart(new Date(Date.parse(input.to) + 86_400_000).toISOString().slice(0, 10));

  const rows = await prisma.delivery.findMany({
    where: {
      companyId: input.companyId,
      driverId: input.driverId ?? { not: null },
      status: { in: [...FINISHED_STATUSES] },
      completedAt: { gte: start, lt: endExclusive },
    },
    orderBy: { completedAt: "asc" },
    take: COURIER_STATEMENT_MAX_ROWS + 1,
    select: {
      id: true,
      reference: true,
      status: true,
      driverId: true,
      driverName: true,
      missionStartedAt: true,
      completedAt: true,
      address: true,
      city: true,
      driver: { select: { firstName: true, lastName: true } },
    },
  });

  const truncated = rows.length > COURIER_STATEMENT_MAX_ROWS;
  const statement = buildCourierStatement(
    rows.slice(0, COURIER_STATEMENT_MAX_ROWS).map((row) => ({
      deliveryId: row.id,
      reference: row.reference,
      driverId: row.driverId!,
      driverName:
        [row.driver?.firstName, row.driver?.lastName].filter(Boolean).join(" ") || row.driverName || "Livreur inconnu",
      status: row.status,
      startedAt: row.missionStartedAt,
      completedAt: row.completedAt,
      address: row.address,
      city: row.city,
    }))
  );
  return { ...statement, truncated, from: input.from, to: input.to };
}
