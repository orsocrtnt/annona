/**
 * TOUR-1 — application livreur (LIV-01 à LIV-06, ENF-04, critères de recette 6, 7 et 8).
 *
 * - Le livreur ne voit que ses tournées validées (ASSIGNED, IN_PROGRESS, COMPLETED) de son entreprise :
 *   une tournée en brouillon, d'un autre livreur ou d'une autre entreprise donne 404.
 * - Jour affiché : aujourd'hui (fuseau de l'entreprise) ; sinon une tournée restée en cours ; sinon la
 *   prochaine tournée validée (consultable la veille, démarrable seulement le jour même).
 * - « Livré » (LIV-03) et « Problème » (LIV-05) sont idempotents (LIV-06) : la file hors réseau de
 *   l'application peut les rejouer sans doublon. « Livré » une seconde fois ne change rien ; un problème
 *   rejoué avec la même heure (prise sur le téléphone au moment du geste) n'est pas réécrit.
 * - « Livré » horodate l'arrêt, passe la commande en DELIVERED et fixe la quantité livrée à la quantité
 *   commandée quand aucun manquant n'a été signalé (même règle que « préparée », BOU-05).
 * - Quand plus aucun arrêt n'est à livrer, la tournée est terminée et la position du livreur effacée
 *   (ENF-04 : position utilisée seulement pendant la tournée).
 */
import type { PrismaClient, RoundStatus } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { slotLabel } from "@/domains/order/merchant-order.service";
import { companyToday, deliveryDateKey, deliveryDateToDb } from "@/domains/order/order-deadline";
import { loadStopDetails } from "@/domains/round/round-admin.service";
import {
  deliveryInstant,
  DRIVER_VISIBLE_ROUND_STATUSES,
  roundProgress,
  type StopIncidentCode,
} from "@/domains/round/round-rules";
import type { DriverRoundsData, DriverRoundView, DriverStopView } from "@/domains/round/round.types";
import { DomainRuleError } from "@/lib/errors/domain-rule-error";
import { longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";

export type DriverRoundDb = Pick<
  PrismaClient,
  "company" | "slot" | "round" | "stop" | "order" | "orderLine" | "merchant" | "product" | "driverLocation" | "$transaction"
>;

export interface DriverActor {
  companyId: string;
  userId: string;
}

export interface PhotoStore {
  upload(input: { companyId: string; stopId: string; bytes: Buffer; contentType: string }): Promise<string>;
  remove(input: { companyId: string; stopId: string; path: string }): Promise<void>;
}

const t = fr.driverRound;
const db0 = () => prisma as unknown as DriverRoundDb;

async function companyOf(db: Pick<DriverRoundDb, "company">, companyId: string) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  if (!company) throw new DomainRuleError(404, "Entreprise introuvable.", "COMPANY_NOT_FOUND");
  return company;
}

const STOP_SELECT = {
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
} as const;

