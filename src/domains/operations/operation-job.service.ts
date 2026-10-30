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

/** Erreur qu'un nouvel essai ne corrigerait pas : la tâche passe en échec sans être relancée. */
export function permanentJobError(message: string) {
  return Object.assign(new Error(message), { permanent: true });
}

/**
 * Tâche sans objet parce que son service est volontairement désactivé (ex. e-mail désactivé en
 * développement) : ce n'est pas un échec. Elle est close SUCCEEDED, avec `lastError` = `SKIPPED:<code>`
 * pour la trace, sans nouvel essai (RECETTE-2810, point 10).
 */
export function skippedJobError(code: string) {
  return Object.assign(new Error(code), { skipped: true });
}

export const SKIPPED_JOB_PREFIX = "SKIPPED:";

function isSkippedJobError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { skipped?: unknown }).skipped === true);
}

/**
 * Code d'erreur publiable (cron, alertes) : préfixe en majuscules et `name` du fournisseur, jamais
 * le texte libre (un message Prisma ou réseau peut contenir des valeurs : adresse, nom…).
 */
export function jobErrorCode(lastError: string | null): string | null {
  if (!lastError) return null;
  const match = /^([A-Z][A-Z0-9_]{2,80})(?::([A-Z][A-Z0-9_]{2,80}|[a-z]{1,30}_[a-z_]{1,33})(?![^:]))?/.exec(lastError);
  if (!match) return "ERREUR_NON_CLASSEE";
  return match[2] ? `${match[1]}:${match[2]}` : match[1]!;
}

/**
 * Rien n'a été tenté (ex. une autre exécution tient la réservation d'envoi) : la tâche est replanifiée
 * à `until` sans consommer d'essai.
 */
export function deferredJobError(message: string, until: Date) {
  return Object.assign(new Error(message), { deferUntil: until });
}

function deferredUntil(error: unknown): Date | null {
  const until = error && typeof error === "object" ? (error as { deferUntil?: unknown }).deferUntil : null;
  return until instanceof Date && Number.isFinite(until.getTime()) ? until : null;
}

/**
 * Fenêtre de déduplication du fournisseur d'e-mail pour une tâche (C5), sans migration : l'instant de
 * la première tentative réellement émise est inscrit dans le payload juste avant l'appel. Renvoie
 * null pour la première tentative, sinon cet instant (borne basse de toute tentative antérieure).
 * Tâche déjà exécutée sans marqueur (héritée de l'ancien code, qui a pu envoyer) : la fenêtre part de
 * sa création, inscrite comme marqueur. Valeur illisible ou tâche absente : époque 0 (fenêtre dépassée).
 */
export function jobEmailReplayWindow(
  job: { id: string; createdAt: Date; previouslyAttempted: boolean },
  db: Pick<typeof prisma, "$executeRaw" | "$queryRaw"> = prisma
) {
  return async (): Promise<Date | null> => {
    const marker = (job.previouslyAttempted ? job.createdAt : new Date()).toISOString();
    const marked = await db.$executeRaw`
      UPDATE "operation_jobs"
      SET "payload" = jsonb_set(CASE WHEN jsonb_typeof("payload") = 'object' THEN "payload" ELSE '{}'::jsonb END,
                                '{emailFirstAttemptAt}', to_jsonb(${marker}::text), true)
      WHERE "id" = ${job.id} AND NOT ("payload" ? 'emailFirstAttemptAt')`;
    if (marked === 1) return job.previouslyAttempted ? job.createdAt : null;
    const rows = await db.$queryRaw<Array<{ first: string | null }>>`
      SELECT "payload"->>'emailFirstAttemptAt' AS first FROM "operation_jobs" WHERE "id" = ${job.id}`;
    const first = rows[0]?.first ? new Date(rows[0].first) : null;
    return first && Number.isFinite(first.getTime()) ? first : new Date(0);
  };
}

/**
 * Instantané du rendu e-mail d'une tâche (C5), sans migration : enregistré atomiquement dans le
 * payload à la première tentative émise, puis renvoyé tel quel à chaque reprise sous la même clé.
 * Tâche héritée sans instantané : le rendu courant est enregistré (comportement prudent : un 409
 * `invalid_idempotent_request` éventuel reste terminal). Instantané illisible : rendu courant.
 */
