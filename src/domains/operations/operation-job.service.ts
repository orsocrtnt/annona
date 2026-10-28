import type { OperationJob, Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { assertSaasMutationFeature } from "@/domains/saas/saas.service";
import { runAfterResponse } from "@/lib/operations/after-response";

const OPERATION_JOB_TAKE = 50;
const OPERATION_JOB_OVERDUE_MS = 15 * 60 * 1000;
const OPERATION_JOB_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;

type JobDatabase = Pick<Prisma.TransactionClient, "operationJob">;

export type OperationJobHealth = {
  pending: number;
  processing: number;
  failed: number;
  failedJobs: Array<{
    id: string;
    type: OperationJob["type"];
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    updatedAt: string;
  }>;
};

function retryAt(attempts: number, now: Date) {
  const delay = RETRY_DELAYS_MS[
    Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)
  ] ?? 30 * 60_000;
  return new Date(now.getTime() + delay);
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
}

export async function enqueueOperationJob(
  db: JobDatabase,
  input: {
    jobKey: string;
    type: OperationJob["type"];
    payload: Prisma.InputJsonValue;
    companyId?: string | null;
    maxAttempts?: number;
  }
) {
  return db.operationJob.upsert({
    where: { jobKey: input.jobKey },
    update: {},
    create: {
      jobKey: input.jobKey,
      type: input.type,
      payload: input.payload,
      companyId: input.companyId ?? null,
      maxAttempts: input.maxAttempts ?? 3,
    },
    select: { id: true, jobKey: true, status: true },
  });
}

export async function enqueueAutoDispatchJob(
  db: JobDatabase,
  input: { companyId: string; deliveryId: string }
) {
  return enqueueOperationJob(db, {
    jobKey: `auto-dispatch:${input.deliveryId}`,
    type: "AUTO_DISPATCH",
    companyId: input.companyId,
    payload: {
      companyId: input.companyId,
      deliveryId: input.deliveryId,
    },
  });
}

function readString(payload: Prisma.JsonValue, key: string) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

async function executeJob(job: OperationJob) {
  if (job.type === "AUTO_DISPATCH") {
    const companyId = readString(job.payload, "companyId");
    const deliveryId = readString(job.payload, "deliveryId");
    if (!companyId || !deliveryId) throw new Error("AUTO_DISPATCH_PAYLOAD_INVALID");
    await assertSaasMutationFeature(companyId, "auto_dispatch");

    const { tryAutoAssignDelivery } = await import(
      "@/domains/delivery/auto-dispatch.service"
    );
    const result = await tryAutoAssignDelivery(companyId, deliveryId);
    const terminalSkips = new Set([
      "Auto-dispatch désactivé",
      "Livraison introuvable",
      "Déjà assignée",
      "Déjà assignée entre-temps",
      "Statut non éligible",
    ]);
    if (!result.assigned && result.skippedReason && !terminalSkips.has(result.skippedReason)) {
      throw new Error(`AUTO_DISPATCH_RETRY:${result.skippedReason}`);
    }
    return;
  }

  if (job.type === "CLIENT_NOTIFICATION") {
    if (readString(job.payload, "kind") === "SIGNUP_WELCOME") {
      const { deliverSignupWelcomeEmail } = await import(
        "@/domains/signup/signup.service"
      );
      await deliverSignupWelcomeEmail(job.payload, job.jobKey);
      return;
    }
    if (readString(job.payload, "kind") === "ORDER_MESSAGE") {
      const messageId = readString(job.payload, "messageId");
      if (!messageId) throw new Error("ORDER_MESSAGE_PAYLOAD_INVALID");
      const { deliverOrderMessageNotification } = await import("@/domains/order-conversation/order-conversation.service");
      await deliverOrderMessageNotification(messageId);
      return;
    }
    const { deliverClientNotificationJob } = await import(
      "@/domains/client-portal/notify.service"
    );
    await deliverClientNotificationJob(job.payload, job.jobKey);
    return;
  }

  throw new Error("OPERATION_JOB_TYPE_UNSUPPORTED");
}

