/**
 * TOUR-1 — suivi en direct du jour (ADM-04, ADM-08, ENF-04) pour le tableau de bord de l'administrateur :
 * commandes du jour par statut, tournées (livrés, restants, incidents), incidents signalés avec photo,
 * et position du livreur **seulement pendant sa tournée** : tournée IN_PROGRESS et position reçue
 * après son démarrage. L'écran se rafraîchit par interrogation périodique (TanStack Query).
 */
import type { OrderStatus, PrismaClient } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { slotLabel } from "@/domains/order/merchant-order.service";
import { companyToday, deliveryDateToDb } from "@/domains/order/order-deadline";
import { loadStopDetails, readStopSources } from "@/domains/round/round-admin.service";
import { nextPendingStop, roundProgress } from "@/domains/round/round-rules";
import type { LiveDashboard, LiveIncident, LiveRound } from "@/domains/round/round.types";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";

export type LiveDb = Pick<PrismaClient, "company" | "slot" | "round" | "stop" | "order" | "orderLine" | "merchant" | "user" | "driverLocation">;

type LiveCompany = { id: string; timezone: string; depotLatitude: number | null; depotLongitude: number | null };

const nullableNumber = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isFinite(value));

/**
 * Entreprise du compte connecté (lue par le garde avec tous ses champs) réduite à ce dont le tableau de bord a
 * besoin, ou `null` si un champ manque ou est mal typé : le service relit alors l'entreprise.
 */
export function liveCompanyFrom(value: unknown): LiveCompany | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.timezone !== "string" || !row.timezone) return null;
  if (!nullableNumber(row.depotLatitude) || !nullableNumber(row.depotLongitude)) return null;
  return { id: row.id, timezone: row.timezone, depotLatitude: row.depotLatitude, depotLongitude: row.depotLongitude };
}

/**
 * LOT1-D9 : deux vagues de lectures en parallèle au lieu de quatre à la suite. L'entreprise vient du compte
 * connecté (`company`, déjà lu par le garde) ; lignes et commerces des commandes du jour sont lus avec les arrêts.
 */
