import { realignDemoScenarioClock } from "@/domains/demo/demo-time-shift.service";
import { createHash } from "node:crypto";
import { DemoPoolState, Prisma, type Company } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import {
  DEMO_COMPANY_NAME,
  DEMO_POOL_COMPANY_PREFIX,
  DEMO_POOL_KEY,
  DEMO_POOL_MIN_READY,
  isDemoScenarioOutdated,
} from "@/lib/demo/constants";
import { DEFAULT_DISPATCH_SETTINGS } from "@/lib/validations/dispatch-settings";
import { ensureDemoSessionRosterUsers } from "@/domains/demo/demo-users.service";
import { resetDemoScenario } from "@/domains/demo/demo-scenario.service";
import {
  assertDemoStorageEmpty,
  hasCrossTenantDemoReference,
  purgeDemoPoolStorage,
} from "@/domains/data-lifecycle/demo-cleanup.service";

export const DEMO_POOL_LEASE_MS = 8 * 60 * 60 * 1000;
/** Décision C10 : une session de recette automatisée libère son espace après une heure. */
export const DEMO_POOL_TEST_LEASE_MS = 60 * 60 * 1000;
export const DEMO_POOL_RETRY_AFTER_SECONDS = 5;
const RECYCLE_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_RECYCLE_ATTEMPTS = 3;
/** Une tâche de fond finit en quelques minutes : au-delà d'une heure, elle est coincée et l'espace part en quarantaine. */
export const DEMO_POOL_JOBS_WAIT_MS = 60 * 60 * 1000;
const SESSION_ID_PATTERN = /^[a-f0-9]{64}$/;
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

type Lease = {
  companyId: string;
  poolEnvironmentId: string;
  expiresAt: Date;
  reused: boolean;
};

type RecycleResult = {
  companyId: string;
  status: "ready" | "recycled" | "quarantined" | "skipped" | "retry";
  reason?: string;
};

export class DemoPoolSafetyError extends Error {}
class DemoPoolJobsRunning extends Error {}
class DemoPoolLeaseRace extends Error {}

export class DemoPoolUnavailableError extends Error {
  readonly code = "DEMO_POOL_BUSY";
  readonly retryAfterSeconds = DEMO_POOL_RETRY_AFTER_SECONDS;

  constructor() {
    super("DEMO_POOL_BUSY");
    this.name = "DemoPoolUnavailableError";
  }
}

export function demoPoolLeaseKeyHash(sessionId: string): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) throw new Error("DEMO_SESSION_INVALID");
  return createHash("sha256").update(`annona-demo-pool:${sessionId}`).digest("hex");
}

export function demoSessionIdFromRequestKey(requestKey: string): string {
  if (!REQUEST_KEY_PATTERN.test(requestKey)) throw new Error("DEMO_REQUEST_KEY_INVALID");
  return createHash("sha256").update(`annona-demo-request:${requestKey}`).digest("hex");
}

function poolSlug(poolKey: string, slot: number): string {
  const prefix = poolKey === DEMO_POOL_KEY
    ? DEMO_POOL_COMPANY_PREFIX
    : `${DEMO_POOL_COMPANY_PREFIX}${createHash("sha256").update(poolKey).digest("hex").slice(0, 10)}-`;
  return `${prefix}${String(slot).padStart(2, "0")}`;
}

function poolSettings(
  raw: Prisma.JsonValue | null,
  poolKey: string,
  slot: number
): Prisma.InputJsonValue {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
  delete source.demoSession;
  delete source.demoRetention;
  delete source.dispatch;
  delete source.dispatchRules;
  delete source.deliveryOptions;
  return {
    ...source,
    deliveryCategories: {
      STANDARD: true,
      COURIER: true,
      SPECIAL_MISSION: false,
    },
    dispatchRules: DEFAULT_DISPATCH_SETTINGS,
    demoPool: true,
    demoPoolKey: poolKey,
    demoPoolSlot: slot,
  } as Prisma.InputJsonValue;
}

