import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PERF02_PG_CONCURRENCY } from "./local-database";
import { measureHttpLevel, PERF02_NEXT_PAGES } from "./next-measure";

// PERF-02 — charge mesurée sur la préproduction (accord du propriétaire du 30 octobre 2026).
// Lecture seule et sans session : pages publiques, catalogue d'inscription et session anonyme.
// Plafond conservateur pour rester dans l'offre gratuite : 24 requêtes par niveau, concurrence 1 à 16.
export const PERF02_PREPROD_HOSTS = ["tutelliv.fr", "tutelliv-v2-git-preproduction-tutelliv.vercel.app"] as const;
export const PERF02_PREPROD_REQUESTS_PER_LEVEL = 24;

export const PERF02_PREPROD_ROUTES = [
  ...PERF02_NEXT_PAGES,
  { name: "Connexion", path: "/login" },
  { name: "API session (anonyme)", path: "/api/auth/session" },
] as const;

/** Refuse toute cible autre que la préproduction en HTTPS : jamais la production ni un tiers. */
export function assertPreprodPerf02Target(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("PERF02_PREPROD_TARGET_INVALID");
  }
  if (url.protocol !== "https:" || !(PERF02_PREPROD_HOSTS as readonly string[]).includes(url.hostname) || url.pathname !== "/" || url.search) {
    throw new Error("PERF02_PREPROD_TARGET_REFUSED");
  }
  return url.origin;
}

export async function runPreprodMeasure(rawBase: string, requestsPerLevel = PERF02_PREPROD_REQUESTS_PER_LEVEL) {
  const base = assertPreprodPerf02Target(rawBase);
  const get = (path: string) => fetch(`${base}${path}`, { redirect: "manual", headers: { "User-Agent": "TutelLiv-PERF02/1.0" } });
  const routes = [];
  for (const route of PERF02_PREPROD_ROUTES) {
    for (let warm = 0; warm < 2; warm += 1) await (await get(route.path)).arrayBuffer();
    const levels = [];
    for (const concurrency of PERF02_PG_CONCURRENCY) levels.push(await measureHttpLevel(concurrency, requestsPerLevel, () => get(route.path)));
    // Reprise : un niveau isolé juste après le pic, pour voir si la latence redescend.
    const recovery = await measureHttpLevel(1, Math.min(8, requestsPerLevel), () => get(route.path));
    routes.push({ ...route, levels, recovery });
  }
  return { base, routes };
}

async function main() {
  const output = resolve(process.argv[3] ?? "outputs/perf02/preprod-public.json");
  const result = await runPreprodMeasure(process.argv[2] ?? "https://tutelliv.fr/");
  const report = { measuredAt: new Date().toISOString(), node: process.version, client: "poste local (New York) vers Vercel cdg1", ...result };
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`PERF-02 préproduction : ${output}`);
}

if (process.argv[1]?.endsWith("preprod-public.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "PERF02_PREPROD_FAILED");
    process.exitCode = 1;
  });
}