export async function getDriverRounds(actor: DriverActor, options: { now?: Date; db?: DriverRoundDb } = {}): Promise<DriverRoundsData> {
  const db = options.db ?? db0();
  const now = options.now ?? new Date();
  // Lu en même temps que l'entreprise : à partir de la veille UTC (couvre tous les fuseaux), trié ensuite.
  const utcYesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const [company, allCandidates] = await Promise.all([
    companyOf(db, actor.companyId),
    db.round.findMany({
      where: {
        companyId: actor.companyId,
        driverId: actor.userId,
        status: { in: [...DRIVER_VISIBLE_ROUND_STATUSES] },
        OR: [{ date: { gte: deliveryDateToDb(utcYesterday) } }, { status: "IN_PROGRESS" }],
      },
      select: { id: true, name: true, date: true, slotId: true, status: true, startedAt: true, completedAt: true, createdAt: true },
    }),
  ]);
  const today = companyToday(now, company.timezone);
  const candidates = allCandidates.filter((round) => round.status === "IN_PROGRESS" || deliveryDateKey(round.date) >= today);
  const dates = [...new Set(candidates.map((round) => deliveryDateKey(round.date)))].sort();
  const inProgressDate = candidates.filter((round) => round.status === "IN_PROGRESS").map((round) => deliveryDateKey(round.date)).sort()[0];
  const date = dates.includes(today) ? today : inProgressDate ?? dates.find((value) => value > today) ?? null;
  if (!date) return { today, date: null, rounds: [] };

  const rounds = candidates.filter((round) => deliveryDateKey(round.date) === date);
  // Catalogue entier (une centaine de produits, ENF-06) lu en parallèle : un aller-retour de moins.
  const [slots, stops, dateOrders, products] = await Promise.all([
    db.slot.findMany({ where: { companyId: actor.companyId, id: { in: [...new Set(rounds.map((round) => round.slotId))] } } }),
    db.stop.findMany({ where: { companyId: actor.companyId, roundId: { in: rounds.map((round) => round.id) } }, select: STOP_SELECT }),
    db.order.findMany({ where: { companyId: actor.companyId, deliveryDate: deliveryDateToDb(date) }, select: { id: true, reference: true, status: true, merchantId: true } }),
    db.product.findMany({ where: { companyId: actor.companyId }, select: { id: true, name: true, unit: true, sortOrder: true } }),
  ]);
  const { views, lines } = await loadStopDetails(db, actor.companyId, stops, dateOrders);
  const productById = new Map(products.map((product) => [product.id, product]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  const sortKey = (round: { id: string; name: string }) => {
    const source = rounds.find((row) => row.id === round.id);
    return `${slotById.get(source?.slotId ?? "")?.startTime ?? ""}|${round.name}`;
  };
  const views_: DriverRoundView[] = rounds
    .map((round) => {
      const slot = slotById.get(round.slotId);
      const own: DriverStopView[] = stops
        .filter((stop) => stop.roundId === round.id)
        .sort((a, b) => a.sequence - b.sequence)
        .map((stop) => {
          const view = views.get(stop.id)!;
          return {
            id: view.id,
            sequence: view.sequence,
            status: view.status,
            orderId: view.orderId,
            orderReference: view.orderReference,
            merchantName: view.merchantName,
            address: view.address,
            latitude: view.latitude,
            longitude: view.longitude,
            accessInstructions: view.accessInstructions,
            contactPhone: view.contactPhone,
            packages: view.packages,
            items: view.items,
            deliveredAt: view.deliveredAt,
            incident: view.incident,
            lines: (lines.get(stop.orderId) ?? [])
              .map((line) => ({ product: productById.get(line.productId), quantity: line.quantityDelivered ?? line.quantityOrdered }))
              .filter((line) => line.quantity > 0)
              .sort((a, b) => (a.product?.sortOrder ?? 0) - (b.product?.sortOrder ?? 0) || (a.product?.name ?? "").localeCompare(b.product?.name ?? "", "fr"))
              .map((line) => ({ name: line.product?.name ?? "", unit: line.product?.unit ?? "", quantity: line.quantity })),
          };
        });
      const roundDate = deliveryDateKey(round.date);
      return {
        id: round.id,
        name: round.name ?? "",
        date: roundDate,
        slotLabel: slot ? slotLabel(slot) : "",
        status: round.status,
        startedAt: round.startedAt?.toISOString() ?? null,
        completedAt: round.completedAt?.toISOString() ?? null,
        canStart: round.status === "ASSIGNED" && roundDate <= today,
        progress: roundProgress(own),
        stops: own,
      };
    })
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b), "fr"));

  return { today, date, rounds: views_ };
}

/** Tournée du livreur (sinon 404 : brouillon, autre livreur, autre entreprise). */
async function ownRound(db: Pick<DriverRoundDb, "round">, actor: DriverActor, roundId: string) {
  const round = await db.round.findFirst({ where: { id: roundId, companyId: actor.companyId, driverId: actor.userId } });
  if (!round || !DRIVER_VISIBLE_ROUND_STATUSES.includes(round.status)) throw new DomainRuleError(404, t.errors.roundNotFound, "ROUND_NOT_FOUND");
  return round;
}

