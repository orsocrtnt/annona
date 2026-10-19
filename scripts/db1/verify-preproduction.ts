import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";
import { prisma } from "../../src/services/prisma/client";

const output = resolve(process.argv[2] ?? "outputs/db1/preproduction-validation.json");

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function pendingDiff() {
  return execFileSync(resolve("node_modules/.bin/prisma"), [
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ], { encoding: "utf8", env: process.env, maxBuffer: 10 * 1024 * 1024 }).trim();
}

async function main() {
  const isolationErrors = validatePreproductionEnvironment(process.env);
  if (isolationErrors.length) throw new Error(`PREPRODUCTION_ISOLATION_FAILED:${isolationErrors.join(",")}`);

  const expectedTables = Prisma.dmmf.datamodel.models
    .map((model) => model.dbName ?? model.name)
    .sort();
  const publicTables = await prisma.$queryRaw<Array<{ name: string; rls: boolean }>>(Prisma.sql`
    SELECT tablename AS name, rowsecurity AS rls
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const catalog = await prisma.$queryRaw<Array<{
    policies: bigint;
    public_role_grants: bigint;
    migration_count: bigint;
  }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies,
      (SELECT count(*) FROM information_schema.table_privileges
        WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')) AS public_role_grants,
      (SELECT count(*) FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migration_count
  `);
  const bucketRows = await prisma.$queryRaw<Array<{
    public: boolean;
    file_size_limit: bigint | null;
    allowed_mime_types: string[] | null;
  }>>(Prisma.sql`
    SELECT public, file_size_limit, allowed_mime_types
    FROM storage.buckets
    WHERE id = 'delivery-pods'
  `);

  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const browser = createClient(url, required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: users, error: usersError }, { data: bucket, error: bucketError }, anonAttempt] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      admin.storage.getBucket("delivery-pods"),
      browser.from("companies").select("id", { count: "exact", head: true }),
    ]);
  if (usersError) throw new Error(`AUTH_CHECK_FAILED:${usersError.message}`);
  if (bucketError || !bucket) throw new Error(`STORAGE_CHECK_FAILED:${bucketError?.message ?? "missing"}`);

  const appTables = publicTables.filter(({ name }) => name !== "_prisma_migrations");
  const catalogRow = catalog[0];
  const bucketRow = bucketRows[0];
  const diff = pendingDiff();
  const checks = {
    expectedTablesPresent:
      JSON.stringify(appTables.map(({ name }) => name).sort()) === JSON.stringify(expectedTables),
    everyPublicTableHasRls: publicTables.length === expectedTables.length + 1 && publicTables.every(({ rls }) => rls),
    noPublicPolicies: Number(catalogRow?.policies ?? -1) === 0,
    noPublicRoleGrants: Number(catalogRow?.public_role_grants ?? -1) === 0,
    oneAppliedMigration: Number(catalogRow?.migration_count ?? -1) === 1,
    prismaSchemaHasNoDrift: !/\b(?:ALTER|CREATE|DROP)\b/.test(diff),
    noAuthUsers: users.users.length === 0,
    anonCannotReadCompanies: Boolean(anonAttempt.error),
    privatePodBucket:
      bucket.public === false &&
      bucketRow?.public === false &&
      Number(bucketRow?.file_size_limit ?? -1) === 5 * 1024 * 1024,
    podMimeTypesRestricted:
      JSON.stringify([...(bucketRow?.allowed_mime_types ?? [])].sort()) ===
      JSON.stringify(["image/jpeg", "image/png"]),
  };
  const passed = Object.values(checks).every(Boolean);
  const proof = {
    task: "DB-1-preproduction-baseline",
    inspectedAt: new Date().toISOString(),
    target: "isolated-preproduction",
    passed,
    checks,
    counts: {
      applicationTables: appTables.length,
      publicTablesIncludingMigrationLedger: publicTables.length,
      policies: Number(catalogRow?.policies ?? -1),
      publicRoleGrants: Number(catalogRow?.public_role_grants ?? -1),
      appliedMigrations: Number(catalogRow?.migration_count ?? -1),
      authUsersObserved: users.users.length,
    },
    secretsIncluded: false,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ passed, checks, counts: proof.counts }));
  if (!passed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "DB1_PREPRODUCTION_VERIFICATION_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
