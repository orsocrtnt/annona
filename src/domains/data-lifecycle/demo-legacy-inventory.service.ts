import { Prisma, type CompanyStatus } from "@prisma/client";
import { demoPersonaSeedUsers } from "@/domains/demo/demo-users.service";
import {
  hasCrossTenantDemoReference,
  inspectDemoStorage,
  type DemoStorageInspection,
} from "@/domains/data-lifecycle/demo-cleanup.service";
import { demoSessionExpiry, DEMO_SESSION_LIFETIME_MS } from "@/lib/demo/retention";
import { DEMO_SESSION_COMPANY_PREFIX, demoFixtureAuthId } from "@/lib/demo/constants";
import { prisma } from "@/services/prisma/client";

const LEGACY_INVENTORY_LIMIT = 1_000;

type LegacyDemoCandidate = {
  id: string;
  isDemo: boolean;
  slug: string;
  status: CompanyStatus;
  createdAt: Date;
  settings: Prisma.JsonValue | null;
  logoUrl: string | null;
  users: Array<{
    id: string;
    authId: string;
    email: string;
    avatarUrl: string | null;
    role: { slug: string };
  }>;
  deliveries: Array<{ id: string }>;
  invoices: Array<{ id: string }>;
  operationJobs: Array<{ id: string }>;
  _count: {
    orders: number;
    deliveries: number;
    invoices: number;
    recurringOrders: number;
    supportTickets: number;
    operationJobs: number;
  };
};

type InventoryDependencies = {
  findCandidates?: () => Promise<LegacyDemoCandidate[]>;
  hasCrossTenantReference?: (companyId: string, userIds: string[]) => Promise<boolean>;
  inspectStorage?: (companyId: string) => Promise<DemoStorageInspection>;
};

function jsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : null;
}

function retentionClassification(company: LegacyDemoCandidate) {
  if (demoSessionExpiry(company)) return "managedRetention" as const;
  const settings = jsonObject(company.settings);
  if (settings?.demoSession !== true) return "missingSessionMarker" as const;
  if (!("demoRetention" in settings)) return "missingRetention" as const;
  return "invalidRetention" as const;
}

function hasExactSyntheticRoster(company: LegacyDemoCandidate) {
  const seeds = demoPersonaSeedUsers(company.id);
  return company.users.length === seeds.length && seeds.every((seed) => {
    const expectedAuthId = seed.authId ?? demoFixtureAuthId("admin", company.id);
    const [local, domain] = seed.email.toLowerCase().split("@");
    const expectedEmail = `${local}+session-${company.id}@${domain}`;
    return company.users.some((user) =>
      user.authId === expectedAuthId &&
      user.email === expectedEmail &&
      user.role.slug === seed.roleSlug &&
      !user.avatarUrl
    );
  });
}

function ageBucket(createdAt: Date, now: Date) {
  const ageDays = (now.getTime() - createdAt.getTime()) / (24 * 60 * 60 * 1_000);
  if (ageDays < 1) return "underOneDay" as const;
  if (ageDays < 7) return "oneToSevenDays" as const;
  if (ageDays < 30) return "sevenToThirtyDays" as const;
  return "overThirtyDays" as const;
}

