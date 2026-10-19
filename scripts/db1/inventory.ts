import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "../../src/services/prisma/client";

const output = resolve(process.argv[2] ?? "outputs/db1/inventory.json");
const baselineOutput = resolve(process.argv[3] ?? "outputs/db1/prisma-baseline-draft.sql");
const securityBaselineOutput = resolve(process.argv[4] ?? "outputs/db1/security-baseline-draft.sql");
const prismaBinary = resolve("node_modules/.bin/prisma");

function runDiff(args: string[]) {
  return execFileSync(prismaBinary, ["migrate", "diff", ...args, "--script"], {
    encoding: "utf8",
    env: process.env,
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function summarizeDiff(sql: string) {
  const operations: Record<string, number> = {};
  for (const match of sql.matchAll(/^-- ([A-Za-z]+)$/gm)) {
    const operation = match[1]!;
    operations[operation] = (operations[operation] ?? 0) + 1;
  }
  const constraints = [...new Set([...sql.matchAll(/CONSTRAINT "([^"]+)"/g)].map((match) => match[1]!))].sort();
  const columnAlterations = [...sql.matchAll(/ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" ([^;]+);/g)]
    .map((match) => ({ table: match[1]!, column: match[2]!, action: match[3]!.trim() }));
  return {
    empty: !/\b(?:ALTER|CREATE|DROP)\b/.test(sql),
    sha256: hash(sql),
    statements: (sql.match(/;/g) ?? []).length,
    operations,
    constraints,
    columnAlterations,
  };
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function schemaFingerprint() {
  const result = await prisma.$queryRaw<Array<{ fingerprint: string }>>(Prisma.sql`
    SELECT md5(string_agg(definition, E'\n' ORDER BY definition)) AS fingerprint
    FROM (
      SELECT 'table:' || c.relname || ':rls=' || c.relrowsecurity::text AS definition
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      UNION ALL
      SELECT 'column:' || table_name || ':' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '')
      FROM information_schema.columns
      WHERE table_schema = 'public'
      UNION ALL
      SELECT 'constraint:' || c.conname || ':' || pg_get_constraintdef(c.oid, true)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public'
      UNION ALL
      SELECT 'index:' || indexname || ':' || indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      UNION ALL
      SELECT 'enum:' || t.typname || ':' || e.enumlabel || ':' || e.enumsortorder::text
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
    ) objects
  `);
  if (!result[0]?.fingerprint) throw new Error("DB1_SCHEMA_FINGERPRINT_EMPTY");
  return result[0].fingerprint;
}

async function main() {
  const before = await schemaFingerprint();
  const publicTables = await prisma.$queryRaw<Array<{ name: string; rls: boolean }>>(Prisma.sql`
    SELECT tablename AS name, rowsecurity AS rls
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);
  const catalog = await prisma.$queryRaw<Array<{
    public_tables: bigint;
    rls_tables: bigint;
    policies: bigint;
    direct_grants: bigint;
    migration_table_present: boolean;
  }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') AS public_tables,
      (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity) AS rls_tables,
      (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS policies,
      (SELECT count(*) FROM information_schema.table_privileges
        WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated', 'PUBLIC')) AS direct_grants,
      to_regclass('public._prisma_migrations') IS NOT NULL AS migration_table_present
  `);
  const foreignKeys = await prisma.$queryRaw<Array<{
    name: string;
    update_action: string;
    delete_action: string;
  }>>(Prisma.sql`
    SELECT
      c.conname AS name,
      CASE c.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS update_action,
      CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS delete_action
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
      AND c.conname IN (
        'client_notifications_order_message_id_fkey',
        'order_messages_author_id_fkey',
        'order_messages_order_id_fkey',
        'order_thread_reads_order_id_fkey',
        'order_thread_reads_user_id_fkey'
      )
    ORDER BY c.conname
  `);
  const updatedAt = await prisma.$queryRaw<Array<{ column_default: string | null }>>(Prisma.sql`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'operation_jobs' AND column_name = 'updated_at'
  `);

  const pendingSql = runDiff([
    "--from-schema-datasource", "prisma/schema.prisma",
    "--to-schema-datamodel", "prisma/schema.prisma",
  ]);
  const baselineSql = runDiff([
    "--from-empty",
    "--to-schema-datamodel", "prisma/schema.prisma",
  ]);
  const after = await schemaFingerprint();
  const row = catalog[0];
  if (!row) throw new Error("DB1_CATALOG_EMPTY");
  if (before !== after) throw new Error("DB1_READ_ONLY_FINGERPRINT_CHANGED");

  const baselineHeader = [
    "-- DB-1 DRAFT ONLY — generated from prisma/schema.prisma; never apply directly.",
    "-- This draft excludes Supabase Auth/Storage, RLS enablement, grants and provider configuration.",
    "-- Reconcile the pending live diff and test a reviewed migration on an isolated target first.",
    "",
  ].join("\n");
  await mkdir(dirname(baselineOutput), { recursive: true });
  await writeFile(baselineOutput, `${baselineHeader}${baselineSql}\n`, "utf8");
  const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const securitySql = [
    "-- DB-1 SECURITY DRAFT ONLY — generated from the current authorized test target.",
    "-- Review and apply only after the Prisma baseline on an isolated Supabase target.",
    "-- Auth, Storage buckets/policies and provider roles remain outside this draft.",
    "",
    ...publicTables.flatMap(({ name }) => [
      `ALTER TABLE ${quoteIdentifier(name)} ENABLE ROW LEVEL SECURITY;`,
      `REVOKE ALL PRIVILEGES ON TABLE ${quoteIdentifier(name)} FROM PUBLIC, anon, authenticated;`,
      "",
    ]),
  ].join("\n");
  await writeFile(securityBaselineOutput, `${securitySql}\n`, "utf8");

  const proof = {
    task: "DB-1-inventory",
    passed: true,
    inspectedAt: new Date().toISOString(),
    target: "current-authorized-test-target",
    repository: {
      migrationBaselinePresent: await exists(resolve("prisma/migrations")),
      schemaModels: Prisma.dmmf.datamodel.models.length,
      schemaEnums: Prisma.dmmf.datamodel.enums.length,
    },
    live: {
      publicTables: Number(row.public_tables),
      rlsTables: Number(row.rls_tables),
      policies: Number(row.policies),
      directGrantsToPublicRoles: Number(row.direct_grants),
      prismaMigrationTablePresent: row.migration_table_present,
      inspectedForeignKeys: foreignKeys,
      operationJobsUpdatedAtDefault: updatedAt[0]?.column_default ?? null,
    },
    pendingDiff: summarizeDiff(pendingSql),
    baselineDraft: {
      path: "outputs/db1/prisma-baseline-draft.sql",
      sha256: hash(baselineSql),
      statements: (baselineSql.match(/;/g) ?? []).length,
      includesRlsAndGrants: false,
      applicableWithoutReview: false,
    },
    securityBaselineDraft: {
      path: "outputs/db1/security-baseline-draft.sql",
      sha256: hash(securitySql),
      tables: publicTables.length,
      allSourceTablesRlsEnabled: publicTables.every(({ rls }) => rls),
      includesAuthAndStorage: false,
      applicableWithoutReview: false,
    },
    readOnly: {
      schemaFingerprintBefore: before,
      schemaFingerprintAfter: after,
      unchanged: before === after,
      mutations: 0,
    },
    blockers: [
      ...(/\b(?:ALTER|CREATE|DROP)\b/.test(pendingSql) ? ["live schema still differs from prisma/schema.prisma"] : []),
      "Prisma baseline requires the separate reviewed security draft plus Auth and Storage configuration",
      "no isolated preproduction target for migration and rollback rehearsal",
      "complete restore rehearsal remains OPS-03A",
    ],
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    passed: proof.passed,
    tables: proof.live.publicTables,
    rlsTables: proof.live.rlsTables,
    migrationBaseline: proof.repository.migrationBaselinePresent,
    pendingStatements: proof.pendingDiff.statements,
    fingerprintUnchanged: proof.readOnly.unchanged,
    mutations: proof.readOnly.mutations,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "DB1_INVENTORY_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
