import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createClient, type User as SupabaseUser } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/services/prisma/client";
import { provisionDemoEnvironment } from "@/domains/demo/demo-provision.service";
import {
  demoKeepEmails,
  demoPersonaSeedUsers,
  demoRosterAuthIds,
} from "@/domains/demo/demo-users.service";
import { hasCrossTenantDemoReference } from "@/domains/data-lifecycle/demo-cleanup.service";
import {
  DEMO_COMPANY_SLUG,
  DEMO_LOGIN_EMAIL,
  DEMO_SESSION_COMPANY_PREFIX,
  demoFixtureAuthId,
} from "@/lib/demo/constants";
import { isPodPhotoPathForDelivery } from "@/lib/storage/pod";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";

const BUCKET = "delivery-pods";
const SESSION_SLUG_PATTERN = new RegExp(`^${DEMO_SESSION_COMPANY_PREFIX}[a-f0-9]{24}$`);
const DEFAULT_MANIFEST = resolve(tmpdir(), "tutelliv-preproduction-browser-fixture.json");
const PROOF_DIRECTORY = "outputs/test2";

type Manifest = {
  version: 1;
  targetRef: string;
  startedAt: string;
  baseCompanyId: string | null;
  authUserId: string | null;
};

function manifestPath() {
  return process.env.TUTELLIV_BROWSER_FIXTURE_MANIFEST ?? DEFAULT_MANIFEST;
}