export function jobEmailContentFreezer(jobId: string, db: Pick<typeof prisma, "$executeRaw" | "$queryRaw"> = prisma) {
  const freeze = async (content: { to: string; subject: string; text: string }) => {
    const snapshot = JSON.stringify({ to: content.to, subject: content.subject, text: content.text });
    const created = await db.$executeRaw`
      UPDATE "operation_jobs"
      SET "payload" = jsonb_set(CASE WHEN jsonb_typeof("payload") = 'object' THEN "payload" ELSE '{}'::jsonb END,
                                '{emailSnapshot}', ${snapshot}::jsonb, true)
      WHERE "id" = ${jobId} AND NOT ("payload" ? 'emailSnapshot')`;
    const rows = await db.$queryRaw<Array<{ snapshot: unknown }>>`
      SELECT "payload"->'emailSnapshot' AS snapshot FROM "operation_jobs" WHERE "id" = ${jobId}`;
    const stored = rows[0]?.snapshot as Record<string, unknown> | null | undefined;
    if (stored && typeof stored.to === "string" && typeof stored.subject === "string" && typeof stored.text === "string") {
      return { content: { to: stored.to, subject: stored.subject, text: stored.text }, created: created === 1 };
    }
    console.error("[operation-job] instantané e-mail illisible, rendu courant utilisé", jobId);
    return { content, created: false };
  };
  const release = async () => {
    await db.$executeRaw`UPDATE "operation_jobs" SET "payload" = "payload" - 'emailSnapshot' WHERE "id" = ${jobId} AND jsonb_typeof("payload") = 'object'`;
  };
  return { freeze, release };
}

function isPermanentJobError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { permanent?: unknown }).permanent === true);
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

export type OperationJobRunDetail = {
  id: string;
  type: OperationJob["type"];
  kind: string | null;
  outcome: "succeeded" | "skipped" | "pending" | "failed";
  error: string | null;
};

function jobKind(payload: Prisma.JsonValue) {
  const kind = readString(payload, "kind");
  return kind && /^[A-Z][A-Z_]{1,40}$/.test(kind) ? kind : null;
}

function readString(payload: Prisma.JsonValue, key: string) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

