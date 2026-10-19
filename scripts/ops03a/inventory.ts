import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/services/prisma/client";
import { createAdminClient } from "../../src/services/supabase/admin";

const output = resolve(process.argv[2] ?? "outputs/ops03a/inventory.json");
const knownPgDumpPaths = [
  "/opt/homebrew/opt/libpq/bin/pg_dump",
  "/opt/homebrew/bin/pg_dump",
  "/usr/local/bin/pg_dump",
  "/Applications/Postgres.app/Contents/Versions/latest/bin/pg_dump",
];

async function executable(path: string) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const database = await prisma.$queryRaw<Array<{
    version: string;
    bytes: bigint;
    public_tables: bigint;
    rls_tables: bigint;
  }>>(Prisma.sql`
    SELECT
      current_setting('server_version') AS version,
      pg_database_size(current_database()) AS bytes,
      (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_tables,
      (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity) AS rls_tables
  `);
  const storageObjects = await prisma.$queryRaw<Array<{ objects: bigint; bytes: bigint }>>(Prisma.sql`
    SELECT
      count(*) AS objects,
      coalesce(sum(coalesce((metadata->>'size')::bigint, 0)), 0) AS bytes
    FROM storage.objects
    WHERE bucket_id = 'delivery-pods'
  `);
  const proofReferences = await prisma.delivery.count({
    where: { podPhotoPath: { not: null } },
  });
  const bucket = await createAdminClient().storage.getBucket("delivery-pods");
  if (bucket.error || !bucket.data) throw new Error("OPS03A_POD_BUCKET_UNAVAILABLE");

  const availablePgDump = (await Promise.all(
    knownPgDumpPaths.map(async (path) => ({ path, available: await executable(path) }))
  )).filter((candidate) => candidate.available).map((candidate) => candidate.path);
  const vercel = JSON.parse(await readFile(resolve("vercel.json"), "utf8")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };
  const row = database[0];
  const storage = storageObjects[0];
  if (!row || !storage) throw new Error("OPS03A_INVENTORY_EMPTY");

  const proof = {
    task: "OPS-03A-inventory",
    passed: true,
    inspectedAt: new Date().toISOString(),
    environment: {
      identifiedAs: "current-authorized-test-target",
      dedicatedPreproduction: false,
      hostingAccountPolicyInspected: false,
      providerAccessRequired: true,
    },
    database: {
      engine: "PostgreSQL",
      version: row.version,
      sizeMiB: Math.ceil(Number(row.bytes) / 1024 / 1024),
      publicTables: Number(row.public_tables),
      rlsTables: Number(row.rls_tables),
      migrationBaselinePresent: await exists(resolve("prisma/migrations")),
    },
    storage: {
      bucketPresent: true,
      bucketPrivate: bucket.data.public === false,
      objects: Number(storage.objects),
      sizeMiB: Math.ceil(Number(storage.bytes) / 1024 / 1024),
      databaseProofReferences: proofReferences,
      objectBackupPolicyInspected: false,
    },
    application: {
      localCodeArchiveKnown: true,
      cronRoutes: vercel.crons?.map((cron) => cron.path).sort() ?? [],
      secretsBackedUp: false,
      pgDumpAvailable: availablePgDump.length > 0,
    },
    mutations: 0,
    blockers: [
      "hosting backup policy not readable without provider access",
      "storage object backup policy not readable without provider access",
      "no isolated restore target",
      ...(availablePgDump.length ? [] : ["pg_dump not installed in known local paths"]),
    ],
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    passed: proof.passed,
    database: { version: proof.database.version, sizeMiB: proof.database.sizeMiB },
    storage: { private: proof.storage.bucketPrivate, objects: proof.storage.objects },
    pgDumpAvailable: proof.application.pgDumpAvailable,
    mutations: proof.mutations,
    blockers: proof.blockers.length,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "OPS03A_UNKNOWN_ERROR");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
