import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { PERF02_PG_DATABASE, PERF02_PG_PORT, PERF02_PG_URL } from "./local-database";

// Orchestrateur : PostgreSQL Homebrew jetable, schéma par `prisma db push`, mesure, puis suppression.
const dataDir = "/tmp/tutelliv-perf02-pg";
const logFile = "/tmp/tutelliv-perf02-pg.log";
const output = resolve(process.argv[2] ?? "outputs/perf02/postgres-local.json");

function pgBin(name: string) {
  const brew = spawnSync("brew", ["--prefix", "postgresql@15"], { encoding: "utf8" });
  if (brew.status !== 0) throw new Error("PERF02_POSTGRES15_MISSING");
  return resolve(brew.stdout.trim(), "bin", name);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
}

function stop() {
  spawnSync(pgBin("pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"], { encoding: "utf8" });
  rmSync(dataDir, { recursive: true, force: true });
}

function start() {
  stop();
  run(pgBin("initdb"), ["-D", dataDir, "-U", "postgres", "--encoding=UTF8", "--locale=C", "--auth=trust"]);
  appendFileSync(`${dataDir}/postgresql.conf`, `\nlisten_addresses = '127.0.0.1'\nport = ${PERF02_PG_PORT}\nunix_socket_directories = '/tmp'\n`);
  run(pgBin("pg_ctl"), ["-D", dataDir, "-l", logFile, "-w", "start"]);
  run(pgBin("createdb"), ["-h", "127.0.0.1", "-p", PERF02_PG_PORT, "-U", "postgres", PERF02_PG_DATABASE]);
}

try {
  start();
  const env = {
    ...process.env,
    DATABASE_URL: PERF02_PG_URL,
    DIRECT_URL: PERF02_PG_URL,
    DATABASE_CONNECTION_MODE: "",
    DATABASE_CONNECTION_LIMIT: "5",
    GEOCODING_URL: "http://127.0.0.1:9/perf02-no-network",
    EMAIL_DELIVERY_MODE: "disabled",
  };
  execFileSync(resolve("node_modules/.bin/prisma"), ["db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], { env, stdio: "inherit" });
  execFileSync(resolve("node_modules/.bin/tsx"), ["scripts/perf02/postgres-measure.ts", output], { env, stdio: "inherit" });
} finally {
  try { stop(); } catch { /* Le répertoire jetable est supprimé même si l'arrêt a déjà eu lieu. */ }
}
