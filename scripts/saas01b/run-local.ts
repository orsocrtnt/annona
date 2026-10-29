import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const port = "55439";
const dataDir = "/tmp/tutelliv-saas01b-pg";
const logFile = "/tmp/tutelliv-saas01b-pg.log";
const databaseUrl = `postgresql://postgres:saas01b@127.0.0.1:${port}/saas01b`;
const output = resolve(process.argv[2] ?? "outputs/saas01b/local-connected.json");
const dockerContainer = "tutelliv-saas01b-pg";

function run(command: string, args: string[], env?: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { encoding: "utf8", env: env ?? process.env, stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}

function hasDocker() {
  return spawnSync("docker", ["info"], { encoding: "utf8", stdio: "ignore" }).status === 0;
}

function pgBin(name: string) {
  const brew = spawnSync("brew", ["--prefix", "postgresql@15"], { encoding: "utf8" });
  if (brew.status === 0) {
    const candidate = resolve(brew.stdout.trim(), "bin", name);
    if (existsSync(candidate)) return candidate;
  }
  const which = spawnSync("which", [name], { encoding: "utf8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  throw new Error(`SAAS01B_${name.toUpperCase()}_MISSING`);
}

function waitUntil(check: () => boolean, label: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (check()) return;
    spawnSync("sleep", ["1"]);
  }
  throw new Error(label);
}

function stopHomebrewPostgres() {
  spawnSync(pgBin("pg_ctl"), ["-D", dataDir, "stop", "-m", "fast"], { encoding: "utf8" });
  rmSync(dataDir, { recursive: true, force: true });
}

function startHomebrewPostgres() {
  const pgCtl = pgBin("pg_ctl");
  stopHomebrewPostgres();
  run(pgBin("initdb"), ["-D", dataDir, "-U", "postgres", "--encoding=UTF8", "--locale=C", "--auth=trust"]);
  appendFileSync(dataDir + "/postgresql.conf", "\nlisten_addresses = '127.0.0.1'\nport = " + port + "\nunix_socket_directories = '/tmp'\n");
  run(pgCtl, ["-D", dataDir, "-l", logFile, "-o", `-p ${port} -h 127.0.0.1 -k /tmp`, "start"]);
  waitUntil(
    () => spawnSync(pgBin("pg_isready"), ["-h", "127.0.0.1", "-p", port, "-U", "postgres"], { encoding: "utf8" }).status === 0,
    "SAAS01B_POSTGRES_NOT_READY",
  );
  run(pgBin("createdb"), ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "saas01b"]);
  run(pgBin("psql"), ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "saas01b", "-c", "ALTER USER postgres PASSWORD 'saas01b';"]);
}

function startDockerPostgres() {
  spawnSync("docker", ["rm", "-f", dockerContainer], { encoding: "utf8" });
  run("docker", ["run", "-d", "--name", dockerContainer, "-e", "POSTGRES_PASSWORD=saas01b", "-e", "POSTGRES_DB=saas01b", "-p", `${port}:5432`, "postgres:16-alpine"]);
  waitUntil(
    () => spawnSync("docker", ["exec", dockerContainer, "pg_isready", "-U", "postgres"], { encoding: "utf8" }).status === 0,
    "SAAS01B_POSTGRES_NOT_READY",
  );
}

function psql(args: string[]) {
  return run(pgBin("psql"), ["-h", "127.0.0.1", "-p", port, "-U", "postgres", "-d", "saas01b", "-v", "ON_ERROR_STOP=1", ...args], {
    ...process.env,
    PGPASSWORD: "saas01b",
  });
}

function prepareIsolatedSchema(env: NodeJS.ProcessEnv) {
  execFileSync(resolve("node_modules/.bin/prisma"), ["db", "push", "--accept-data-loss", "--skip-generate", "--schema", "prisma/schema.prisma"], {
    encoding: "utf8",
    env,
    stdio: "inherit",
  });
  for (const file of [
    "prisma/migrations/20261023180000_catalog_c8_prices/migration.sql",
    "prisma/migrations/20261024011000_catalog_c9_business/migration.sql",
    "prisma/migrations/20261029200000_catalog_c10_dispatch_intelligent/migration.sql",
  ]) {
    psql(["-f", resolve(file)]);
  }
  psql(["-c", "ALTER TABLE saas_billing_accounts ENABLE ROW LEVEL SECURITY; ALTER TABLE saas_billing_operations ENABLE ROW LEVEL SECURITY;"]);
}

function migrateAndTest() {
  const env = { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl };
  prepareIsolatedSchema(env);
  mkdirSync(resolve("outputs/saas01b"), { recursive: true });
  execFileSync(resolve("node_modules/.bin/tsx"), ["scripts/saas01b/connected.ts", output], { encoding: "utf8", env, stdio: "inherit" });
}

const docker = hasDocker();
try {
  if (docker) startDockerPostgres();
  else startHomebrewPostgres();
  migrateAndTest();
} finally {
  if (docker) spawnSync("docker", ["rm", "-f", dockerContainer], { encoding: "utf8" });
  else {
    try { stopHomebrewPostgres(); } catch { /* Isolated data dir is discarded even if stop already happened. */ }
  }
}
