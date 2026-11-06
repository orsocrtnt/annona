import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const PERF02_POOL_CAPACITY = 5;
export const PERF02_SAFE_CONCURRENCY = 4;
export const MATERIALIZED_ORDERS_PER_COMPANY = 12;

export const PROFILES = {
  STARTER: { drivers: 5, monthlyOrders: 1_000 },
  PRO: { drivers: 10, monthlyOrders: 3_000 },
  BUSINESS: { drivers: 25, monthlyOrders: 6_000 },
} as const;

export type ProfileName = keyof typeof PROFILES;
export type Perf02Scenario = {
  id: string;
  profile: ProfileName;
  companies: number;
  driversPerCompany: number;
  monthlyOrdersPerCompany: number;
};

export const PERF02_SCENARIOS: Perf02Scenario[] = (Object.keys(PROFILES) as ProfileName[]).flatMap((profile) =>
  [1, 10, 50, 100].map((companies) => ({
    id: `${profile.toLowerCase()}-${companies}`,
    profile,
    companies,
    driversPerCompany: PROFILES[profile].drivers,
    monthlyOrdersPerCompany: PROFILES[profile].monthlyOrders,
  })),
);

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function assertLocalPerf02Target(value = process.env.PERF02_TARGET_URL ?? "http://127.0.0.1/perf02-local") {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("PERF02_LOCAL_TARGET_URL_REQUIRED");
  }
  if (!LOCAL_HOSTS.has(target.hostname) || !["http:", "https:"].includes(target.protocol)) {
    throw new Error("PERF02_REMOTE_TARGET_FORBIDDEN");
  }
  return target.toString();
}

export function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]!;
}

function rounded(value: number) {
  return Number(value.toFixed(3));
}

class LocalPool {
  active = 0;
  highWaterMark = 0;
  saturationErrors = 0;
  private waiting: (() => void)[] = [];

  constructor(private readonly capacity: number) {}

  private async acquire(rejectWhenFull = false) {
    if (this.active >= this.capacity) {
      if (rejectWhenFull) {
        this.saturationErrors++;
        throw new Error("POOL_SATURATED");
      }
      await new Promise<void>((resolve) => this.waiting.push(resolve));
    }
    this.active++;
    this.highWaterMark = Math.max(this.highWaterMark, this.active);
  }

  private release() {
    this.active--;
    this.waiting.shift()?.();
  }

  async use<T>(work: () => Promise<T> | T, rejectWhenFull = false): Promise<T> {
    await this.acquire(rejectWhenFull);
    try {
      return await work();
    } finally {
      this.release();
    }
  }
}

type FixtureOrder = { id: string; companyId: string; driverId: string; proof: string | null; position: number };

class SyntheticTenantStore {
  private readonly orders = new Map<string, FixtureOrder[]>();
  private readonly webhookIds = new Set<string>();

  constructor(readonly scenario: Perf02Scenario) {
    for (let index = 0; index < scenario.companies; index++) {
      const companyId = `company-${index}`;
      this.orders.set(companyId, Array.from({ length: MATERIALIZED_ORDERS_PER_COMPANY }, (_, orderIndex) => ({
        id: `${companyId}-order-${orderIndex}`,
        companyId,
        driverId: `${companyId}-driver-${orderIndex % scenario.driversPerCompany}`,
        proof: null,
        position: 0,
      })));
    }
    if (scenario.companies === 1) {
      this.orders.set("isolation-control-b", [{
        id: "isolation-control-b-order-0",
        companyId: "isolation-control-b",
        driverId: "isolation-control-b-driver-0",
        proof: null,
        position: 0,
      }]);
    }
  }

  private rows(companyId: string) {
    const rows = this.orders.get(companyId);
    if (!rows) throw new Error("TENANT_NOT_FOUND");
    return rows;
  }

  private order(companyId: string, index: number) {
    const order = this.rows(companyId)[index % MATERIALIZED_ORDERS_PER_COMPANY]!;
    if (order.companyId !== companyId) throw new Error("TENANT_ISOLATION_BREACH");
    return order;
  }

