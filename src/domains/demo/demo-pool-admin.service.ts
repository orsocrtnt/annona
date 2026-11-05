import { prisma } from "@/services/prisma/client";
import { DEMO_POOL_KEY } from "@/lib/demo/constants";
import { DEMO_LIVE_WINDOW_MS, DEMO_POOL_JOBS_WAIT_MS, recycleDemoPoolEnvironment } from "@/domains/demo/demo-pool.service";

/**
 * Page « Démos » du super admin (DEMO-LIVE) : ce que l'on sait de chaque espace du stock. Les visiteurs sont
 * anonymes (aucun e-mail, aucune adresse IP) : on ne connaît que les heures et ce qu'ils ont créé dans l'espace.
 */
export type DemoPoolRowStatus = "LIVE" | "IN_USE" | "AVAILABLE" | "PREPARING" | "ERROR";

export interface DemoPoolRow {
  id: string;
  slot: number;
  status: DemoPoolRowStatus;
  openedAt: string | null;
  expiresAt: string | null;
  lastActivityAt: string | null;
  ordersCreated: number;
  ticketsCreated: number;
  failureCode: string | null;
  recycleAttempts: number;
  /** Faux seulement pendant la reconstruction elle-même (PREPARING). */
  resettable: boolean;
}

type EnvironmentRow = {
  id: string;
  companyId: string;
  slot: number;
  state: "PREPARING" | "READY" | "LEASED" | "RECYCLING" | "QUARANTINED";
  leasedAt: Date | null;
  leaseExpiresAt: Date | null;
  updatedAt: Date;
  lastFailureCode: string | null;
  recycleAttempts: number;
};

export function demoPoolRowStatus(row: EnvironmentRow, now: Date): DemoPoolRowStatus {
  if (row.state === "QUARANTINED") return "ERROR";
  if (row.state === "READY") return "AVAILABLE";
  if (row.state === "LEASED" && row.leaseExpiresAt && row.leaseExpiresAt > now) {
    return now.getTime() - row.updatedAt.getTime() <= DEMO_LIVE_WINDOW_MS ? "LIVE" : "IN_USE";
  }
  return "PREPARING";
}

export async function listDemoPoolEnvironments(now = new Date(), poolKey = DEMO_POOL_KEY): Promise<DemoPoolRow[]> {
  const environments: EnvironmentRow[] = await prisma.demoPoolEnvironment.findMany({
    where: { poolKey },
    orderBy: { slot: "asc" },
    select: {
      id: true, companyId: true, slot: true, state: true, leasedAt: true, leaseExpiresAt: true,
      updatedAt: true, lastFailureCode: true, recycleAttempts: true,
    },
  });
  return Promise.all(environments.map(async (row) => {
    const status = demoPoolRowStatus(row, now);
    const inUse = status === "LIVE" || status === "IN_USE";
    // Ce que le visiteur a créé : tout ce qui est postérieur à l'ouverture (le scénario est préparé avant).
    const [ordersCreated, ticketsCreated] = inUse && row.leasedAt
      ? await Promise.all([
          prisma.order.count({ where: { companyId: row.companyId, createdAt: { gte: row.leasedAt } } }),
          prisma.supportTicket.count({ where: { companyId: row.companyId, createdAt: { gte: row.leasedAt } } }),
        ])
      : [0, 0];
    return {
      id: row.id,
      slot: row.slot,
      status,
      openedAt: inUse ? row.leasedAt?.toISOString() ?? null : null,
      expiresAt: inUse ? row.leaseExpiresAt?.toISOString() ?? null : null,
      lastActivityAt: inUse ? row.updatedAt.toISOString() : null,
      ordersCreated,
      ticketsCreated,
      failureCode: status === "ERROR" ? row.lastFailureCode : null,
      recycleAttempts: row.recycleAttempts,
      resettable: row.state !== "PREPARING",
    };
  }));
}

/**
 * Remise à neuf demandée par le super admin : l'espace repart en recyclage (mêmes gardes que d'habitude ;
 * un espace en erreur qui le reste retourne en quarantaine). Sans `id` : toutes les démos sauf celles
 * où quelqu'un est en direct. Une démo en cours de reconstruction (PREPARING) n'est jamais touchée ; une démo
 * en file (RECYCLING, par exemple bloquée par une tâche de fond) peut l'être.
 * Les tâches de fond de la démo bloquées depuis plus d'une heure (notifications de commandes fictives jamais
 * parties) sont abandonnées : sinon elles bloquent la reconstruction et l'espace reste « en erreur ».
 * Renvoie le nombre d'espaces mis en file et `rebuild`, qui reconstruit exactement ces espaces (à lancer
 * après la réponse) ; ceux qui échouent restent en file pour la tâche planifiée.
 */
const RESETTABLE_STATES: Array<"READY" | "LEASED" | "QUARANTINED" | "RECYCLING"> = ["READY", "LEASED", "QUARANTINED", "RECYCLING"];

export async function queueAdminDemoReset(
  target: { id?: string },
  now = new Date(),
  poolKey = DEMO_POOL_KEY
): Promise<{ queued: number; rebuild: () => Promise<void> }> {
  const rows: EnvironmentRow[] = await prisma.demoPoolEnvironment.findMany({
    where: { poolKey, ...(target.id ? { id: target.id } : {}), state: { in: RESETTABLE_STATES } },
    select: {
      id: true, companyId: true, slot: true, state: true, leasedAt: true, leaseExpiresAt: true,
      updatedAt: true, lastFailureCode: true, recycleAttempts: true,
    },
  });
  const chosen = target.id ? rows : rows.filter((row) => demoPoolRowStatus(row, now) !== "LIVE");
  const queuedCompanies: string[] = [];
  const staleBefore = new Date(now.getTime() - DEMO_POOL_JOBS_WAIT_MS);
  for (const row of chosen) {
    // updatedAt inchangé : personne n'a réservé ni recyclé l'espace entre la lecture et l'écriture.
    const result = await prisma.demoPoolEnvironment.updateMany({
      where: { id: row.id, state: row.state, updatedAt: row.updatedAt },
      data: {
        state: "RECYCLING",
        leaseKeyHash: null,
        recycleRequestedAt: now,
        recycleStartedAt: null,
        recycleAttempts: 0,
        lastFailureCode: null,
      },
    });
    if (result.count === 1) {
      await prisma.operationJob.updateMany({
        where: { companyId: row.companyId, status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: staleBefore } },
        data: { status: "FAILED", lastError: "DEMO_RESET_BY_ADMIN", lockedAt: null, completedAt: now },
      });
    }
    if (result.count === 1) queuedCompanies.push(row.companyId);
  }
  return {
    queued: queuedCompanies.length,
    rebuild: async () => {
      for (const companyId of queuedCompanies) {
        try {
          await recycleDemoPoolEnvironment(companyId);
        } catch (error) {
          console.error("Admin demo rebuild failed:", error);
        }
      }
    },
  };
}