function isPoolCompany(company: Pick<Company, "isDemo" | "status" | "settings">, poolKey?: string): boolean {
  const settings = company.settings;
  if (!company.isDemo || company.status !== "ACTIVE" || !settings || typeof settings !== "object" || Array.isArray(settings)) {
    return false;
  }
  const marker = settings as Record<string, unknown>;
  return marker.demoPool === true && (poolKey === undefined || marker.demoPoolKey === poolKey);
}

async function createPoolSlot(base: Company, poolKey: string, slot: number) {
  const createdAt = new Date();
  const periodEnd = new Date(createdAt.getTime() + 365 * 24 * 60 * 60 * 1000);
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        name: `${DEMO_COMPANY_NAME} — environnement ${slot}`,
        slug: poolSlug(poolKey, slot),
        isDemo: true,
        status: "ACTIVE",
        email: base.email,
        phone: base.phone,
        address: base.address,
        city: base.city,
        country: base.country,
        settings: poolSettings(base.settings, poolKey, slot),
        saasSubscription: {
          create: {
            kind: "PILOT",
            status: "ACTIVE",
            startsAt: createdAt,
            currentPeriodStart: createdAt,
            currentPeriodEnd: periodEnd,
            snapshot: {
              schemaVersion: 1,
              mode: "PILOT",
              limits: {
                drivers: null,
                admins: null,
                dispatchers: null,
                monthlyOrders: 2147483647,
              },
              orderOverageUnitPriceCents: 0,
              features: [
                "auto_dispatch",
                "admin_gps",
                "client_gps",
                "advanced_analytics",
                "priority_support",
                "order_automation",
              ],
            },
          },
        },
      },
    });
    const environment = await tx.demoPoolEnvironment.create({
      data: { companyId: company.id, poolKey, slot, state: "PREPARING" },
    });
    return { company, environment };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function buildPoolSlot(companyId: string): Promise<void> {
  await ensureDemoSessionRosterUsers(companyId);
  const { deliveries } = await resetDemoScenario(companyId, new Date(), { ensureCanonicalRoster: false });
  const [adminCount, orderCount] = await Promise.all([
    prisma.user.count({ where: { companyId, role: { systemRole: "COMPANY_ADMIN" } } }),
    prisma.order.count({ where: { companyId } }),
  ]);
  if (adminCount !== 1 || orderCount !== deliveries) throw new Error("DEMO_POOL_BUILD_INCOMPLETE");
}

/**
 * Commande opérateur idempotente. Elle ne reconstruit jamais un slot prêt ou loué
 * et ne réactive jamais automatiquement un slot mis en quarantaine.
 */
export async function prepareDemoPool(options: {
  baseCompanyId: string;
  size?: number;
  poolKey?: string;
}): Promise<{ ready: number; leased: number; quarantined: number; total: number }> {
  const poolKey = options.poolKey ?? DEMO_POOL_KEY;
  const size = options.size ?? DEMO_POOL_MIN_READY;
  if (!Number.isInteger(size) || size < 1 || size > 20) throw new Error("DEMO_POOL_SIZE_INVALID");
  const base = await prisma.company.findFirst({
    where: { id: options.baseCompanyId, isDemo: true, status: { in: ["ACTIVE", "TRIAL"] } },
  });
  if (!base) throw new Error("DEMO_BASE_COMPANY_UNAVAILABLE");

  for (let slot = 1; slot <= size; slot += 1) {
    let environment = await prisma.demoPoolEnvironment.findUnique({
      where: { poolKey_slot: { poolKey, slot } },
      include: { company: true },
    });
    if (!environment) {
      try {
        const created = await createPoolSlot(base, poolKey, slot);
        environment = { ...created.environment, company: created.company };
      } catch (error) {
        environment = await prisma.demoPoolEnvironment.findUnique({
          where: { poolKey_slot: { poolKey, slot } },
          include: { company: true },
        });
        if (!environment) throw error;
      }
    }
    if (!isPoolCompany(environment.company, poolKey)) {
      throw new Error("DEMO_POOL_COMPANY_MARKER_INVALID");
    }
    if (environment.state === "READY" || environment.state === "LEASED" || environment.state === "QUARANTINED") {
      continue;
    }
    if (environment.state === "RECYCLING") {
      await recycleDemoPoolEnvironment(environment.companyId);
      continue;
    }
    if (environment.state === "PREPARING" && environment.recycleRequestedAt) continue;
    try {
      await buildPoolSlot(environment.companyId);
      await prisma.demoPoolEnvironment.update({
        where: { id: environment.id },
        data: {
          state: "READY",
          leaseKeyHash: null,
          leasedAt: null,
          leaseExpiresAt: null,
          recycleRequestedAt: null,
          recycleStartedAt: null,
          recycleAttempts: 0,
          lastFailureCode: null,
        },
      });
    } catch (error) {
      await prisma.demoPoolEnvironment.update({
        where: { id: environment.id },
        data: { state: "QUARANTINED", lastFailureCode: "INITIAL_BUILD_FAILED" },
      });
      throw error;
    }
  }
  return getDemoPoolStats(poolKey);
}

