import { prisma } from "@/services/prisma/client";

/** Plafonds par entreprise : protègent le coût et limitent un usage détourné. */
export const ORDER_INTAKE_HOURLY_LIMIT = 60;
export const ORDER_INTAKE_DAILY_LIMIT = 300;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/**
 * Les réservations d'une même entreprise attendent le verrou à tour de rôle : avec l'attente par défaut
 * de Prisma (2 s), dix analyses simultanées sur un pool de 5 échouaient en erreur serveur au lieu d'être
 * servies ou plafonnées (mesuré sur PostgreSQL réel, `npm run test:pg-intake`).
 */
export const ORDER_INTAKE_RESERVE_TX = { maxWait: 10_000, timeout: 15_000 } as const;

export type OrderIntakeUsageStatus = "PENDING" | "SUCCEEDED" | "FAILED";
type UsageDb = Pick<typeof prisma, "orderIntakeUsage" | "$transaction">;

export type ReserveResult =
  | { status: "reserved"; id: string }
  | { status: "rate_limited"; retryAfterSeconds: number };

/**
 * Réserve un appel avant de contacter le modèle. Le verrou consultatif par entreprise sérialise
 * le comptage et l'insertion : deux analyses simultanées ne dépassent pas le plafond.
 * Le journal ne contient ni le texte, ni l'expéditeur, ni l'utilisateur : seulement l'entreprise,
 * le modèle, l'issue et les jetons.
 */
export async function reserveOrderIntakeCall(
  companyId: string,
  model: string,
  now: Date,
  db: UsageDb = prisma
): Promise<ReserveResult> {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`tutelliv:order-intake:${companyId}`}))`;
    const [lastHour, lastDay] = await Promise.all([
      tx.orderIntakeUsage.count({ where: { companyId, createdAt: { gte: new Date(now.getTime() - HOUR_MS) } } }),
      tx.orderIntakeUsage.count({ where: { companyId, createdAt: { gte: new Date(now.getTime() - DAY_MS) } } }),
    ]);
    const exceeded = [
      ...(lastHour >= ORDER_INTAKE_HOURLY_LIMIT ? [HOUR_MS] : []),
      ...(lastDay >= ORDER_INTAKE_DAILY_LIMIT ? [DAY_MS] : []),
    ];
    if (exceeded.length > 0) {
      // Une place se libère quand l'appel le plus ancien de la fenêtre en sort ; on retient la plus lointaine.
      const waits = await Promise.all(exceeded.map(async (windowMs) => {
        const oldest = await tx.orderIntakeUsage.findFirst({
          where: { companyId, createdAt: { gte: new Date(now.getTime() - windowMs) } },
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        });
        return oldest ? oldest.createdAt.getTime() + windowMs - now.getTime() : windowMs;
      }));
      return { status: "rate_limited", retryAfterSeconds: Math.max(1, Math.ceil(Math.max(...waits) / 1000)) } as const;
    }
    const row = await tx.orderIntakeUsage.create({
      data: { companyId, status: "PENDING", model },
      select: { id: true },
    });
    return { status: "reserved", id: row.id } as const;
  }, ORDER_INTAKE_RESERVE_TX);
}

/** Rend la place réservée quand le fournisseur a refusé l'appel avant toute génération (aucun jeton). */
export async function releaseOrderIntakeCall(id: string, db: Pick<typeof prisma, "orderIntakeUsage"> = prisma) {
  try {
    await db.orderIntakeUsage.delete({ where: { id } });
  } catch (error) {
    console.error("[order-intake] réservation non rendue", error instanceof Error ? error.name : "unknown");
  }
}

export async function completeOrderIntakeCall(
  id: string,
  result: { status: Exclude<OrderIntakeUsageStatus, "PENDING">; inputTokens: number; outputTokens: number },
  db: Pick<typeof prisma, "orderIntakeUsage"> = prisma
) {
  try {
    await db.orderIntakeUsage.update({
      where: { id },
      data: { status: result.status, inputTokens: result.inputTokens, outputTokens: result.outputTokens },
    });
  } catch (error) {
    // Le journal ne doit pas faire échouer une analyse déjà payée ; l'appel reste compté.
    console.error("[order-intake] journal d'usage non mis à jour", error instanceof Error ? error.name : "unknown");
  }
}
