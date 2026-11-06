import assert from "node:assert/strict";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

function loadCost1Perf02() {
  return import(pathToFileURL(resolve("scripts/cost1/perf02-local.mjs")).href);
}

function perfFixture() {
  const profiles = [
    ["STARTER", "starter", 5, 1_000],
    ["PRO", "pro", 10, 3_000],
    ["BUSINESS", "business", 25, 6_000],
  ] as const;
  return {
    schema: "annona-perf02-local-v1",
    target: { url: "http://127.0.0.1/perf02-local", locality: "loopback-only", networkRequests: 0, databaseWrites: 0, migrationsOrSeeds: 0 },
    guard: { rejectsNonLocalTargets: true, poolCapacity: 5, conservativeLocalCeiling: { concurrentOperations: 4, reason: "fixture" } },
    degradationAndRecovery: { attemptedConcurrentOperations: 12, acceptedBeforeSaturation: 5, saturationErrors: 7, highWaterMark: 5, recoveryOperations: 5, recoverySucceeded: true },
    scenarios: profiles.flatMap(([profile, profileKey, drivers, monthlyOrders]) => [1, 10, 50, 100].map((companies) => ({
      id: `${profileKey}-${companies}`,
      profile,
      companies,
      driversPerCompany: drivers,
      monthlyOrdersPerCompany: monthlyOrders,
      workload: {
        representedDrivers: drivers * companies,
        representedMonthlyOrders: monthlyOrders * companies,
        materializedCompanies: companies,
        isolationControlCompanies: companies === 1 ? 1 : 0,
        materializedOrders: companies * 12,
        materializedOrdersPerCompany: 12,
        extrapolatedOrders: monthlyOrders * companies - companies * 12,
      },
      measurements: { p50Ms: 1, p95Ms: 2, throughputOperationsPerSecond: 3, errors: 0, pool: { implementation: "fixture", capacity: 5, highWaterMark: 5, saturationErrors: 0 } },
      isolation: { crossTenantReadDenied: true, foreignReadError: "TENANT_FORBIDDEN" },
      analyticalExtrapolation: { formula: "fixture", boundary: "fixture" },
    }))),
  };
}

function modelFixture() {
  const profiles = [["starter", "Starter", 1_000], ["pro", "Pro", 3_000], ["business", "Business", 6_000]] as const;
  const scenarios: { profileKey: string; profile: string; companies: number; variantKey: string; volumes: { orders: number } }[] = [];
  for (const [profileKey, profile, orders] of profiles) {
    for (const companies of [1, 10, 50, 100]) {
      for (const variantKey of ["low", "central", "high"]) {
        scenarios.push({ profileKey, profile, companies, variantKey, volumes: { orders: orders * companies } });
      }
    }
  }
  return { scenarios };
}

test("COST-1 phase 2 : apparie les douze mesures locales sans importer de coût", async () => {
  const cost1Perf02 = await loadCost1Perf02();
  const result = cost1Perf02.buildPerf02Cost1Validation(perfFixture(), modelFixture());
  assert.equal(result.pairing.scenarios.length, 12);
  assert.equal(result.pairing.localPoolDegradationAndRecovery.recoverySucceeded, true);
  assert.equal(result.pairing.scenarios[0].cost1Scenario.documentaryVariantsMatched.length, 3);
  assert.equal(JSON.stringify(result).includes("costsEur"), false);
});

test("COST-1 phase 2 : refuse une sortie PERF-02 incomplète ou incompatible", async () => {
  const cost1Perf02 = await loadCost1Perf02();
  const incomplete = perfFixture(); incomplete.scenarios.pop();
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(incomplete, modelFixture()), /COST1_PERF02_SCENARIOS_INCOMPLETE/);
  const wrongSchema = perfFixture(); wrongSchema.schema = "perf02-incompatible";
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(wrongSchema, modelFixture()), /COST1_PERF02_SCHEMA_INCOMPATIBLE/);
  const remoteUrl = perfFixture(); remoteUrl.target.url = "https://preprod.example.invalid/perf02";
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(remoteUrl, modelFixture()), /COST1_PERF02_TARGET_URL_NOT_LOCAL/);
  const noGuard = perfFixture(); noGuard.guard.rejectsNonLocalTargets = false;
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(noGuard, modelFixture()), /COST1_PERF02_GUARD_INCOMPATIBLE/);
  const incompatible = perfFixture(); incompatible.scenarios[0]!.workload.representedMonthlyOrders = 999;
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(incompatible, modelFixture()), /COST1_PERF02_REPRESENTED_VOLUME_MISMATCH/);
  const reversedLatency = perfFixture(); reversedLatency.scenarios[0]!.measurements.p95Ms = 0;
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(reversedLatency, modelFixture()), /COST1_PERF02_LATENCY_INVALID/);
  const noExtrapolation = perfFixture(); noExtrapolation.scenarios[0]!.analyticalExtrapolation.formula = "";
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(noExtrapolation, modelFixture()), /COST1_PERF02_EXTRAPOLATION_MISSING/);
  const inconsistentRecovery = perfFixture(); inconsistentRecovery.degradationAndRecovery.saturationErrors = 6;
  assert.throws(() => cost1Perf02.buildPerf02Cost1Validation(inconsistentRecovery, modelFixture()), /COST1_PERF02_RECOVERY_INVALID/);
});
