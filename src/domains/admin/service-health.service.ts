import { getServiceHealth } from "@/domains/operations/service-health.service";

type CheckStatus = "ok" | "degraded" | "down";

type HealthSource = {
  status: string;
  checkedAt: string;
  checks: {
    database: { status: string; durationMs: number };
    storage: { status: string; durationMs: number };
    queue: { status: string; failed: number | null; stale: number | null };
  };
};

function asStatus(value: string): CheckStatus {
  if (value === "ok" || value === "degraded" || value === "down") return value;
  throw new Error("Statut de santé inconnu");
}

export type PlatformServiceHealth = {
  status: CheckStatus;
  checkedAt: string;
  database: { status: CheckStatus; durationMs: number };
  storage: { status: CheckStatus; durationMs: number };
  queue: { status: CheckStatus; failed: number | null; stale: number | null };
};

export function projectServiceHealth(source: HealthSource): PlatformServiceHealth {
  return {
    status: asStatus(source.status),
    checkedAt: source.checkedAt,
    database: { status: asStatus(source.checks.database.status), durationMs: source.checks.database.durationMs },
    storage: { status: asStatus(source.checks.storage.status), durationMs: source.checks.storage.durationMs },
    queue: {
      status: asStatus(source.checks.queue.status),
      failed: source.checks.queue.failed,
      stale: source.checks.queue.stale,
    },
  };
}

export async function readPlatformServiceHealth(
  load: () => Promise<HealthSource> = getServiceHealth
): Promise<PlatformServiceHealth> {
  return projectServiceHealth(await load());
}