/** Arrêt d'une tournée du livreur (sinon 404, y compris un arrêt déplacé vers la tournée d'un autre). */
async function ownStop(db: Pick<DriverRoundDb, "round" | "stop">, actor: DriverActor, stopId: string) {
  const stop = await db.stop.findFirst({ where: { id: stopId, companyId: actor.companyId } });
  if (!stop) throw new DomainRuleError(404, t.errors.stopNotFound, "STOP_NOT_FOUND");
  const round = await db.round.findFirst({ where: { id: stop.roundId, companyId: actor.companyId, driverId: actor.userId } });
  if (!round || !DRIVER_VISIBLE_ROUND_STATUSES.includes(round.status)) throw new DomainRuleError(404, t.errors.stopNotFound, "STOP_NOT_FOUND");
  return { stop, round };
}

/** « Démarrer la tournée » : le jour même seulement. Idempotent. */
export async function startRound(actor: DriverActor, roundId: string, options: { at?: string | null; now?: Date; db?: DriverRoundDb } = {}) {
  const db = options.db ?? db0();
  const now = options.now ?? new Date();
  const company = await companyOf(db, actor.companyId);
  const round = await ownRound(db, actor, roundId);
  if (round.status !== "ASSIGNED") return { id: round.id, status: round.status, startedAt: round.startedAt?.toISOString() ?? null };
  if (deliveryDateKey(round.date) > companyToday(now, company.timezone)) {
    throw new DomainRuleError(409, t.errors.notToday, "ROUND_NOT_TODAY", { date: longDeliveryDateLabel(deliveryDateKey(round.date)) });
  }
  const startedAt = deliveryInstant(options.at, now);
  const { count } = await db.round.updateMany({ where: { id: round.id, status: "ASSIGNED" }, data: { status: "IN_PROGRESS", startedAt } });
  const current = count > 0 ? { status: "IN_PROGRESS" as RoundStatus, startedAt } : await ownRound(db, actor, roundId);
  return { id: round.id, status: current.status, startedAt: current.startedAt?.toISOString() ?? null };
}

type RoundTx = Pick<DriverRoundDb, "round" | "stop" | "driverLocation">;

/** Démarre la tournée si besoin (action faite sans « Démarrer », ex. hors réseau) et la termine s'il ne reste rien. */
async function settleRound(tx: RoundTx, actor: DriverActor, round: { id: string; status: RoundStatus; startedAt: Date | null }, at: Date, now: Date) {
  let status = round.status;
  if (status === "ASSIGNED") {
    await tx.round.update({ where: { id: round.id }, data: { status: "IN_PROGRESS", startedAt: round.startedAt ?? at } });
    status = "IN_PROGRESS";
  }
  if (status !== "IN_PROGRESS") return status;
  const stops = await tx.stop.findMany({ where: { companyId: actor.companyId, roundId: round.id }, select: { status: true } });
  if (stops.length === 0 || stops.some((stop) => stop.status === "PENDING")) return status;
  await tx.round.update({ where: { id: round.id }, data: { status: "COMPLETED", completedAt: now } });
  // ENF-04 : plus de tournée en cours, la dernière position n'est plus utilisée.
  const other = await tx.round.findFirst({ where: { companyId: actor.companyId, driverId: actor.userId, status: "IN_PROGRESS" }, select: { id: true } });
  if (!other) await tx.driverLocation.deleteMany({ where: { driverId: actor.userId } });
  return "COMPLETED" as RoundStatus;
}