  private readAs(requestingCompanyId: string, targetCompanyId: string, index: number) {
    const order = this.order(targetCompanyId, index);
    if (order.companyId !== requestingCompanyId) throw new Error("TENANT_FORBIDDEN");
    return order;
  }

  exercise(companyId: string, operation: string, sequence: number) {
    const order = this.readAs(companyId, companyId, sequence);
    switch (operation) {
      case "connexion":
      case "tableau-de-bord":
        return createHash("sha256").update(`${companyId}:${this.rows(companyId).length}:${operation}`).digest("hex");
      case "creation-affectation":
        order.driverId = `${companyId}-driver-${sequence % this.scenario.driversPerCompany}`;
        return order.id;
      case "position-gps":
        order.position++;
        return order.position;
      case "realtime-local":
        return this.rows(companyId).filter((row) => row.position >= 0).length;
      case "preuve":
        order.proof = createHash("sha256").update(`${order.id}:proof`).digest("hex");
        return order.proof;
      case "export":
        return this.rows(companyId).map((row) => `${row.id},${row.companyId}`).join("\n").length;
      case "job-webhook":
        this.webhookIds.add(`${companyId}:synthetic-webhook:${sequence % 2}`);
        return this.webhookIds.size;
      default:
        throw new Error("PERF02_UNKNOWN_OPERATION");
    }
  }

  proveIsolation() {
    const companyA = "company-0";
    const companyB = this.scenario.companies > 1 ? "company-1" : "isolation-control-b";
    let foreignReadError: string | null = null;
    try {
      this.readAs(companyA, companyB, 0);
    } catch (error) {
      foreignReadError = error instanceof Error ? error.message : "UNKNOWN";
    }
    return {
      companyA,
      companyB,
      crossTenantReadDenied: foreignReadError === "TENANT_FORBIDDEN",
      foreignReadError,
      isolatedControlExcludedFromPopulation: this.scenario.companies === 1,
    };
  }
}

const OPERATIONS = [
  "connexion",
  "tableau-de-bord",
  "creation-affectation",
  "position-gps",
  "realtime-local",
  "preuve",
  "export",
  "job-webhook",
] as const;

async function nextTurn() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function measureScenario(scenario: Perf02Scenario) {
  const store = new SyntheticTenantStore(scenario);
  const pool = new LocalPool(PERF02_POOL_CAPACITY);
  const durations: number[] = [];
  const startedAt = performance.now();
  let errors = 0;
  await Promise.all(Array.from({ length: scenario.companies }, (_, companyIndex) => Promise.all(OPERATIONS.map(async (operation, sequence) => {
    const operationStartedAt = performance.now();
    try {
      await pool.use(async () => {
        await nextTurn();
        store.exercise(`company-${companyIndex}`, operation, sequence);
      });
      durations.push(performance.now() - operationStartedAt);
    } catch {
      errors++;
    }
  }))));
  const elapsedMs = performance.now() - startedAt;
  const representedOrders = scenario.monthlyOrdersPerCompany * scenario.companies;
  const materializedOrders = MATERIALIZED_ORDERS_PER_COMPANY * scenario.companies;
  return {
    ...scenario,
    method: "mesure-locale-echantillon-plafonne",
    workload: {
      representedDrivers: scenario.driversPerCompany * scenario.companies,
      representedMonthlyOrders: representedOrders,
      materializedCompanies: scenario.companies,
      isolationControlCompanies: scenario.companies === 1 ? 1 : 0,
      materializedOrders,
      materializedOrdersPerCompany: MATERIALIZED_ORDERS_PER_COMPANY,
      extrapolatedOrders: representedOrders - materializedOrders,
    },
    measurements: {
      operations: durations.length,
      errors,
      elapsedMs: rounded(elapsedMs),
      p50Ms: rounded(percentile(durations, 0.5)),
      p95Ms: rounded(percentile(durations, 0.95)),
      throughputOperationsPerSecond: rounded(durations.length / (elapsedMs / 1_000)),
      pool: {
        implementation: "pool-asynchrone-local-synthetique",
        capacity: PERF02_POOL_CAPACITY,
        highWaterMark: pool.highWaterMark,
        saturationErrors: pool.saturationErrors,
      },
    },
    isolation: store.proveIsolation(),
    analyticalExtrapolation: {
      appliesToOrders: representedOrders - materializedOrders,
      formula: "mesures locales × (commandes représentées / commandes matérialisées)",
      boundary: "Cette projection n'est pas une mesure PostgreSQL, Next.js, Realtime fournisseur, stockage ni réseau.",
    },
  };
}