export async function getDemoPoolStats(poolKey = DEMO_POOL_KEY) {
  const rows = await prisma.demoPoolEnvironment.groupBy({
    by: ["state"],
    where: { poolKey },
    _count: { _all: true },
  });
  const counts = new Map(rows.map((row) => [row.state, row._count._all]));
  return {
    ready: counts.get("READY") ?? 0,
    leased: counts.get("LEASED") ?? 0,
    quarantined: counts.get("QUARANTINED") ?? 0,
    total: rows.reduce((sum, row) => sum + row._count._all, 0),
  };
}

/**
 * Présence en direct : la démo ouverte envoie un signe de vie chaque minute tant que l'onglet est visible
 * (`/api/demo/heartbeat`). Il est noté dans `updatedAt` de l'espace réservé : aucune autre écriture ne touche
 * un espace LEASED avant sa remise en préparation, donc `updatedAt` = dernière activité (réservation comprise).
 */
export const DEMO_LIVE_WINDOW_MS = 2 * 60 * 1000;

export async function touchDemoPoolLease(sessionId: string, now = new Date()): Promise<boolean> {
  let leaseKeyHash: string;
  try {
    leaseKeyHash = demoPoolLeaseKeyHash(sessionId);
  } catch {
    return false; // cookie absent ou altéré : rien à noter
  }
  const result = await prisma.demoPoolEnvironment.updateMany({
    where: { leaseKeyHash, state: "LEASED", leaseExpiresAt: { gt: now } },
    data: { updatedAt: now },
  });
  return result.count === 1;
}

/** Accueil super admin : démos prêtes sur le total, réservées, et réservées avec quelqu'un dessus en ce moment. */
export async function getDemoPoolOccupancy(now = new Date(), poolKey = DEMO_POOL_KEY) {
  const [stats, reserved, live] = await Promise.all([
    getDemoPoolStats(poolKey),
    prisma.demoPoolEnvironment.count({ where: { poolKey, state: "LEASED", leaseExpiresAt: { gt: now } } }),
    prisma.demoPoolEnvironment.count({
      where: {
        poolKey,
        state: "LEASED",
        leaseExpiresAt: { gt: now },
        updatedAt: { gte: new Date(now.getTime() - DEMO_LIVE_WINDOW_MS) },
      },
    }),
  ]);
  return {
    available: stats.ready,
    total: stats.total,
    reserved,
    live,
    preparing: Math.max(stats.total - stats.ready - stats.leased - stats.quarantined, 0),
    quarantined: stats.quarantined,
  };
}

export async function getActiveDemoPoolLease(sessionId: string, now = new Date()): Promise<Lease | null> {
  const leaseKeyHash = demoPoolLeaseKeyHash(sessionId);
  const environment = await prisma.demoPoolEnvironment.findUnique({
    where: { leaseKeyHash },
    include: { company: true },
  });
  if (!environment || environment.state !== "LEASED" || !environment.leaseExpiresAt || environment.leaseExpiresAt <= now) {
    return null;
  }
  if (!isPoolCompany(environment.company, environment.poolKey)) return null;
  return {
    companyId: environment.companyId,
    poolEnvironmentId: environment.id,
    expiresAt: environment.leaseExpiresAt,
    reused: true,
  };
}

