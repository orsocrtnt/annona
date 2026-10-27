import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PERF02_PG_PORT, PERF02_PG_DATABASE, assertLocalPerf02Database } from "./local-database";
import { pgBin, run, startPerf02Postgres, stopPerf02Postgres } from "./disposable-postgres";
import { PERF02_NEXT_PORT, PERF02_NEXT_URL, nextLocalEnv, runNextMeasure } from "./next-measure";

// Orchestrateur : PostgreSQL jetable + catalogue actif, build de production, `next start` local, mesure, suppression.
const output = resolve(process.argv[2] ?? "outputs/perf02/next-local.json");
const env = nextLocalEnv();
assertLocalPerf02Database(env.DATABASE_URL);

async function waitUntilReady() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${PERF02_NEXT_URL}/`)).ok) return;
    } catch { /* Serveur pas encore prêt. */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("PERF02_NEXT_NOT_READY");
}

async function main() {
  startPerf02Postgres();
  const server = { process: null as ReturnType<typeof spawn> | null };
  try {
    execFileSync(resolve("node_modules/.bin/prisma"), ["db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], { env, stdio: "inherit" });
    // Catalogue actif C8 puis C9 : lu par la page Tarifs et l'API d'inscription.
    for (const file of ["prisma/migrations/20261023180000_catalog_c8_prices/migration.sql", "prisma/migrations/20261024011000_catalog_c9_business/migration.sql"]) {
      run(pgBin("psql"), ["-h", "127.0.0.1", "-p", PERF02_PG_PORT, "-U", "postgres", "-d", PERF02_PG_DATABASE, "-v", "ON_ERROR_STOP=1", "-f", resolve(file)], env);
    }
    execFileSync(resolve("node_modules/.bin/next"), ["build"], { env, stdio: "inherit" });
    server.process = spawn(resolve("node_modules/.bin/next"), ["start", "-H", "127.0.0.1", "-p", PERF02_NEXT_PORT], { env, stdio: "ignore" });
    await waitUntilReady();
    const result = await runNextMeasure(PERF02_NEXT_URL);
    const stored = execFileSync(pgBin("psql"), ["-h", "127.0.0.1", "-p", PERF02_PG_PORT, "-U", "postgres", "-d", PERF02_PG_DATABASE, "-tAc", "SELECT count(*) FROM contact_messages"], { env, encoding: "utf8" }).trim();
    const report = {
      measuredAt: new Date().toISOString(),
      node: process.version,
      server: "next start (build de production), 127.0.0.1, PostgreSQL 15 local jetable, pool de 5",
      ...result,
      contactMessagesStored: Number(stored),
    };
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`PERF-02 Next local : ${output}`);
  } finally {
    server.process?.kill("SIGTERM");
    try { stopPerf02Postgres(); } catch { /* Le répertoire jetable est supprimé même si l'arrêt a déjà eu lieu. */ }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PERF02_NEXT_FAILED");
  process.exitCode = 1;
});
