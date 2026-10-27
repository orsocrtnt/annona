import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { PERF02_PG_URL } from "./local-database";
import { startPerf02Postgres, stopPerf02Postgres } from "./disposable-postgres";

// Orchestrateur : PostgreSQL Homebrew jetable, schéma par `prisma db push`, mesure, puis suppression.
const output = resolve(process.argv[2] ?? "outputs/perf02/postgres-local.json");

try {
  startPerf02Postgres();
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
  try { stopPerf02Postgres(); } catch { /* Le répertoire jetable est supprimé même si l'arrêt a déjà eu lieu. */ }
}