export async function queueExpiredDemoPoolLeases(now = new Date(), poolKey = DEMO_POOL_KEY): Promise<number> {
  const result = await prisma.demoPoolEnvironment.updateMany({
    where: { poolKey, state: "LEASED", leaseExpiresAt: { lte: now } },
    data: {
      state: "RECYCLING",
      leaseKeyHash: null,
      recycleRequestedAt: now,
      lastFailureCode: null,
    },
  });
  return result.count;
}

/**
 * L'espace a été rempli à sa préparation : ses dates avancent jusqu'à maintenant.
 * Un échec laisse la démo ouverte avec des dates anciennes plutôt que de la refuser.
 */
async function realignLeasedDemo(companyId: string, now: Date): Promise<void> {
  try {
    await realignDemoScenarioClock(companyId, now);
  } catch (error) {
    console.error("[demo-pool] remise à l'heure impossible", error instanceof Error ? error.message : error);
  }
}

export async function leaseDemoPoolEnvironment(
  sessionId: string,
  options: { now?: Date; poolKey?: string; leaseMs?: number } = {}
): Promise<Lease> {
  const now = options.now ?? new Date();
  const leaseMs = options.leaseMs ?? DEMO_POOL_LEASE_MS;
  const poolKey = options.poolKey ?? DEMO_POOL_KEY;
  const leaseKeyHash = demoPoolLeaseKeyHash(sessionId);
  await queueExpiredDemoPoolLeases(now, poolKey);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const lease = await prisma.$transaction(async (tx): Promise<Lease> => {
        const existing = await tx.demoPoolEnvironment.findUnique({
          where: { leaseKeyHash },
          include: { company: true },
        });
        if (existing?.state === "LEASED" && existing.leaseExpiresAt && existing.leaseExpiresAt > now && isPoolCompany(existing.company, poolKey)) {
          return {
            companyId: existing.companyId,
            poolEnvironmentId: existing.id,
            expiresAt: existing.leaseExpiresAt,
            reused: true,
          };
        }

        const candidate = await tx.demoPoolEnvironment.findFirst({
          where: { poolKey, state: "READY", leaseKeyHash: null },
          orderBy: { slot: "asc" },
          select: { id: true, companyId: true },
        });
        if (!candidate) throw new DemoPoolUnavailableError();
        const expiresAt = new Date(now.getTime() + leaseMs);
        const claimed = await tx.demoPoolEnvironment.updateMany({
          where: { id: candidate.id, state: "READY", leaseKeyHash: null },
          data: {
            state: "LEASED",
            leaseKeyHash,
            leasedAt: now,
            leaseExpiresAt: expiresAt,
            recycleRequestedAt: null,
            recycleStartedAt: null,
            recycleAttempts: 0,
            lastFailureCode: null,
          },
        });
        if (claimed.count !== 1) throw new DemoPoolLeaseRace();
        return {
          companyId: candidate.companyId,
          poolEnvironmentId: candidate.id,
          expiresAt,
          reused: false,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      });
      if (!lease.reused) await realignLeasedDemo(lease.companyId, now);
      return lease;
    } catch (error) {
      if (error instanceof DemoPoolUnavailableError) throw error;
      const retryable = error instanceof DemoPoolLeaseRace ||
        (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code));
      if (!retryable || attempt === 4) throw error;
      const existing = await getActiveDemoPoolLease(sessionId, now);
      if (existing) return existing;
    }
  }
  throw new DemoPoolUnavailableError();
}

export async function requestDemoPoolRecycle(companyId: string, now = new Date()): Promise<boolean> {
  const queued = await prisma.demoPoolEnvironment.updateMany({
    where: { companyId, state: "LEASED" },
    data: {
      state: "RECYCLING",
      leaseKeyHash: null,
      recycleRequestedAt: now,
      lastFailureCode: null,
    },
  });
  return queued.count === 1;
}

