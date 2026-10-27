import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const PERF02_SCHEMA = "tutelliv-perf02-local-v1";
export const COST1_PERF02_SCHEMA = "tutelliv-cost1-perf02-local-v1";

const expectedProfiles = {
  starter: { perfProfile: "STARTER", label: "Starter", drivers: 5, monthlyOrders: 1_000 },
  pro: { perfProfile: "PRO", label: "Pro", drivers: 10, monthlyOrders: 3_000 },
  business: { perfProfile: "BUSINESS", label: "Business", drivers: 25, monthlyOrders: 6_000 },
};
const expectedCompanies = [1, 10, 50, 100];
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function failure(code) {
  throw new Error(code);
}

function object(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) failure(code);
  return value;
}

function finite(value, code) {
  if (typeof value !== "number" || !Number.isFinite(value)) failure(code);
  return value;
}

function nonNegative(value, code) {
  const result = finite(value, code);
  if (result < 0) failure(code);
  return result;
}

export function expectedScenarioKeys() {
  return Object.keys(expectedProfiles).flatMap((profileKey) =>
    expectedCompanies.map((companies) => `${profileKey}-${companies}`),
  );
}

export function validatePerf02(perf02) {
  const root = object(perf02, "COST1_PERF02_INVALID_ROOT");
  if (root.schema !== PERF02_SCHEMA) failure("COST1_PERF02_SCHEMA_INCOMPATIBLE");
  const target = object(root.target, "COST1_PERF02_TARGET_MISSING");
  if (target.locality !== "loopback-only" || target.networkRequests !== 0 || target.databaseWrites !== 0 || target.migrationsOrSeeds !== 0) {
    failure("COST1_PERF02_NOT_LOCAL_ONLY");
  }
  let targetUrl;
  try {
    targetUrl = new URL(target.url);
  } catch {
    failure("COST1_PERF02_TARGET_URL_INVALID");
  }
  if (!localHosts.has(targetUrl.hostname) || !["http:", "https:"].includes(targetUrl.protocol)) failure("COST1_PERF02_TARGET_URL_NOT_LOCAL");
  const guard = object(root.guard, "COST1_PERF02_GUARD_MISSING");
  if (guard.rejectsNonLocalTargets !== true || !Number.isInteger(guard.poolCapacity) || guard.poolCapacity < 1) {
    failure("COST1_PERF02_GUARD_INCOMPATIBLE");
  }
  const ceiling = object(guard.conservativeLocalCeiling, "COST1_PERF02_CEILING_MISSING");
  if (!Number.isInteger(ceiling.concurrentOperations) || ceiling.concurrentOperations < 1 || ceiling.concurrentOperations > guard.poolCapacity) {
    failure("COST1_PERF02_CEILING_INVALID");
  }
  if (!Array.isArray(root.scenarios) || root.scenarios.length !== 12) failure("COST1_PERF02_SCENARIOS_INCOMPLETE");
  const seen = new Set();
  const normalized = root.scenarios.map((raw) => {
    const scenario = object(raw, "COST1_PERF02_SCENARIO_INVALID");
    if (typeof scenario.id !== "string" || seen.has(scenario.id)) failure("COST1_PERF02_SCENARIO_DUPLICATE");
    seen.add(scenario.id);
    const profileKey = String(scenario.profile ?? "").toLowerCase();
    const profile = expectedProfiles[profileKey];
    if (!profile || scenario.profile !== profile.perfProfile) failure("COST1_PERF02_PROFILE_INCOMPATIBLE");
    if (!expectedCompanies.includes(scenario.companies)) failure("COST1_PERF02_COMPANY_COUNT_INCOMPATIBLE");
    const expectedId = `${profileKey}-${scenario.companies}`;
    if (scenario.id !== expectedId || scenario.driversPerCompany !== profile.drivers || scenario.monthlyOrdersPerCompany !== profile.monthlyOrders) {
      failure("COST1_PERF02_PROFILE_VOLUME_MISMATCH");
    }
    const workload = object(scenario.workload, "COST1_PERF02_WORKLOAD_MISSING");
    const representedOrders = profile.monthlyOrders * scenario.companies;
    if (workload.representedDrivers !== profile.drivers * scenario.companies || workload.representedMonthlyOrders !== representedOrders) {
      failure("COST1_PERF02_REPRESENTED_VOLUME_MISMATCH");
    }
    if (!Number.isInteger(workload.materializedOrders) || workload.materializedOrders <= 0 || workload.materializedOrders >= representedOrders) {
      failure("COST1_PERF02_MATERIALIZATION_INVALID");
    }
    if (workload.extrapolatedOrders !== representedOrders - workload.materializedOrders) failure("COST1_PERF02_EXTRAPOLATION_INVALID");
    const measurements = object(scenario.measurements, "COST1_PERF02_MEASUREMENTS_MISSING");
    const pool = object(measurements.pool, "COST1_PERF02_POOL_MISSING");
    const p50Ms = nonNegative(measurements.p50Ms, "COST1_PERF02_LATENCY_INVALID");
    const p95Ms = nonNegative(measurements.p95Ms, "COST1_PERF02_LATENCY_INVALID");
    if (p95Ms < p50Ms) failure("COST1_PERF02_LATENCY_INVALID");
    nonNegative(measurements.throughputOperationsPerSecond, "COST1_PERF02_THROUGHPUT_INVALID");
    nonNegative(measurements.errors, "COST1_PERF02_ERRORS_INVALID");
    if (!Number.isInteger(pool.capacity) || pool.capacity < 1 || !Number.isInteger(pool.highWaterMark) || pool.highWaterMark < 0 || pool.highWaterMark > pool.capacity) {
      failure("COST1_PERF02_POOL_INVALID");
    }
    const isolation = object(scenario.isolation, "COST1_PERF02_ISOLATION_MISSING");
    if (isolation.crossTenantReadDenied !== true) failure("COST1_PERF02_ISOLATION_FAILED");
    const extrapolation = object(scenario.analyticalExtrapolation, "COST1_PERF02_EXTRAPOLATION_MISSING");
    if (typeof extrapolation.formula !== "string" || extrapolation.formula.trim() === "" || typeof extrapolation.boundary !== "string" || extrapolation.boundary.trim() === "") {
      failure("COST1_PERF02_EXTRAPOLATION_MISSING");
    }
    return { profileKey, profile, scenario, workload, measurements, pool, isolation };
  });
  const expected = expectedScenarioKeys();
  if (seen.size !== expected.length || expected.some((key) => !seen.has(key))) failure("COST1_PERF02_SCENARIOS_INCOMPLETE");
  const degradation = object(root.degradationAndRecovery, "COST1_PERF02_RECOVERY_MISSING");
  if (
    degradation.recoverySucceeded !== true ||
    !Number.isInteger(degradation.attemptedConcurrentOperations) || degradation.attemptedConcurrentOperations < 1 ||
    !Number.isInteger(degradation.acceptedBeforeSaturation) || degradation.acceptedBeforeSaturation < 1 || degradation.acceptedBeforeSaturation > guard.poolCapacity ||
    !Number.isInteger(degradation.saturationErrors) || degradation.saturationErrors < 1 ||
    degradation.acceptedBeforeSaturation + degradation.saturationErrors !== degradation.attemptedConcurrentOperations ||
    !Number.isInteger(degradation.highWaterMark) || degradation.highWaterMark < 1 || degradation.highWaterMark > guard.poolCapacity || degradation.highWaterMark < degradation.acceptedBeforeSaturation ||
    !Number.isInteger(degradation.recoveryOperations) || degradation.recoveryOperations < 1 || degradation.recoveryOperations > guard.poolCapacity
  ) {
    failure("COST1_PERF02_RECOVERY_INVALID");
  }
  return { root, normalized, degradation, ceiling };
}

