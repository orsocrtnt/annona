import { prisma } from "@/services/prisma/client";
import { DEMO_POOL_KEY } from "@/lib/demo/constants";
import { DEMO_LIVE_WINDOW_MS } from "@/domains/demo/demo-pool.service";

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
    };
  }));
}

/**
 * Remise à neuf demandée par le super admin : l'espace repart en recyclage (mêmes gardes que d'habitude ;
 * un espace en erreur qui le reste retourne en quarantaine). Sans `id` : toutes les démos sauf celles
 * où quelqu'un est en direct. Une démo en préparation n'est jamais touchée.
 * Renvoie le nombre d'espaces mis en file ; la reconstruction se fait ensuite par `maintainDemoPool`.
 */
export async function queueAdminDemoReset(
  target: { id?: string },
  now = new Date(),
  poolKey = DEMO_POOL_KEY
): Promise<number> {
  const rows: EnvironmentRow[] = await prisma.demoPoolEnvironment.findMany({
    where: { poolKey, ...(target.id ? { id: target.id } : {}), state: { in: ["READY", "LEASED", "QUARANTINED"] } },
    select: {
      id: true, companyId: true, slot: true, state: true, leasedAt: true, leaseExpiresAt: true,
      updatedAt: true, lastFailureCode: true, recycleAttempts: true,
    },
  });
  const chosen = target.id ? rows : rows.filter((row) => demoPoolRowStatus(row, now) !== "LIVE");
  let queued = 0;
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
    queued += result.count;
  }
  return queued;
}
