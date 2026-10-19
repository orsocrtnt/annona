import { prisma } from "@/services/prisma/client";
import { checkPodStorageHealth } from "@/lib/storage/pod";

type HealthCheck = {
  status: "ok" | "degraded" | "down";
  durationMs: number;
};

async function timedCheck(check: () => Promise<void>): Promise<HealthCheck> {
  const startedAt = performance.now();
  try {
    await check();
    return { status: "ok", durationMs: Math.round(performance.now() - startedAt) };
  } catch {
    return { status: "down", durationMs: Math.round(performance.now() - startedAt) };
  }
}

export async function getServiceHealth(now = new Date()) {
  const staleBefore = new Date(now.getTime() - 10 * 60_000);
  const [database, storage, failedJobs, staleJobs] = await Promise.all([
    timedCheck(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }),
    timedCheck(checkPodStorageHealth),
    prisma.operationJob.count({ where: { status: "FAILED" } }).catch(() => -1),
    prisma.operationJob.count({
      where: { status: "PROCESSING", lockedAt: { lte: staleBefore } },
    }).catch(() => -1),
  ]);

  const queue: HealthCheck & { failed: number | null; stale: number | null } = {
    status: failedJobs < 0 || staleJobs < 0
      ? "down"
      : failedJobs > 0 || staleJobs > 0
        ? "degraded"
        : "ok",
    durationMs: 0,
    failed: failedJobs < 0 ? null : failedJobs,
    stale: staleJobs < 0 ? null : staleJobs,
  };
  const checks = { database, storage, queue };
  const status = Object.values(checks).some((check) => check.status === "down")
    ? "down"
    : Object.values(checks).some((check) => check.status === "degraded")
      ? "degraded"
      : "ok";

  return {
    status,
    checkedAt: now.toISOString(),
    checks,
    configuration: {
      cron: Boolean(process.env.CRON_SECRET),
      emailLinks: process.env.AUTH_EMAIL_LINKS_ENABLED === "true",
      emailProvider: Boolean(process.env.RESEND_API_KEY && (process.env.MAIL_FROM || process.env.EMAIL_FROM)),
    },
  };
}
