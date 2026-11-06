import { spawnSync } from "node:child_process";
import { appendFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { PERF02_PG_DATABASE, PERF02_PG_PORT } from "./local-database";

// PostgreSQL Homebrew jetable partagé par les mesures PERF-02 : créé vide, supprimé après usage.
const dataDir = "/tmp/annona-perf02-pg";
const logFile = "/tmp/annona-perf02-pg.log";

export function pgBin(name: string) {
  const brew = spawnSync("brew", ["--prefix", "postgresql@15"], { encoding: "utf8" });
  if (brew.status !== 0) throw new Error("PERF02_POSTGRES15_MISSING");
  return resolve(brew.stdout.trim(), "bin", name);
}

export function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const result = spawnSync(command, args, { encoding: "utf8", env, stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
}

export function stopPerf02Postgres() {
  spawnSync(pgBin("pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"], { encoding: "utf8" });
  rmSync(dataDir, { recursive: true, force: true });
}

export function startPerf02Postgres() {
  stopPerf02Postgres();
  run(pgBin("initdb"), ["-D", dataDir, "-U", "postgres", "--encoding=UTF8", "--locale=C", "--auth=trust"]);
  appendFileSync(`${dataDir}/postgresql.conf`, `\nlisten_addresses = '127.0.0.1'\nport = ${PERF02_PG_PORT}\nunix_socket_directories = '/tmp'\n`);
  run(pgBin("pg_ctl"), ["-D", dataDir, "-l", logFile, "-w", "start"]);
  run(pgBin("createdb"), ["-h", "127.0.0.1", "-p", PERF02_PG_PORT, "-U", "postgres", PERF02_PG_DATABASE]);
}