export function validateCost1Model(model) {
  const root = object(model, "COST1_MODEL_INVALID_ROOT");
  if (!Array.isArray(root.scenarios) || root.scenarios.length !== 36) failure("COST1_MODEL_SCENARIOS_INCOMPLETE");
  const expected = new Map(expectedScenarioKeys().map((key) => [key, new Set(["low", "central", "high"])]));
  for (const raw of root.scenarios) {
    const scenario = object(raw, "COST1_MODEL_SCENARIO_INVALID");
    const profile = expectedProfiles[scenario.profileKey];
    const key = `${scenario.profileKey}-${scenario.companies}`;
    if (!profile || scenario.profile !== profile.label || !expected.has(key) || !expected.get(key).has(scenario.variantKey)) {
      failure("COST1_MODEL_SCENARIO_INCOMPATIBLE");
    }
    const volumes = object(scenario.volumes, "COST1_MODEL_VOLUMES_MISSING");
    if (volumes.orders !== profile.monthlyOrders * scenario.companies) failure("COST1_MODEL_VOLUME_MISMATCH");
    expected.get(key).delete(scenario.variantKey);
  }
  if ([...expected.values()].some((variants) => variants.size !== 0)) failure("COST1_MODEL_SCENARIOS_INCOMPLETE");
  return root;
}