export async function processOperationJob(jobId: string, now?: Date) {
  const claimedAt = now ?? new Date();
  const current = await prisma.operationJob.findUnique({ where: { id: jobId } });
  if (!current || current.status === "SUCCEEDED") return current;
  if (current.status === "FAILED" && current.attempts >= current.maxAttempts) return current;
  if (current.status === "PENDING" && current.nextAttemptAt > claimedAt) return current;
  if (
    current.status === "PROCESSING" &&
    current.lockedAt &&
    current.lockedAt.getTime() > claimedAt.getTime() - OPERATION_JOB_LEASE_MS
  ) {
    return current;
  }
  if (current.status === "PROCESSING" && current.attempts >= current.maxAttempts) {
    await prisma.operationJob.updateMany({
      where: {
        id: current.id,
        status: "PROCESSING",
        attempts: current.attempts,
        lockedAt: current.lockedAt,
      },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastError: current.lastError ?? "INTERRUPTION_APRES_DERNIERE_TENTATIVE",
      },
    });
    return prisma.operationJob.findUnique({ where: { id: jobId } });
  }

  const claim = await prisma.operationJob.updateMany({
    where: {
      id: current.id,
      status: current.status,
      attempts: current.attempts,
    },
    data: {
      status: "PROCESSING",
      attempts: { increment: 1 },
      lockedAt: claimedAt,
      lastError: null,
    },
  });
  if (claim.count === 0) return prisma.operationJob.findUnique({ where: { id: jobId } });

  const claimed = await prisma.operationJob.findUniqueOrThrow({ where: { id: jobId } });
  try {
    await executeJob(claimed);
    await prisma.operationJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        attempts: claimed.attempts,
        lockedAt: claimed.lockedAt,
      },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    return prisma.operationJob.findUnique({ where: { id: jobId } });
  } catch (error) {
    const failedAt = now ?? new Date();
    const terminal = claimed.attempts >= claimed.maxAttempts;
    await prisma.operationJob.updateMany({
      where: {
        id: jobId,
        status: "PROCESSING",
        attempts: claimed.attempts,
        lockedAt: claimed.lockedAt,
      },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        nextAttemptAt: terminal ? failedAt : retryAt(claimed.attempts, failedAt),
        lockedAt: null,
        lastError: safeError(error),
      },
    });
    return prisma.operationJob.findUnique({ where: { id: jobId } });
  }
}

export function kickOperationJob(jobId: string) {
  // after() garde la fonction Vercel vivante jusqu'à la fin du traitement ;
  // le filet /api/cron/operations reprend de toute façon les tâches restées PENDING.
  runAfterResponse(() => processOperationJob(jobId), {
    log: (...args) => console.error("[operation-job] lancement", jobId, ...args.map((a) => String(a).replace(/[\r\n]+/g, " ").slice(0, 500))),
  });
}

export async function processDueOperationJobs(now = new Date()) {
  const staleBefore = new Date(now.getTime() - OPERATION_JOB_LEASE_MS);
  const jobs = await prisma.operationJob.findMany({
    where: {
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: now } },
        { status: "PROCESSING", lockedAt: { lte: staleBefore } },
      ],
    },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: OPERATION_JOB_TAKE,
    select: { id: true },
  });

  const result = { processed: 0, succeeded: 0, pending: 0, failed: 0, overdue: 0 };
  for (const job of jobs) {
    const updated = await processOperationJob(job.id);
    if (!updated) continue;
    result.processed += 1;
    if (updated.status === "SUCCEEDED") result.succeeded += 1;
    else if (updated.status === "FAILED") result.failed += 1;
    else result.pending += 1;
  }
  result.overdue = await countOverduePendingJobs(now);
  return result;
}

/**
 * Tâches PENDING dont l'échéance est dépassée, ou PROCESSING au bail expiré,
 * depuis plus de OPERATION_JOB_OVERDUE_MS : le filet n'a pas pu les reprendre
 * (cron arrêté, lot saturé, fonction gelée). Les tâches replanifiées plus tard
 * ne comptent pas.
 */
export async function countOverduePendingJobs(now = new Date()) {
  const threshold = new Date(now.getTime() - OPERATION_JOB_OVERDUE_MS);
  return prisma.operationJob.count({
    where: {
      OR: [
        { status: "PENDING", nextAttemptAt: { lte: threshold } },
        // Bail expiré depuis longtemps et jamais repris (fonction gelée, lot plein).
        { status: "PROCESSING", lockedAt: { lte: threshold } },
      ],
    },
  });
}

export async function getOperationJobHealth(companyId: string): Promise<OperationJobHealth> {
  const [pending, processing, failed, failedJobs] = await Promise.all([
    prisma.operationJob.count({ where: { companyId, status: "PENDING" } }),
    prisma.operationJob.count({ where: { companyId, status: "PROCESSING" } }),
    prisma.operationJob.count({ where: { companyId, status: "FAILED" } }),
    prisma.operationJob.findMany({
      where: { companyId, status: "FAILED" },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        id: true,
        type: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        updatedAt: true,
      },
    }),
  ]);

  return {
    pending,
    processing,
    failed,
    failedJobs: failedJobs.map((job) => ({
      ...job,
      updatedAt: job.updatedAt.toISOString(),
    })),
  };
}

export async function retryFailedOperationJobs(companyId: string) {
  const failedJobs = await prisma.operationJob.findMany({
    where: { companyId, status: "FAILED" },
    select: { id: true },
  });
  if (failedJobs.length === 0) return { retried: 0 };

  const result = await prisma.operationJob.updateMany({
    where: { id: { in: failedJobs.map((job) => job.id) }, status: "FAILED" },
    data: {
      status: "PENDING",
      attempts: 0,
      nextAttemptAt: new Date(),
      lockedAt: null,
      completedAt: null,
    },
  });
  failedJobs.forEach((job) => kickOperationJob(job.id));
  return { retried: result.count };
}