export async function inspectLegacyDemoSessions(
  options: { now?: Date; deep?: boolean } = {},
  dependencies: InventoryDependencies = {}
) {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("INVALID_TIME");

  const findCandidates = dependencies.findCandidates ?? (() => prisma.company.findMany({
    where: {
      isDemo: true,
      slug: { startsWith: DEMO_SESSION_COMPANY_PREFIX },
      createdAt: { lte: new Date(now.getTime() - DEMO_SESSION_LIFETIME_MS) },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: LEGACY_INVENTORY_LIMIT + 1,
    select: {
      id: true,
      isDemo: true,
      slug: true,
      status: true,
      createdAt: true,
      settings: true,
      logoUrl: true,
      users: {
        select: {
          id: true,
          authId: true,
          email: true,
          avatarUrl: true,
          role: { select: { slug: true } },
        },
      },
      deliveries: {
        where: { podPhotoPath: { not: null } },
        select: { id: true },
        take: 1,
      },
      invoices: {
        where: { pdfUrl: { not: null } },
        select: { id: true },
        take: 1,
      },
      operationJobs: {
        where: { status: { in: ["PENDING", "PROCESSING"] } },
        select: { id: true },
        take: 1,
      },
      _count: {
        select: {
          orders: true,
          deliveries: true,
          invoices: true,
          recurringOrders: true,
          supportTickets: true,
          operationJobs: true,
        },
      },
    },
  }));

  const rows = await findCandidates();
  const candidates = rows.slice(0, LEGACY_INVENTORY_LIMIT);
  const classification = {
    managedRetention: 0,
    missingSessionMarker: 0,
    missingRetention: 0,
    invalidRetention: 0,
  };
  const age = {
    underOneDay: 0,
    oneToSevenDays: 0,
    sevenToThirtyDays: 0,
    overThirtyDays: 0,
  };
  const safetySignals = {
    nonActiveStatus: 0,
    changedRoster: 0,
    companyOrUserAssetReference: 0,
    deliveryProofReference: 0,
    invoiceDocumentReference: 0,
    unfinishedJobs: 0,
    businessGraphPresent: 0,
  };
  const deepSafety = {
    checked: 0,
    crossTenantReferences: 0,
    storageObjectsPresent: 0,
    storageUnavailable: 0,
    storageTimeout: 0,
    invalidStorageScope: 0,
  };
  let databaseReviewCandidates = 0;
  let deepReviewCandidates = 0;
  const hasCrossTenantReference = dependencies.hasCrossTenantReference ?? (
    (companyId: string, userIds: string[]) => prisma.$transaction(
      (tx) => hasCrossTenantDemoReference(tx, companyId, userIds),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 60_000 }
    )
  );
  const inspectStorage = dependencies.inspectStorage ?? inspectDemoStorage;

  for (const company of candidates) {
    const kind = retentionClassification(company);
    classification[kind] += 1;
    age[ageBucket(company.createdAt, now)] += 1;

    const exactRoster = hasExactSyntheticRoster(company);
    const companyOrUserAssetReference = Boolean(
      company.logoUrl || company.users.some((user) => user.avatarUrl)
    );
    const deliveryProofReference = company.deliveries.length > 0;
    const invoiceDocumentReference = company.invoices.length > 0;
    const unfinishedJobs = company.operationJobs.length > 0;
    const businessGraphPresent = Object.values(company._count).some((count) => count > 0);

    if (company.status !== "ACTIVE") safetySignals.nonActiveStatus += 1;
    if (!exactRoster) safetySignals.changedRoster += 1;
    if (companyOrUserAssetReference) safetySignals.companyOrUserAssetReference += 1;
    if (deliveryProofReference) safetySignals.deliveryProofReference += 1;
    if (invoiceDocumentReference) safetySignals.invoiceDocumentReference += 1;
    if (unfinishedJobs) safetySignals.unfinishedJobs += 1;
    if (businessGraphPresent) safetySignals.businessGraphPresent += 1;

    const databaseReviewCandidate =
      kind === "missingRetention" &&
      company.status === "ACTIVE" &&
      exactRoster &&
      !companyOrUserAssetReference &&
      !deliveryProofReference &&
      !invoiceDocumentReference &&
      !unfinishedJobs;
    if (databaseReviewCandidate) {
      databaseReviewCandidates += 1;
      if (options.deep) {
        deepSafety.checked += 1;
        const crossTenant = await hasCrossTenantReference(
          company.id,
          company.users.map((user) => user.id)
        );
        if (crossTenant) deepSafety.crossTenantReferences += 1;
        const storage = await inspectStorage(company.id);
        if (storage === "objectsPresent") deepSafety.storageObjectsPresent += 1;
        if (storage === "unavailable") deepSafety.storageUnavailable += 1;
        if (storage === "timeout") deepSafety.storageTimeout += 1;
        if (storage === "invalidId") deepSafety.invalidStorageScope += 1;
        if (!crossTenant && storage === "empty") deepReviewCandidates += 1;
      }
    }
  }

  return {
    dryRun: true,
    inspected: candidates.length,
    truncated: rows.length > LEGACY_INVENTORY_LIMIT,
    classification,
    age,
    safetySignals,
    databaseReviewCandidates,
    deepSafety,
    deepReviewCandidates,
    mutations: 0,
    identifiersDisclosed: 0,
    limitations: {
      storageObjectsChecked: options.deep === true,
      crossTenantReferencesChecked: options.deep === true,
      deletionEligibilityEstablished: false,
    },
  };
}
