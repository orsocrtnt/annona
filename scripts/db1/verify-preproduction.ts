import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";
import { prisma } from "../../src/services/prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../../prisma/reference-data";
import {
  DEMO_COMPANY_SLUG,
  DEMO_LOGIN_EMAIL,
  DEMO_SESSION_COMPANY_PREFIX,
  demoFixtureAuthId,
} from "../../src/lib/demo/constants";
import {
  demoKeepEmails,
  demoPersonaSeedUsers,
  demoRosterAuthIds,
} from "../../src/domains/demo/demo-users.service";
import { demoSessionExpiry } from "../../src/lib/demo/retention";

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

function canonical(value: unknown) {
  return JSON.stringify(value);
}

function scopedDemoEmail(email: string, companyId: string) {
  const [local, domain = "annona.fr"] = email.toLowerCase().split("@");
  return `${local}+session-${companyId}@${domain}`;
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
  const [roles, permissions, companies, appUsers] = await Promise.all([
    prisma.role.findMany({
      where: { isSystem: true },
      select: {
        slug: true,
        name: true,
        description: true,
        systemRole: true,
        isSystem: true,
        permissions: { select: { permission: { select: { slug: true } } } },
      },
      orderBy: { slug: "asc" },
    }),
    prisma.permission.findMany({
      select: { slug: true, name: true, resource: true, action: true },
      orderBy: { slug: "asc" },
    }),
    prisma.company.findMany({
      select: {
        id: true,
        slug: true,
        isDemo: true,
        status: true,
        logoUrl: true,
        settings: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({
      select: {
        companyId: true,
        authId: true,
        email: true,
        avatarUrl: true,
        role: { select: { slug: true } },
      },
    }),
  ]);

  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const browser = createClient(url, required("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const [{ data: authData, error: usersError }, { data: bucket, error: bucketError }, anonAttempt] =
    await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.storage.getBucket("delivery-pods"),
      browser.from("companies").select("id", { count: "exact", head: true }),
    ]);
  if (usersError) throw new Error(`AUTH_CHECK_FAILED:${usersError.message}`);
  if (bucketError || !bucket) throw new Error(`STORAGE_CHECK_FAILED:${bucketError?.message ?? "missing"}`);

  const appTables = publicTables.filter(({ name }) => name !== "_prisma_migrations");
  const catalogRow = catalog[0];
  const bucketRow = bucketRows[0];
  const diff = pendingDiff();
  const expectedMigrationCount = readdirSync(resolve("prisma/migrations"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .length;
  const expectedRoles = ROLES
    .map((role) => ({
      slug: role.slug,
      name: role.name,
      description: role.description,
      systemRole: role.systemRole,
      isSystem: true,
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
  const actualRoles = roles.map(({ permissions: _permissions, ...role }) => role);
  const expectedPermissions = [...PERMISSIONS].sort((left, right) => left.slug.localeCompare(right.slug));
  const actualRolePermissionEntries: Array<[string, string[]]> = roles
      .map((role): [string, string[]] => [
        role.systemRole,
        role.permissions.map(({ permission }) => permission.slug).sort(),
      ])
      .sort(([left], [right]) => left.localeCompare(right));
  const actualRolePermissions = Object.fromEntries(actualRolePermissionEntries);
  const expectedRolePermissionEntries: Array<[string, string[]]> = Object.entries(ROLE_PERMISSIONS)
    .map(([systemRole, slugs]): [string, string[]] => [systemRole, [...slugs].sort()])
    .sort(([left], [right]) => left.localeCompare(right));
  const expectedRolePermissions = Object.fromEntries(expectedRolePermissionEntries);
  const emptyApplicationData = companies.length === 0 && appUsers.length === 0 && authData.users.length === 0;
  const base = companies.find((company) => company.slug === DEMO_COMPANY_SLUG);
  const authUser = authData.users[0];
  const expectedEmails = base ? demoKeepEmails() : [];
  const expectedAuthIds = base && authUser
    ? demoRosterAuthIds(base.id).map((authId, index) => index === 0 ? authUser.id : authId)
    : [];
  const persistentDemoValid = Boolean(
    base?.slug === DEMO_COMPANY_SLUG &&
    base.isDemo &&
    base.status === "ACTIVE" &&
    !base.logoUrl &&
    authData.users.length === 1 &&
    authUser?.email?.toLowerCase() === DEMO_LOGIN_EMAIL &&
    appUsers.filter((user) => user.companyId === base.id).length === expectedEmails.length &&
    appUsers.filter((user) => user.companyId === base.id).every((user) =>
      user.companyId === base.id &&
      !user.avatarUrl &&
      expectedEmails.includes(user.email.toLowerCase()) &&
      expectedAuthIds.includes(user.authId) &&
      demoPersonaSeedUsers(base.id).some((seed) =>
        seed.email.toLowerCase() === user.email.toLowerCase() && seed.roleSlug === user.role.slug
      )
    )
  );
  const sessionCompanies = companies.filter((company) => company.slug !== DEMO_COMPANY_SLUG);
  const sessionSlugPattern = new RegExp(`^${DEMO_SESSION_COMPANY_PREFIX}[a-f0-9]{24}$`);
  const managedDemoSessionsValid = sessionCompanies.every((company) => {
    const companyUsers = appUsers.filter((user) => user.companyId === company.id);
    const expected = demoPersonaSeedUsers(company.id).map((seed) => ({
      authId: seed.persona === "admin" ? demoFixtureAuthId("admin", company.id) : seed.authId,
      email: scopedDemoEmail(seed.email, company.id),
      roleSlug: seed.roleSlug,
    }));
    return Boolean(
      company.isDemo &&
      company.status === "ACTIVE" &&
      !company.logoUrl &&
      sessionSlugPattern.test(company.slug) &&
      demoSessionExpiry(company) &&
      companyUsers.length === expected.length &&
      companyUsers.every((user) =>
        !user.avatarUrl && expected.some((entry) =>
          entry.authId === user.authId &&
          entry.email === user.email.toLowerCase() &&
          entry.roleSlug === user.role.slug
        )
      )
    );
  });
  const controlledDemoData = Boolean(
    persistentDemoValid &&
    managedDemoSessionsValid &&
    appUsers.length === expectedEmails.length * companies.length
  );
  const checks = {
    expectedTablesPresent:
      JSON.stringify(appTables.map(({ name }) => name).sort()) === JSON.stringify(expectedTables),
    everyPublicTableHasRls: publicTables.length === expectedTables.length + 1 && publicTables.every(({ rls }) => rls),
    noPublicPolicies: Number(catalogRow?.policies ?? -1) === 0,
    noPublicRoleGrants: Number(catalogRow?.public_role_grants ?? -1) === 0,
    allVersionedMigrationsApplied:
      Number(catalogRow?.migration_count ?? -1) === expectedMigrationCount,
    prismaSchemaHasNoDrift: !/\b(?:ALTER|CREATE|DROP)\b/.test(diff),
    referenceRolesMatch: canonical(actualRoles) === canonical(expectedRoles),
    referencePermissionsMatch: canonical(permissions) === canonical(expectedPermissions),
    referenceRolePermissionsMatch:
      canonical(actualRolePermissions) === canonical(expectedRolePermissions),
    controlledPreproductionData: emptyApplicationData || controlledDemoData,
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
      expectedMigrations: expectedMigrationCount,
      systemRoles: roles.length,
      permissions: permissions.length,
      rolePermissionLinks: roles.reduce((total, role) => total + role.permissions.length, 0),
      companiesObserved: companies.length,
      applicationUsersObserved: appUsers.length,
      authUsersObserved: authData.users.length,
      persistentDemoPresent: persistentDemoValid,
      managedDemoSessionsObserved: sessionCompanies.length,
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