export async function getLiveDashboard(
  companyId: string,
  options: { now?: Date; db?: LiveDb; company?: LiveCompany | null } = {}
): Promise<LiveDashboard> {
  const db = options.db ?? (prisma as unknown as LiveDb);
  const now = options.now ?? new Date();
  const company =
    options.company?.id === companyId
      ? options.company
      : await db.company.findUnique({
          where: { id: companyId },
          select: { id: true, timezone: true, depotLatitude: true, depotLongitude: true },
        });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  const date = companyToday(now, company.timezone);
  const dbDate = deliveryDateToDb(date);

  const [orders, rounds, slots] = await Promise.all([
    db.order.findMany({ where: { companyId, deliveryDate: dbDate }, select: { id: true, reference: true, status: true, merchantId: true } }),
    db.round.findMany({
      where: { companyId, date: dbDate, status: { not: "CANCELLED" } },
      select: { id: true, name: true, slotId: true, status: true, driverId: true, startedAt: true, completedAt: true },
    }),
    db.slot.findMany({ where: { companyId }, select: { id: true, label: true, startTime: true, endTime: true } }),
  ]);
  const byStatus: Partial<Record<OrderStatus, number>> = {};
  for (const order of orders) byStatus[order.status] = (byStatus[order.status] ?? 0) + 1;
  // Commandes du jour : tout sauf brouillons jamais validés et annulations.
  const total = orders.filter((order) => order.status !== "DRAFT" && order.status !== "CANCELLED").length;

  const driverIds = [...new Set(rounds.map((round) => round.driverId).filter((id): id is string => Boolean(id)))];
  // Les arrêts du jour portent des commandes du jour : lignes et commerces de ces commandes couvrent tous les arrêts.
  const [stops, drivers, locations, sources] = await Promise.all([
    rounds.length
      ? db.stop.findMany({
          where: { companyId, roundId: { in: rounds.map((round) => round.id) } },
          select: {
            id: true,
            roundId: true,
            orderId: true,
            sequence: true,
            status: true,
            estimatedArrivalAt: true,
            deliveredAt: true,
            incidentCode: true,
            incidentComment: true,
            incidentPhotoPath: true,
            incidentAt: true,
          },
        })
      : Promise.resolve([]),
    driverIds.length
      ? db.user.findMany({ where: { companyId, id: { in: driverIds } }, select: { id: true, firstName: true, lastName: true } })
      : Promise.resolve([]),
    driverIds.length
      ? db.driverLocation.findMany({ where: { companyId, driverId: { in: driverIds } }, select: { driverId: true, latitude: true, longitude: true, updatedAt: true } })
      : Promise.resolve([]),
    rounds.length
      ? readStopSources(db, companyId, orders.map((order) => order.id), [...new Set(orders.map((order) => order.merchantId))])
      : Promise.resolve({ lines: [], merchants: [] }),
  ]);
  const { views } = await loadStopDetails(db, companyId, stops, orders, sources);
  const driverName = new Map(drivers.map((driver) => [driver.id, `${driver.firstName} ${driver.lastName}`.trim()]));
  const locationOf = new Map(locations.map((location) => [location.driverId, location]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  const sortKey = (round: { id: string; name: string }) => {
    const source = rounds.find((row) => row.id === round.id);
    return `${slotById.get(source?.slotId ?? "")?.startTime ?? ""}|${round.name}`;
  };
  const liveRounds: LiveRound[] = rounds
    .map((round) => {
      const own = stops.filter((stop) => stop.roundId === round.id).sort((a, b) => a.sequence - b.sequence);
      const location = round.driverId ? locationOf.get(round.driverId) : undefined;
      // ENF-04 : position montrée seulement pendant la tournée, et seulement si reçue depuis son démarrage.
      const showPosition = round.status === "IN_PROGRESS" && location && round.startedAt && location.updatedAt >= round.startedAt;
      const delivered = own.filter((stop) => stop.deliveredAt).map((stop) => stop.deliveredAt!.getTime());
      const next = nextPendingStop(own);
      const slot = slotById.get(round.slotId);
      return {
        id: round.id,
        name: round.name ?? "",
        slotLabel: slot ? slotLabel(slot) : "",
        status: round.status,
        driverName: round.driverId ? driverName.get(round.driverId) ?? null : null,
        progress: roundProgress(own),
        startedAt: round.startedAt?.toISOString() ?? null,
        completedAt: round.completedAt?.toISOString() ?? null,
        lastDeliveredAt: delivered.length ? new Date(Math.max(...delivered)).toISOString() : null,
        nextStopName: next ? views.get(next.id)?.merchantName ?? null : null,
        driverPosition: showPosition
          ? { latitude: location!.latitude, longitude: location!.longitude, updatedAt: location!.updatedAt.toISOString() }
          : null,
        stops: own.map((stop) => {
          const view = views.get(stop.id)!;
          return { id: stop.id, sequence: stop.sequence, status: stop.status, merchantName: view.merchantName, latitude: view.latitude, longitude: view.longitude };
        }),
      };
    })
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b), "fr"));

  const roundById = new Map(liveRounds.map((round) => [round.id, round]));
  const incidents: LiveIncident[] = stops
    .filter((stop) => stop.incidentAt)
    .sort((a, b) => b.incidentAt!.getTime() - a.incidentAt!.getTime())
    .map((stop) => {
      const round = roundById.get(stop.roundId);
      return {
        stopId: stop.id,
        roundName: round?.name ?? "",
        driverName: round?.driverName ?? null,
        merchantName: views.get(stop.id)?.merchantName ?? "",
        code: stop.incidentCode ?? "OTHER",
        comment: stop.incidentComment,
        at: stop.incidentAt!.toISOString(),
        hasPhoto: Boolean(stop.incidentPhotoPath),
        stopStatus: stop.status,
      };
    });

  const progress = roundProgress(stops);
  return {
    date,
    generatedAt: now.toISOString(),
    orders: { total, byStatus },
    totals: {
      rounds: liveRounds.length,
      inProgress: liveRounds.filter((round) => round.status === "IN_PROGRESS").length,
      completed: liveRounds.filter((round) => round.status === "COMPLETED").length,
      stops: progress.total,
      delivered: progress.delivered,
      incidents: progress.incidents,
      remaining: progress.remaining,
    },
    rounds: liveRounds,
    incidents,
    depot:
      company.depotLatitude !== null && company.depotLongitude !== null
        ? { latitude: company.depotLatitude, longitude: company.depotLongitude }
        : null,
  };
}

/** Photo d'incident d'un arrêt, pour l'administrateur de la même entreprise (PLA-01). */
export async function readStopIncidentPhoto(
  companyId: string,
  stopId: string,
  read: (path: string, companyId: string, stopId: string) => Promise<Buffer | null>,
  db: Pick<PrismaClient, "stop"> = prisma
) {
  const stop = await db.stop.findFirst({ where: { id: stopId, companyId }, select: { incidentPhotoPath: true } });
  if (!stop?.incidentPhotoPath) return null;
  const bytes = await read(stop.incidentPhotoPath, companyId, stopId);
  if (!bytes) return null;
  return { bytes, contentType: stop.incidentPhotoPath.endsWith(".png") ? "image/png" : "image/jpeg" };
}
