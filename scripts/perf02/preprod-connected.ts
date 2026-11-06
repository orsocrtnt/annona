import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PERF02_PG_CONCURRENCY } from "./local-database";
import { crossCompanyCheck, get, login, logout, PERF02_CONNECTED_REQUESTS_PER_LEVEL, PERF02_CONNECTED_ROUTES, PERF02_DEMO_LOGIN } from "./next-connected";
import { measureHttpLevel } from "./next-measure";
import { assertPreprodPerf02Target } from "./preprod-public";

// PERF-02 — routes connectées sur la préproduction (accord du propriétaire du 30 octobre 2026).
// Lecture seule, sans compte créé : deux sessions démo de test, donc deux entreprises fictives,
// rendues au pool à la déconnexion. Même plafond que les routes publiques.
export async function runPreprodConnectedMeasure(rawBase: string, requestsPerLevel = PERF02_CONNECTED_REQUESTS_PER_LEVEL) {
  const base = assertPreprodPerf02Target(rawBase);
  const demo = await login(base, PERF02_DEMO_LOGIN);
  const second = await login(base, PERF02_DEMO_LOGIN);
  try {
    const routes = [];
    for (const route of PERF02_CONNECTED_ROUTES) {
      for (let warm = 0; warm < 2; warm += 1) await (await get(base, demo, route.path)).arrayBuffer();
      const levels = [];
      for (const concurrency of PERF02_PG_CONCURRENCY) {
        levels.push(await measureHttpLevel(concurrency, requestsPerLevel, () => get(base, demo, route.path)));
      }
      // Reprise : un niveau isolé juste après le pic, pour voir si la latence redescend.
      const recovery = await measureHttpLevel(1, Math.min(8, requestsPerLevel), () => get(base, demo, route.path));
      routes.push({ ...route, levels, recovery });
    }
    const isolation = await crossCompanyCheck(base, demo, second);
    return { base, routes, isolation };
  } finally {
    await logout(base, demo);
    await logout(base, second);
  }
}

// Recherche du point de saturation : paliers croissants, arrêt dès qu'un palier dépasse 5 % d'erreurs.
export const PERF02_SATURATION_LEVELS = [32, 64, 128] as const;
export const PERF02_SATURATION_ROUTES = PERF02_CONNECTED_ROUTES.filter((route) => ["/api/back-office/dashboard", "/api/dispatch/overview"].includes(route.path));
const SATURATION_ERROR_RATE = 0.05;

export async function runPreprodSaturationMeasure(rawBase: string) {
  const base = assertPreprodPerf02Target(rawBase);
  const demo = await login(base, PERF02_DEMO_LOGIN);
  try {
    const routes = [];
    for (const route of PERF02_SATURATION_ROUTES) {
      const levels = [];
      for (const concurrency of PERF02_SATURATION_LEVELS) {
        const level = await measureHttpLevel(concurrency, concurrency * 2, () => get(base, demo, route.path));
        levels.push(level);
        const failed = Object.entries(level.statuses).filter(([status]) => status !== "200").reduce((sum, [, count]) => sum + count, 0);
        if (failed / level.requests > SATURATION_ERROR_RATE) break;
      }
      const recovery = await measureHttpLevel(1, 8, () => get(base, demo, route.path));
      routes.push({ ...route, levels, recovery });
    }
    return { base, routes };
  } finally {
    await logout(base, demo);
  }
}

async function main() {
  const saturation = process.argv.includes("--saturation");
  const output = resolve(process.argv[3] ?? "outputs/perf02/preprod-connected.json");
  const target = process.argv[2] ?? "https://annona.fr/";
  const result = saturation ? await runPreprodSaturationMeasure(target) : await runPreprodConnectedMeasure(target);
  const report = { measuredAt: new Date().toISOString(), node: process.version, client: "poste local (New York) vers Vercel cdg1, base Supabase Paris", ...result };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PERF-02 préproduction connectée : ${output}`);
}

if (process.argv[1]?.endsWith("preprod-connected.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "PERF02_PREPROD_CONNECTED_FAILED");
    process.exitCode = 1;
  });
}
