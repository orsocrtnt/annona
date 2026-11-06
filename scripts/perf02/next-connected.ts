import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateDevEnvironment } from "../env2/verify-dev-env";
import { PERF02_PG_CONCURRENCY } from "./local-database";
import { measureHttpLevel } from "./next-measure";
import { assertLocalPerf02Target } from "./run-local";

// PERF-02 — routes connectées sur un build de production local servi contre `annona-dev` (ENV-2).
// Lecture seule : connexion démo et comptes de recette, aucune création. Plafond conservateur pour
// rester dans l'offre gratuite : 24 requêtes par niveau, concurrence 1 à 16.
export const PERF02_CONNECTED_PORT = "55452";
export const PERF02_CONNECTED_URL = `http://127.0.0.1:${PERF02_CONNECTED_PORT}`;
export const PERF02_CONNECTED_REQUESTS_PER_LEVEL = 24;

export const PERF02_CONNECTED_ROUTES = [
  { name: "Session", path: "/api/auth/session" },
  { name: "Tableau de bord", path: "/api/back-office/dashboard" },
  { name: "Statistiques commandes", path: "/api/orders/stats" },
  { name: "Livraisons", path: "/api/deliveries" },
  { name: "Vue dispatch", path: "/api/dispatch/overview" },
  { name: "Charge des livreurs", path: "/api/dispatch/drivers-workload" },
  { name: "Livreurs", path: "/api/drivers" },
  { name: "Page tableau de bord", path: "/dashboard" },
  { name: "Page dispatch", path: "/dispatch" },
] as const;

export const PERF02_DEMO_LOGIN = { email: "demo@annona.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" };

const output = resolve(process.argv[2] ?? "outputs/perf02/next-connected.json");

export type Session = { cookie: string };

export async function login(base: string, body: Record<string, unknown>): Promise<Session> {
  const response = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: base },
    body: JSON.stringify(body),
  });
  if (response.status !== 200) throw new Error(`PERF02_LOGIN_FAILED:${response.status}`);
  const cookie = response.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
  await response.arrayBuffer();
  return { cookie };
}

export const get = (base: string, session: Session, path: string) =>
  fetch(`${base}${path}`, { headers: { Cookie: session.cookie }, redirect: "manual" });

export async function logout(base: string, session: Session) {
  await fetch(`${base}/api/auth/logout`, { method: "POST", headers: { Cookie: session.cookie, Origin: base } }).catch(() => undefined);
}

async function deliveryIds(base: string, session: Session) {
  const response = await get(base, session, "/api/deliveries");
  return ((await response.json()).data as Array<{ id: string }>).map((delivery) => delivery.id);
}

/** Deux entreprises ouvertes en même temps : aucune livraison commune, et l'accès croisé répond 404. */
export async function crossCompanyCheck(base: string, demo: Session, other: Session) {
  const [mine, theirs] = await Promise.all([deliveryIds(base, demo), deliveryIds(base, other)]);
  const shared = mine.filter((id) => theirs.includes(id)).length;
  const crossed = await Promise.all([
    ...theirs.slice(0, 3).map(async (id) => (await get(base, demo, `/api/deliveries/${id}`)).status),
    ...mine.slice(0, 3).map(async (id) => (await get(base, other, `/api/deliveries/${id}`)).status),
  ]);
  return { demoDeliveries: mine.length, otherDeliveries: theirs.length, shared, crossStatuses: crossed };
}

export async function runConnectedMeasure(rawBase: string, other: { email: string; password: string } | null) {
  const base = assertLocalPerf02Target(rawBase).replace(/\/$/, "");
  const demo = await login(base, PERF02_DEMO_LOGIN);
  const second = other ? await login(base, { ...other, accountType: "company" }) : null;
  try {
    const routes = [];
    for (const route of PERF02_CONNECTED_ROUTES) {
      for (let warm = 0; warm < 2; warm += 1) await (await get(base, demo, route.path)).arrayBuffer();
      const levels = [];
      for (const concurrency of PERF02_PG_CONCURRENCY) {
        levels.push(await measureHttpLevel(concurrency, PERF02_CONNECTED_REQUESTS_PER_LEVEL, () => get(base, demo, route.path)));
      }
      routes.push({ ...route, levels });
    }
    const isolation = second ? await crossCompanyCheck(base, demo, second) : null;
    return { routes, isolation };
  } finally {
    await logout(base, demo);
    if (second) await logout(base, second);
  }
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${PERF02_CONNECTED_URL}/login`)).ok) return;
    } catch { /* Serveur pas encore prêt. */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("PERF02_NEXT_NOT_READY");
}

async function main() {
  const errors = validateDevEnvironment(process.env);
  if (errors.length) throw new Error(`DEV_ENVIRONMENT_REQUIRED:${errors.join(",")}`);
  const manifest = resolve("outputs/e2e-role-accounts.json");
  const other = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, "utf8")).dispatcher as { email: string; password: string }) : null;
  const env = { ...process.env, NODE_ENV: "production" as const, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_APP_URL: PERF02_CONNECTED_URL };
  const server = { process: null as ReturnType<typeof spawn> | null };
  try {
    execFileSync(resolve("node_modules/.bin/next"), ["build"], { env, stdio: "inherit" });
    server.process = spawn(resolve("node_modules/.bin/next"), ["start", "-H", "127.0.0.1", "-p", PERF02_CONNECTED_PORT], { env, stdio: "ignore" });
    await waitUntilReady();
    const result = await runConnectedMeasure(PERF02_CONNECTED_URL, other);
    const report = {
      measuredAt: new Date().toISOString(),
      node: process.version,
      server: "next start (build de production), 127.0.0.1, base annona-dev (Supabase, Paris) depuis le poste local",
      databaseConnectionLimit: process.env.DATABASE_CONNECTION_LIMIT ?? "défaut",
      ...result,
    };
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`PERF-02 routes connectées : ${output}`);
  } finally {
    server.process?.kill("SIGTERM");
  }
}

if (process.argv[1]?.endsWith("next-connected.ts")) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "PERF02_CONNECTED_FAILED");
    process.exitCode = 1;
  });
}
