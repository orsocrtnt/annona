import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { inspectLegacyDemoSessions } from "../src/domains/data-lifecycle/demo-legacy-inventory.service";
import { demoPersonaSeedUsers } from "../src/domains/demo/demo-users.service";
import { demoFixtureAuthId } from "../src/lib/demo/constants";

function candidate(id: string, overrides: Record<string, unknown> = {}) {
  const users = demoPersonaSeedUsers(id).map((seed) => {
    const [local, domain] = seed.email.toLowerCase().split("@");
    return {
      id: `user-${seed.roleSlug}-${seed.authId ?? "admin"}`,
      authId: seed.authId ?? demoFixtureAuthId("admin", id),
      email: `${local}+session-${id}@${domain}`,
      avatarUrl: null,
      role: { slug: seed.roleSlug },
    };
  });
  return {
    id,
    isDemo: true,
    slug: `logiexpress-demo-session-${"a".repeat(24)}`,
    status: "ACTIVE" as const,
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    settings: { demoSession: true } as Prisma.JsonValue,
    logoUrl: null,
    users,
    deliveries: [],
    invoices: [],
    operationJobs: [],
    _count: {
      orders: 8,
      deliveries: 8,
      invoices: 0,
      recurringOrders: 0,
      supportTickets: 0,
      operationJobs: 0,
    },
    ...overrides,
  };
}

test("legacy inventory aggregates old demos without exposing identifiers", async () => {
  const first = candidate("company-secret");
  const second = candidate("company-risk", {
    status: "INACTIVE",
    users: [],
    deliveries: [{ id: "proof-secret" }],
    invoices: [{ id: "invoice-secret" }],
    operationJobs: [{ id: "job-secret" }],
  });
  const result = await inspectLegacyDemoSessions(
    { now: new Date("2026-10-18T12:00:00.000Z") },
    { findCandidates: async () => [first, second] }
  );

  assert.equal(result.inspected, 2);
  assert.equal(result.classification.missingRetention, 2);
  assert.equal(result.databaseReviewCandidates, 1);
  assert.equal(result.safetySignals.nonActiveStatus, 1);
  assert.equal(result.safetySignals.changedRoster, 1);
  assert.equal(result.safetySignals.deliveryProofReference, 1);
  assert.equal(result.safetySignals.invoiceDocumentReference, 1);
  assert.equal(result.safetySignals.unfinishedJobs, 1);
  assert.equal(result.deepSafety.checked, 0);
  assert.equal(result.deepReviewCandidates, 0);
  assert.equal(result.mutations, 0);
  const serialized = JSON.stringify(result);
  for (const secret of ["company-secret", "company-risk", "proof-secret", "invoice-secret", "job-secret"]) {
    assert.ok(!serialized.includes(secret));
  }
});

test("legacy inventory reports malformed markers, assets and the bounded limit", async () => {
  const malformed = candidate("malformed", {
    settings: { demoSession: true, demoRetention: { version: 1, expiresAt: "wrong" } },
    logoUrl: "private-reference",
  });
  const rows = Array.from({ length: 1_001 }, (_, index) =>
    index === 0 ? malformed : candidate(`candidate-${index}`, { settings: {} })
  );
  const result = await inspectLegacyDemoSessions(
    { now: new Date("2026-10-18T12:00:00.000Z") },
    { findCandidates: async () => rows }
  );

  assert.equal(result.inspected, 1_000);
  assert.equal(result.truncated, true);
  assert.equal(result.classification.invalidRetention, 1);
  assert.equal(result.classification.missingSessionMarker, 999);
  assert.equal(result.safetySignals.companyOrUserAssetReference, 1);
  assert.equal(result.limitations.storageObjectsChecked, false);
  assert.equal(result.limitations.crossTenantReferencesChecked, false);
  assert.equal(result.limitations.deletionEligibilityEstablished, false);
});

test("deep legacy inventory checks Storage and tenant boundaries without changing eligibility", async () => {
  const safe = candidate("safe-company");
  const storage = candidate("storage-company");
  const crossed = candidate("crossed-company");
  const visited: string[] = [];
  const result = await inspectLegacyDemoSessions(
    { now: new Date("2026-10-18T12:00:00.000Z"), deep: true },
    {
      findCandidates: async () => [safe, storage, crossed],
      hasCrossTenantReference: async (companyId) => {
        visited.push(`cross:${companyId}`);
        return companyId === "crossed-company";
      },
      inspectStorage: async (companyId) => {
        visited.push(`storage:${companyId}`);
        return companyId === "storage-company" ? "objectsPresent" : "empty";
      },
    }
  );

  assert.equal(result.deepSafety.checked, 3);
  assert.equal(result.deepSafety.crossTenantReferences, 1);
  assert.equal(result.deepSafety.storageObjectsPresent, 1);
  assert.equal(result.deepReviewCandidates, 1);
  assert.equal(result.limitations.storageObjectsChecked, true);
  assert.equal(result.limitations.crossTenantReferencesChecked, true);
  assert.equal(result.limitations.deletionEligibilityEstablished, false);
  assert.equal(visited.length, 6);
  assert.ok(!JSON.stringify(result).includes("safe-company"));
});