/** LIV-03 : « Livré » en un appui, horodaté automatiquement. Idempotent (LIV-06). */
export async function markStopDelivered(actor: DriverActor, stopId: string, options: { at?: string | null; now?: Date; db?: DriverRoundDb } = {}) {
  const db = options.db ?? db0();
  const now = options.now ?? new Date();
  const { stop, round } = await ownStop(db, actor, stopId);
  if (stop.status === "DELIVERED") {
    return { stopId, status: stop.status, deliveredAt: stop.deliveredAt?.toISOString() ?? null, roundStatus: round.status, replayed: true };
  }
  const at = deliveryInstant(options.at, now);
  return db.$transaction(async (tx) => {
    const { count } = await tx.stop.updateMany({
      where: { id: stopId, companyId: actor.companyId, status: { not: "DELIVERED" } },
      data: { status: "DELIVERED", deliveredAt: at },
    });
    if (count === 0) {
      const current = await tx.stop.findFirst({ where: { id: stopId, companyId: actor.companyId } });
      return { stopId, status: "DELIVERED" as const, deliveredAt: current?.deliveredAt?.toISOString() ?? null, roundStatus: round.status, replayed: true };
    }
    const order = await tx.order.findFirst({ where: { id: stop.orderId, companyId: actor.companyId }, select: { id: true, status: true } });
    if (order && order.status !== "CANCELLED") {
      const lines = await tx.orderLine.findMany({ where: { companyId: actor.companyId, orderId: order.id }, select: { id: true, quantityOrdered: true, quantityDelivered: true } });
      for (const line of lines) {
        if (line.quantityDelivered === null) await tx.orderLine.update({ where: { id: line.id }, data: { quantityDelivered: line.quantityOrdered } });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveredAt: at } });
    }
    const roundStatus = await settleRound(tx, actor, round, at, now);
    return { stopId, status: "DELIVERED" as const, deliveredAt: at.toISOString(), roundStatus, replayed: false };
  });
}

/**
 * LIV-05 : problème (client absent, refus, colis abîmé, autre) avec commentaire et photo. Un arrêt déjà
 * livré garde son statut (ex. colis abîmé constaté à la remise) ; sinon il passe en INCIDENT. Rejouer
 * le même signalement (même motif, même heure) ne réécrit rien et n'envoie pas de seconde photo.
 */
export async function reportStopIncident(
  actor: DriverActor,
  stopId: string,
  input: { code: StopIncidentCode; comment?: string | null; at?: string | null; photo?: { bytes: Buffer; contentType: string } | null },
  options: { now?: Date; db?: DriverRoundDb; photos?: PhotoStore } = {}
) {
  const db = options.db ?? db0();
  const now = options.now ?? new Date();
  const { stop, round } = await ownStop(db, actor, stopId);
  const at = deliveryInstant(input.at, now);
  const comment = input.comment?.trim() || null;
  if (stop.incidentAt && stop.incidentAt.getTime() === at.getTime() && stop.incidentCode === input.code) {
    return { stopId, status: stop.status, incidentAt: stop.incidentAt.toISOString(), hasPhoto: Boolean(stop.incidentPhotoPath), roundStatus: round.status, replayed: true };
  }
  let photoPath: string | null = null;
  if (input.photo) {
    if (!options.photos) throw new DomainRuleError(503, t.errors.photoUnavailable, "PHOTO_STORE_UNAVAILABLE");
    photoPath = await options.photos.upload({ companyId: actor.companyId, stopId, bytes: input.photo.bytes, contentType: input.photo.contentType });
  }
  const result = await db.$transaction(async (tx) => {
    const current = await tx.stop.findFirst({ where: { id: stopId, companyId: actor.companyId } });
    if (!current) throw new DomainRuleError(404, t.errors.stopNotFound, "STOP_NOT_FOUND");
    const status = current.status === "DELIVERED" ? "DELIVERED" : "INCIDENT";
    await tx.stop.update({
      where: { id: stopId },
      data: { status, incidentCode: input.code, incidentComment: comment, incidentPhotoPath: photoPath, incidentAt: at },
    });
    const roundStatus = await settleRound(tx, actor, round, at, now);
    return { previousPhoto: current.incidentPhotoPath, status, roundStatus };
  });
  if (result.previousPhoto && result.previousPhoto !== photoPath && options.photos) {
    await options.photos.remove({ companyId: actor.companyId, stopId, path: result.previousPhoto }).catch(() => undefined);
  }
  return { stopId, status: result.status, incidentAt: at.toISOString(), hasPhoto: Boolean(photoPath), roundStatus: result.roundStatus, replayed: false };
}