/**
 * Gardes du recyclage, puis retrait des preuves ajoutées pendant la démo : elles sont fictives
 * et leurs lignes disparaissent avec le scénario. Une panne du retrait est retentée ; seul un
 * dossier resté non vide après le retrait met l'espace en quarantaine.
 */
export async function preparePoolRecycle(
  companyId: string,
  poolKey: string,
  storage: {
    purge: (companyId: string) => Promise<unknown>;
    assertEmpty: (companyId: string) => Promise<void>;
  }
): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { users: { include: { role: true } } },
  });
  if (!company || !isPoolCompany(company, poolKey)) throw new DemoPoolSafetyError("INVALID_POOL_COMPANY");
  if (company.logoUrl) throw new DemoPoolSafetyError("EXTERNAL_ASSET_REFERENCE");
  const userIds = company.users.map((user) => user.id);
  const [pdfs, runningJobs, crossTenant] = await Promise.all([
    prisma.invoice.count({ where: { companyId, pdfUrl: { not: null } } }),
    prisma.operationJob.count({ where: { companyId, status: { in: ["PENDING", "PROCESSING"] } } }),
    prisma.$transaction((tx) => hasCrossTenantDemoReference(tx, companyId, userIds)),
  ]);
  if (pdfs) throw new DemoPoolSafetyError("EXTERNAL_ASSET_REFERENCE");
  if (runningJobs) throw new DemoPoolJobsRunning("UNFINISHED_JOBS");
  if (crossTenant) throw new DemoPoolSafetyError("CROSS_TENANT_REFERENCE");
  await storage.purge(companyId);
  try {
    await storage.assertEmpty(companyId);
  } catch (error) {
    throw new DemoPoolSafetyError(error instanceof Error ? error.message : "STORAGE_UNAVAILABLE");
  }
}

export async function recycleDemoPoolEnvironment(
  companyId: string,
  options: {
    now?: Date;
    assertStorageEmpty?: (companyId: string) => Promise<void>;
    purgeStorage?: (companyId: string) => Promise<unknown>;
  } = {}
): Promise<RecycleResult> {
  const now = options.now ?? new Date();
  const environment = await prisma.demoPoolEnvironment.findUnique({ where: { companyId } });
  if (!environment) return { companyId, status: "skipped", reason: "NOT_A_POOL_ENVIRONMENT" };
  if (environment.state === "READY") return { companyId, status: "ready" };
  if (environment.state !== "RECYCLING") return { companyId, status: "skipped", reason: environment.state };
  const claimed = await prisma.demoPoolEnvironment.updateMany({
    where: { id: environment.id, state: "RECYCLING", updatedAt: environment.updatedAt },
    data: { state: "PREPARING", recycleStartedAt: now },
  });
  if (claimed.count !== 1) return { companyId, status: "skipped", reason: "CONCURRENT_WORKER" };

  try {
    await preparePoolRecycle(companyId, environment.poolKey, {
      purge: options.purgeStorage ?? ((id) => purgeDemoPoolStorage(id)),
      assertEmpty: options.assertStorageEmpty ?? assertDemoStorageEmpty,
    });
    // Roster à jour (livreurs ajoutés au scénario) avant de recréer les livraisons.
    await ensureDemoSessionRosterUsers(companyId);
    await resetDemoScenario(companyId, now, { ensureCanonicalRoster: false });
    await prisma.demoPoolEnvironment.update({
      where: { id: environment.id },
      data: {
        state: "READY",
        leaseKeyHash: null,
        leasedAt: null,
        leaseExpiresAt: null,
        recycleRequestedAt: null,
        recycleStartedAt: null,
        recycleAttempts: 0,
        lastFailureCode: null,
      },
    });
    return { companyId, status: "recycled" };
  } catch (error) {
    // Tâche de fond encore en cours : l'espace attend, sans consommer d'essai. Rien n'est reconstruit tant qu'elle tourne.
    const waitingSince = (environment.recycleRequestedAt ?? now).getTime();
    if (error instanceof DemoPoolJobsRunning && now.getTime() - waitingSince < DEMO_POOL_JOBS_WAIT_MS) {
      await prisma.demoPoolEnvironment.update({
        where: { id: environment.id },
        data: { state: "RECYCLING", recycleStartedAt: null, lastFailureCode: error.message },
      });
      return { companyId, status: "retry", reason: error.message };
    }
    const attempts = environment.recycleAttempts + 1;
    const safetyFailure = error instanceof DemoPoolSafetyError || error instanceof DemoPoolJobsRunning;
    const state: DemoPoolState = safetyFailure || attempts >= MAX_RECYCLE_ATTEMPTS
      ? "QUARANTINED"
      : "RECYCLING";
    const reason = safetyFailure ? error.message : "RECYCLE_FAILED";
    await prisma.demoPoolEnvironment.update({
      where: { id: environment.id },
      data: {
        state,
        leaseKeyHash: state === "QUARANTINED" ? null : environment.leaseKeyHash,
        leasedAt: state === "QUARANTINED" ? null : environment.leasedAt,
        leaseExpiresAt: state === "QUARANTINED" ? null : environment.leaseExpiresAt,
        recycleStartedAt: null,
        recycleAttempts: attempts,
        lastFailureCode: reason.slice(0, 100),
      },
    });
    return { companyId, status: state === "QUARANTINED" ? "quarantined" : "retry", reason };
  }
}