/** `previouslyAttempted` : la tâche avait déjà tourné avant cette exécution (essais ou erreur). */
async function executeJob(job: OperationJob, context: { previouslyAttempted: boolean }) {
  const emailWindow = () => jobEmailReplayWindow({ id: job.id, createdAt: job.createdAt, previouslyAttempted: context.previouslyAttempted });
  const freezeContent = jobEmailContentFreezer(job.id);
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
      "En attente de la prochaine tournée automatique",
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
      // Fenêtre de déduplication du fournisseur d'e-mail, bornée par la première tentative émise (C5).
      await deliverSignupWelcomeEmail(job.payload, job.jobKey, emailWindow(), freezeContent);
      return;
    }
    if (readString(job.payload, "kind") === "ORDER_MESSAGE") {
      const messageId = readString(job.payload, "messageId");
      if (!messageId) throw new Error("ORDER_MESSAGE_PAYLOAD_INVALID");
      const { deliverOrderMessageNotification } = await import("@/domains/order-conversation/order-conversation.service");
      await deliverOrderMessageNotification(messageId);
      return;
    }
    if (readString(job.payload, "kind") === "GUEST_TRACKING_LINK") {
      const { deliverGuestTrackingEmail } = await import("@/domains/public-order/public-order.service");
      await deliverGuestTrackingEmail(job.payload, job.jobKey, emailWindow(), freezeContent);
      return;
    }
    // DEMO-3 : relance de facture (e-mail au client).
    if (readString(job.payload, "kind") === "INVOICE_REMINDER") {
      const { deliverInvoiceReminderJob } = await import("@/domains/invoice/invoice-reminder.service");
      await deliverInvoiceReminderJob(job.payload, job.jobKey, { previouslyAttempted: context.previouslyAttempted, freezeContent });
      return;
    }
    const { deliverClientNotificationJob } = await import(
      "@/domains/client-portal/notify.service"
    );
    await deliverClientNotificationJob(job.payload, job.jobKey, emailWindow(), freezeContent);
    return;
  }

  if (job.type === "DELIVERY_INVOICE") {
    // DEMO-3 : facture émise après le passage en « Livrée », hors de la transition.
    const { runDeliveryInvoiceJob } = await import("@/domains/invoice/delivery-invoice.service");
    await runDeliveryInvoiceJob(job.payload);
    return;
  }

  if (job.type === "DRIVER_NOTIFICATION") {
    const { deliverDriverMissionPush } = await import("@/domains/driver/driver-push.service");
    await deliverDriverMissionPush(job.payload);
    return;
  }

  if (job.type === "INBOUND_EMAIL") {
    const { analyzeInboundEmailJob } = await import("@/domains/order-intake/inbound-email.service");
    await analyzeInboundEmailJob(job.payload);
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

  // Avant la prise : un essai ou une erreur antérieurs signalent une tâche déjà exécutée (C5).
  const previouslyAttempted = current.attempts > 0 || current.lastError !== null;
  const claim = await prisma.operationJob.updateMany({
    where: {
      id: current.id,
      status: current.status,
      attempts: current.attempts,
      // Une tâche reportée entre-temps (échéance future) n'est pas reprise aussitôt.
      nextAttemptAt: { lte: claimedAt },
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
    await executeJob(claimed, { previouslyAttempted });
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
    if (isSkippedJobError(error)) {
      await prisma.operationJob.updateMany({
        where: { id: jobId, status: "PROCESSING", attempts: claimed.attempts, lockedAt: claimed.lockedAt },
        data: { status: "SUCCEEDED", completedAt: failedAt, lockedAt: null, lastError: `${SKIPPED_JOB_PREFIX}${safeError(error)}` },
      });
      return prisma.operationJob.findUnique({ where: { id: jobId } });
    }
    const deferUntil = deferredUntil(error);
    if (deferUntil) {
      await prisma.operationJob.updateMany({
        where: { id: jobId, status: "PROCESSING", attempts: claimed.attempts, lockedAt: claimed.lockedAt },
        data: { status: "PENDING", attempts: { decrement: 1 }, nextAttemptAt: deferUntil, lockedAt: null, lastError: safeError(error) },
      });
      return prisma.operationJob.findUnique({ where: { id: jobId } });
    }
    const terminal = claimed.attempts >= claimed.maxAttempts || isPermanentJobError(error);
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

/**
 * Délais entre deux essais du traitement immédiat quand il échoue AVANT d'avoir pu exécuter la tâche
 * (pool de connexions saturé au redémarrage, coupure réseau) : sans eux, la tâche restait PENDING
 * jusqu'au passage du cron (RECETTE-2810, point 9). `processOperationJob` ne lève que sur une erreur
 * de base de données ; la prise conditionnelle (`updateMany`) empêche toute double exécution.
 */
export const KICK_RETRY_DELAYS_MS = [1_000, 4_000, 10_000] as const;

export async function processOperationJobWithRetry(
  jobId: string,
  deps: {
    process?: (jobId: string) => Promise<unknown>;
    sleep?: (ms: number) => Promise<void>;
    delays?: readonly number[];
  } = {}
) {
  const run = deps.process ?? processOperationJob;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const delays = deps.delays ?? KICK_RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await run(jobId);
    } catch (error) {
      if (attempt >= delays.length) throw error; // le filet cron reprendra la tâche
      await sleep(delays[attempt]!);
    }
  }
}

export function kickOperationJob(jobId: string) {
  // after() garde la fonction Vercel vivante jusqu'à la fin du traitement ;
  // le filet /api/cron/operations reprend de toute façon les tâches restées PENDING.
  runAfterResponse(() => processOperationJobWithRetry(jobId), {
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

  const result = { processed: 0, succeeded: 0, skipped: 0, pending: 0, failed: 0, overdue: 0, details: [] as OperationJobRunDetail[] };
  for (const job of jobs) {
    const updated = await processOperationJob(job.id);
    if (!updated) continue;
    result.processed += 1;
    const skipped = updated.status === "SUCCEEDED" && (updated.lastError ?? "").startsWith(SKIPPED_JOB_PREFIX);
    const outcome: OperationJobRunDetail["outcome"] = skipped
      ? "skipped"
      : updated.status === "SUCCEEDED" ? "succeeded" : updated.status === "FAILED" ? "failed" : "pending";
    result[outcome] += 1;
    // Détail par tâche sans donnée personnelle : identifiant interne, type, nature et code d'erreur.
    if (outcome !== "succeeded") {
      result.details.push({ id: updated.id, type: updated.type, kind: jobKind(updated.payload), outcome, error: jobErrorCode(updated.lastError) });
    }
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