async function measureDegradationAndRecovery() {
  const pool = new LocalPool(PERF02_POOL_CAPACITY);
  const attempts = await Promise.all(Array.from({ length: 12 }, async () => {
    try {
      await pool.use(async () => new Promise<void>((resolve) => setTimeout(resolve, 12)), true);
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : "UNKNOWN";
    }
  }));
  const saturationErrors = attempts.filter((result) => result === "POOL_SATURATED").length;
  const recovery = await Promise.all(Array.from({ length: PERF02_POOL_CAPACITY }, () => pool.use(async () => nextTurn(), true)));
  return {
    method: "mesure-locale-controlee",
    attemptedConcurrentOperations: attempts.length,
    acceptedBeforeSaturation: attempts.filter((result) => result === "accepted").length,
    saturationErrors,
    highWaterMark: pool.highWaterMark,
    recoveryOperations: recovery.length,
    recoverySucceeded: recovery.length === PERF02_POOL_CAPACITY && pool.active === 0,
  };
}

export async function runPerf02(target = assertLocalPerf02Target()) {
  const scenarios = [];
  for (const scenario of PERF02_SCENARIOS) scenarios.push(await measureScenario(scenario));
  const degradationAndRecovery = await measureDegradationAndRecovery();
  if (scenarios.some((scenario) => scenario.measurements.errors !== 0)) throw new Error("PERF02_NOMINAL_ERRORS");
  if (!scenarios.every((scenario) => scenario.isolation.crossTenantReadDenied)) throw new Error("PERF02_ISOLATION_FAILED");
  if (!degradationAndRecovery.recoverySucceeded || degradationAndRecovery.saturationErrors === 0) throw new Error("PERF02_RECOVERY_FAILED");
  return {
    schema: "annona-perf02-local-v1",
    executedAt: new Date().toISOString(),
    target: {
      url: target,
      locality: "loopback-only",
      networkRequests: 0,
      databaseWrites: 0,
      migrationsOrSeeds: 0,
    },
    guard: {
      rejectsNonLocalTargets: true,
      materializationCapOrdersPerCompany: MATERIALIZED_ORDERS_PER_COMPANY,
      poolCapacity: PERF02_POOL_CAPACITY,
      conservativeLocalCeiling: {
        concurrentOperations: PERF02_SAFE_CONCURRENCY,
        reason: "80 % du pool synthétique local de cinq ; au-delà, la saturation contrôlée est observée. Ce n'est pas un plafond de production.",
      },
    },
    scenarios,
    degradationAndRecovery,
    limitations: [
      "Les latences p50/p95 et le débit sont des mesures réelles du processus Node local, pas des mesures de préproduction.",
      "Le pool est un modèle asynchrone local ; la saturation PostgreSQL/Prisma réelle doit être mesurée sur une cible isolée autorisée.",
      "Realtime est simulé en mémoire : l'application n'ouvre actuellement aucun canal fournisseur à mesurer.",
      "Les commandes au-delà de douze par entreprise sont extrapolées analytiquement et séparées de la mesure.",
    ],
  };
}

async function main() {
  const output = resolve(process.argv[2] ?? "outputs/perf02/local.json");
  const result = await runPerf02();
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, output, scenarios: result.scenarios.length, degradationAndRecovery: result.degradationAndRecovery }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/perf02/run-local.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