export async function recoverStaleDemoPoolWorkers(now = new Date(), poolKey = DEMO_POOL_KEY): Promise<number> {
  const staleBefore = new Date(now.getTime() - RECYCLE_LOCK_TIMEOUT_MS);
  const result = await prisma.demoPoolEnvironment.updateMany({
    where: {
      poolKey,
      state: "PREPARING",
      recycleRequestedAt: { not: null },
      recycleStartedAt: { lte: staleBefore },
    },
    data: { state: "RECYCLING", recycleStartedAt: null, lastFailureCode: "WORKER_RESTART" },
  });
  return result.count;
}

/** Espaces libres préparés avec une ancienne version du scénario : à recycler. */
export async function queueOutdatedDemoPoolEnvironments(now = new Date(), poolKey = DEMO_POOL_KEY): Promise<number> {
  const ready = await prisma.demoPoolEnvironment.findMany({
    where: { poolKey, state: "READY", leaseKeyHash: null },
    select: { id: true, company: { select: { settings: true } } },
  });
  const outdated = ready.filter((environment) => isDemoScenarioOutdated(environment.company.settings));
  if (outdated.length === 0) return 0;
  const result = await prisma.demoPoolEnvironment.updateMany({
    where: { id: { in: outdated.map((environment) => environment.id) }, state: "READY", leaseKeyHash: null },
    data: { state: "RECYCLING", recycleRequestedAt: now, lastFailureCode: null },
  });
  return result.count;
}

export async function maintainDemoPool(options: {
  now?: Date;
  poolKey?: string;
  limit?: number;
  assertStorageEmpty?: (companyId: string) => Promise<void>;
} = {}): Promise<RecycleResult[]> {
  const now = options.now ?? new Date();
  const poolKey = options.poolKey ?? DEMO_POOL_KEY;
  const limit = Math.max(1, Math.min(options.limit ?? 3, 10));
  await queueExpiredDemoPoolLeases(now, poolKey);
  await queueOutdatedDemoPoolEnvironments(now, poolKey);
  await recoverStaleDemoPoolWorkers(now, poolKey);
  const queued = await prisma.demoPoolEnvironment.findMany({
    where: { poolKey, state: "RECYCLING" },
    orderBy: [{ recycleRequestedAt: "asc" }, { slot: "asc" }],
    take: limit,
    select: { companyId: true },
  });
  const results: RecycleResult[] = [];
  for (const environment of queued) {
    results.push(await recycleDemoPoolEnvironment(environment.companyId, {
      now,
      assertStorageEmpty: options.assertStorageEmpty,
    }));
  }
  return results;
}