function assertPreproduction() {
  const errors = validatePreproductionEnvironment(process.env);
  if (errors.length) throw new Error(`PREPRODUCTION_GUARD_FAILED:${errors.join(",")}`);
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function listAllAuthUsers(): Promise<SupabaseUser[]> {
  const admin = adminClient();
  const users: SupabaseUser[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`AUTH_LIST_FAILED:${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function writeManifest(manifest: Manifest) {
  const path = manifestPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(path, 0o600);
}

async function readManifest(): Promise<Manifest | null> {
  try {
    return JSON.parse(await readFile(manifestPath(), "utf8")) as Manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeProof(name: string, proof: Record<string, unknown>) {
  await mkdir(PROOF_DIRECTORY, { recursive: true });
  await writeFile(
    `${PROOF_DIRECTORY}/${name}.json`,
    `${JSON.stringify({ ...proof, secretsIncluded: false }, null, 2)}\n`,
    "utf8"
  );
}

function ownedSlug(slug: string) {
  return slug === DEMO_COMPANY_SLUG || SESSION_SLUG_PATTERN.test(slug);
}

function expectedSessionUsers(companyId: string) {
  return demoPersonaSeedUsers(companyId).map((seed) => {
    const [local, domain = "tutelliv.fr"] = seed.email.toLowerCase().split("@");
    return {
      authId:
        seed.persona === "admin"
          ? demoFixtureAuthId("admin", companyId)
          : seed.authId,
      email: `${local}+session-${companyId}@${domain}`,
      roleSlug: seed.roleSlug,
    };
  });
}

function expectedBaseUsers(companyId: string, authUserId: string) {
  const authIds = demoRosterAuthIds(companyId);
  return demoPersonaSeedUsers(companyId).map((seed, index) => ({
    authId: seed.persona === "admin" ? authUserId : authIds[index],
    email: demoKeepEmails()[index],
    roleSlug: seed.roleSlug,
  }));
}

async function listStoragePaths(companyId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) throw new Error("FIXTURE_COMPANY_ID_INVALID");
  const storage = adminClient().storage.from(BUCKET);
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await storage.list(companyId, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`FIXTURE_STORAGE_LIST_FAILED:${error.message}`);
    const rows = data ?? [];
    paths.push(...rows.map((row) => `${companyId}/${row.name}`));
    if (rows.length < 100) return paths;
  }
}

export async function setupBrowserFixture() {
  assertPreproduction();
  const [companyCount, userCount, authUsers] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    listAllAuthUsers(),
  ]);
  if (companyCount !== 0 || userCount !== 0 || authUsers.length !== 0) {
    throw new Error("PREPRODUCTION_FIXTURE_TARGET_NOT_EMPTY");
  }

  const manifest: Manifest = {
    version: 1,
    targetRef: process.env.PREPROD_EXPECTED_SUPABASE_REF!,
    startedAt: new Date().toISOString(),
    baseCompanyId: null,
    authUserId: null,
  };
  await writeManifest(manifest);

  const result = await provisionDemoEnvironment();
  const provisionedAuthUsers = await listAllAuthUsers();
  const demoAuth = provisionedAuthUsers.filter(
    (user) => user.email?.toLowerCase() === DEMO_LOGIN_EMAIL
  );
  if (demoAuth.length !== 1) throw new Error("FIXTURE_AUTH_USER_UNEXPECTED");
  manifest.baseCompanyId = result.companyId;
  manifest.authUserId = demoAuth[0]!.id;
  await writeManifest(manifest);

  const [companies, users] = await Promise.all([
    prisma.company.findMany({ select: { id: true, slug: true, isDemo: true, status: true } }),
    prisma.user.count({ where: { companyId: result.companyId } }),
  ]);
  if (
    companies.length !== 1 ||
    companies[0]?.id !== result.companyId ||
    companies[0]?.slug !== DEMO_COMPANY_SLUG ||
    !companies[0]?.isDemo ||
    companies[0]?.status !== "ACTIVE" ||
    users !== demoPersonaSeedUsers(result.companyId).length
  ) {
    throw new Error("FIXTURE_PROVISION_VERIFICATION_FAILED");
  }

  await writeProof("browser-fixture-setup", {
    task: "preproduction-browser-fixture-setup",
    passed: true,
    target: "isolated-preproduction",
    counts: { companies: companies.length, users, authUsers: provisionedAuthUsers.length },
  });
  console.log(JSON.stringify({ passed: true, target: "isolated-preproduction", companies: 1, users }));
}

async function deleteCompanyFixture(company: {
  id: string;
  slug: string;
  isDemo: boolean;
  status: string;
  logoUrl: string | null;
}, manifest: Manifest) {
  if (!ownedSlug(company.slug) || !company.isDemo || company.status !== "ACTIVE" || company.logoUrl) {
    throw new Error("FIXTURE_COMPANY_GUARD_FAILED");
  }

  const [users, deliveries, invoices, storagePaths] = await Promise.all([
    prisma.user.findMany({
      where: { companyId: company.id },
      select: { id: true, authId: true, email: true, avatarUrl: true, role: { select: { slug: true } } },
    }),
    prisma.delivery.findMany({
      where: { companyId: company.id },
      select: { id: true, podPhotoPath: true },
    }),
    prisma.invoice.findMany({ where: { companyId: company.id }, select: { pdfUrl: true } }),
    listStoragePaths(company.id),
  ]);
  if (users.some((user) => user.avatarUrl) || invoices.some((invoice) => invoice.pdfUrl)) {
    throw new Error("FIXTURE_EXTERNAL_ASSET_GUARD_FAILED");
  }
  const expected = company.slug === DEMO_COMPANY_SLUG
    ? expectedBaseUsers(company.id, manifest.authUserId!)
    : expectedSessionUsers(company.id);
  if (
    users.length !== expected.length ||
    !expected.every((entry) => users.some((user) =>
      user.authId === entry.authId &&
      user.email.toLowerCase() === entry.email &&
      user.role.slug === entry.roleSlug
    ))
  ) {
    throw new Error("FIXTURE_ROSTER_GUARD_FAILED");
  }
  const deliveryIds = deliveries.map((delivery) => delivery.id);
  if (
    storagePaths.some((path) =>
      !deliveryIds.some((deliveryId) => isPodPhotoPathForDelivery(path, company.id, deliveryId))
    ) ||
    deliveries.some((delivery) =>
      delivery.podPhotoPath != null && !storagePaths.includes(delivery.podPhotoPath)
    )
  ) {
    throw new Error("FIXTURE_STORAGE_OWNERSHIP_GUARD_FAILED");
  }
  if (await prisma.$transaction((tx) =>
    hasCrossTenantDemoReference(tx, company.id, users.map((user) => user.id)))) {
    throw new Error("FIXTURE_CROSS_TENANT_REFERENCE");
  }

  if (storagePaths.length) {
    const { error } = await adminClient().storage.from(BUCKET).remove(storagePaths);
    if (error) throw new Error(`FIXTURE_STORAGE_DELETE_FAILED:${error.message}`);
  }
  if ((await listStoragePaths(company.id)).length !== 0) {
    throw new Error("FIXTURE_STORAGE_RESIDUE");
  }

  await prisma.$transaction(async (tx) => {
    const locked = await tx.company.findUnique({ where: { id: company.id } });
    if (!locked || locked.slug !== company.slug || !locked.isDemo || locked.status !== "ACTIVE") {
      throw new Error("FIXTURE_COMPANY_CHANGED");
    }
    await tx.operationJob.deleteMany({ where: { companyId: company.id } });
    await tx.supportTicket.deleteMany({ where: { companyId: company.id } });
    await tx.invoice.deleteMany({ where: { companyId: company.id } });
    await tx.order.deleteMany({ where: { companyId: company.id } });
    await tx.recurringOrder.deleteMany({ where: { companyId: company.id } });
    await tx.user.deleteMany({ where: { companyId: company.id } });
    await tx.company.delete({ where: { id: company.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 60_000 });

  return { storageObjectsRemoved: storagePaths.length };
}

export async function cleanupBrowserFixture() {
  assertPreproduction();
  const manifest = await readManifest();
  if (!manifest) {
    console.log(JSON.stringify({ passed: true, skipped: true, reason: "fixture-manifest-absent" }));
    return;
  }
  if (
    manifest.version !== 1 ||
    manifest.targetRef !== process.env.PREPROD_EXPECTED_SUPABASE_REF ||
    !Number.isFinite(new Date(manifest.startedAt).getTime())
  ) {
    throw new Error("FIXTURE_MANIFEST_INVALID");
  }

  const currentAuthUsers = await listAllAuthUsers();
  if (!manifest.authUserId) {
    const recoverable = currentAuthUsers.filter(
      (user) => user.email?.toLowerCase() === DEMO_LOGIN_EMAIL
    );
    if (recoverable.length > 1) throw new Error("FIXTURE_AUTH_RECOVERY_AMBIGUOUS");
    manifest.authUserId = recoverable[0]?.id ?? null;
  }

  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { slug: DEMO_COMPANY_SLUG },
        { slug: { startsWith: DEMO_SESSION_COMPANY_PREFIX } },
      ],
    },
    select: { id: true, slug: true, isDemo: true, status: true, logoUrl: true, createdAt: true },
  });
  if (companies.some((company) =>
    !ownedSlug(company.slug) || company.createdAt < new Date(manifest.startedAt))) {
    throw new Error("FIXTURE_OWNERSHIP_GUARD_FAILED");
  }
  const base = companies.find((company) => company.slug === DEMO_COMPANY_SLUG);
  if (base && manifest.baseCompanyId && base.id !== manifest.baseCompanyId) {
    throw new Error("FIXTURE_BASE_COMPANY_MISMATCH");
  }
  if (base && !manifest.authUserId) throw new Error("FIXTURE_BASE_AUTH_MISSING");

  let storageObjectsRemoved = 0;
  const ordered = [...companies].sort((left, right) =>
    left.slug === DEMO_COMPANY_SLUG ? 1 : right.slug === DEMO_COMPANY_SLUG ? -1 : 0
  );
  for (const company of ordered) {
    storageObjectsRemoved += (await deleteCompanyFixture(company, manifest)).storageObjectsRemoved;
  }

  if (manifest.authUserId) {
    const owned = currentAuthUsers.find((user) => user.id === manifest.authUserId);
    if (owned && owned.email?.toLowerCase() !== DEMO_LOGIN_EMAIL) {
      throw new Error("FIXTURE_AUTH_OWNERSHIP_GUARD_FAILED");
    }
    if (owned) {
      const { error } = await adminClient().auth.admin.deleteUser(owned.id);
      if (error) throw new Error(`FIXTURE_AUTH_DELETE_FAILED:${error.message}`);
    }
  }

  const [companyCount, userCount, authUsers] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    listAllAuthUsers(),
  ]);
  if (companyCount !== 0 || userCount !== 0 || authUsers.length !== 0) {
    throw new Error("FIXTURE_RESIDUE_DETECTED");
  }
  await writeProof("browser-fixture-cleanup", {
    task: "preproduction-browser-fixture-cleanup",
    passed: true,
    target: "isolated-preproduction",
    companiesRemoved: companies.length,
    storageObjectsRemoved,
    residue: { companies: companyCount, users: userCount, authUsers: authUsers.length },
  });
  await unlink(manifestPath());
  console.log(JSON.stringify({ passed: true, clean: true, companiesRemoved: companies.length, storageObjectsRemoved }));
}

export async function disconnectBrowserFixture() {
  await prisma.$disconnect();
}