export function buildPerf02Cost1Validation(perf02, model, source = {}) {
  const perf = validatePerf02(perf02);
  validateCost1Model(model);
  const pairings = perf.normalized.map(({ profileKey, profile, scenario, workload, measurements, pool, isolation }) => ({
    id: scenario.id,
    cost1Scenario: {
      profileKey,
      profile: profile.label,
      companies: scenario.companies,
      driversPerCompany: profile.drivers,
      monthlyOrdersPerCompany: profile.monthlyOrders,
      documentaryVariantsMatched: ["low", "central", "high"],
    },
    localMeasurements: {
      p50Ms: measurements.p50Ms,
      p95Ms: measurements.p95Ms,
      throughputOperationsPerSecond: measurements.throughputOperationsPerSecond,
      errors: measurements.errors,
      pool: {
        implementation: pool.implementation,
        capacity: pool.capacity,
        highWaterMark: pool.highWaterMark,
        saturationErrorsDuringNominalRun: pool.saturationErrors,
      },
      materialization: {
        materializedCompanies: workload.materializedCompanies,
        isolationControlCompanies: workload.isolationControlCompanies,
        materializedOrders: workload.materializedOrders,
        materializedOrdersPerCompany: workload.materializedOrdersPerCompany,
        representedMonthlyOrders: workload.representedMonthlyOrders,
      },
      isolation: {
        crossTenantReadDenied: isolation.crossTenantReadDenied,
        foreignReadError: isolation.foreignReadError,
      },
    },
    analyticalExtrapolation: {
      extrapolatedOrders: workload.extrapolatedOrders,
      formula: scenario.analyticalExtrapolation?.formula,
      boundary: scenario.analyticalExtrapolation?.boundary,
    },
    economicsNotReplaced: [
      "coûts et marges documentaires",
      "CPU/mémoire/invocations Vercel",
      "paliers et coût Supabase",
      "taille/taux/coût des preuves",
      "e-mails",
      "navigation et cartographie",
      "support humain",
    ],
  }));
  assert.equal(pairings.length, 12);
  return {
    schema: COST1_PERF02_SCHEMA,
    generatedAt: new Date().toISOString(),
    status: "Rattachement des seules mesures locales PERF-02 ; aucune hypothèse économique documentaire n'est remplacée.",
    sources: source,
    pairing: {
      scenarios: pairings,
      localPoolDegradationAndRecovery: {
        attemptedConcurrentOperations: perf.degradation.attemptedConcurrentOperations,
        acceptedBeforeSaturation: perf.degradation.acceptedBeforeSaturation,
        saturationErrors: perf.degradation.saturationErrors,
        highWaterMark: perf.degradation.highWaterMark,
        recoveryOperations: perf.degradation.recoveryOperations,
        recoverySucceeded: perf.degradation.recoverySucceeded,
      },
      conservativeLocalCeiling: {
        concurrentOperations: perf.ceiling.concurrentOperations,
        reason: perf.ceiling.reason,
      },
    },
    economicHypothesesNotReplaced: [
      "Aucun coût, contribution, marge, commission ou palier fournisseur du modèle COST-1.",
      "CPU/mémoire/invocations Vercel et paliers de calcul Supabase.",
      "Preuves, e-mails, navigation/cartographie et support humain.",
      "Le pool mémoire local ne mesure pas Prisma, PostgreSQL, Next.js, réseau, stockage ou fournisseur Realtime.",
    ],
    missingMeasurementsBeforeReplacingEconomics: [
      "pool Prisma/PostgreSQL et serveur Next sur cible isolée autorisée",
      "CPU/mémoire/invocations Vercel et paliers Supabase observés",
      "taille, taux, stockage et egress des preuves",
      "cadence de navigation/cartographie et coût fournisseur contractuel",
      "e-mails réellement délivrés et support des trois pilotes",
    ],
  };
}

async function readJson(path, missingCode, invalidCode) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch {
    failure(missingCode);
  }
  try {
    return JSON.parse(content);
  } catch {
    failure(invalidCode);
  }
}

async function main() {
  const perfPath = resolve(process.argv[2] ?? "outputs/perf02/local.json");
  const modelPath = resolve(process.argv[3] ?? "outputs/cost1/model.json");
  const outputPath = resolve(process.argv[4] ?? "outputs/cost1/perf02-local-validation.json");
  const perf02 = await readJson(perfPath, "COST1_PERF02_INPUT_MISSING", "COST1_PERF02_INPUT_INVALID_JSON");
  const model = await readJson(modelPath, "COST1_MODEL_INPUT_MISSING", "COST1_MODEL_INPUT_INVALID_JSON");
  const result = buildPerf02Cost1Validation(perf02, model, {
    perf02: { path: perfPath, schema: perf02.schema, executedAt: perf02.executedAt },
    cost1Model: { path: modelPath, generatedAt: model.generatedAt },
  });
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ passed: true, output: outputPath, pairings: result.pairing.scenarios.length }));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve("scripts/cost1/perf02-local.mjs")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
