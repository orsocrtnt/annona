import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../../src/services/prisma/client";
import { cleanupExpiredDemoSession, DEMO_CLEANUP_AUTHORIZATION } from "../../src/domains/data-lifecycle/demo-cleanup.service";
import { createDemoSessionId, demoSessionCompanySlug, ensureDemoSessionEnvironment } from "../../src/domains/demo/demo-session.service";
import { demoRetentionSettings } from "../../src/lib/demo/retention";
import { exportCompanyData } from "../../src/domains/data-lifecycle/company-export.service";
import { deletePodPhoto, uploadPodPhoto } from "../../src/lib/storage/pod";
import { createAdminClient } from "../../src/services/supabase/admin";

const fixtureKey = `data02-retention-${randomUUID()}`;
const sessionIds = [createDemoSessionId(), createDemoSessionId()];
const slugs = [fixtureKey, ...sessionIds.map(demoSessionCompanySlug)];
const createdCompanyIds: string[] = [];
const uploaded: { path: string; companyId: string; deliveryId: string }[] = [];
const evidence: Record<string, unknown> = { task: "DATA-02", scope: "Expired managed demo sessions without external assets", executedAt: new Date().toISOString() };
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZuoAAAAASUVORK5CYII=", "base64");
const apply = { apply: true, authorization: DEMO_CLEANUP_AUTHORIZATION };
let failDeleteCompany: string | null = null;
prisma.$use(async (params, next) => {
  if (failDeleteCompany && params.model === "User" && params.action === "deleteMany" && params.args.where.companyId === failDeleteCompany) {
    failDeleteCompany = null;
    throw new Error("INJECTED_FAILURE_AFTER_CHILD_DELETES");
  }
  return next(params);
});

async function fingerprint(companyId: string) {
  const data = await exportCompanyData(companyId);
  return createHash("sha256").update(JSON.stringify(data?.data ?? null)).digest("hex");
}
async function totals() {
  const values = await Promise.all([
    prisma.company.count(), prisma.user.count(), prisma.order.count(), prisma.delivery.count(), prisma.invoice.count(),
    prisma.recurringOrder.count(), prisma.operationJob.count(), prisma.supportTicket.count(), prisma.supportTicketMessage.count(),
    prisma.orderItem.count(), prisma.orderStop.count(), prisma.trackingEvent.count(), prisma.orderMessage.count(),
    prisma.orderThreadRead.count(), prisma.clientNotification.count(), prisma.customerAddress.count(), prisma.driverLocation.count(),
  ]);
  return values;
}
async function cleanupFixtures() {
  failDeleteCompany = null;
  for (const object of uploaded) await deletePodPhoto(object.path, object.companyId, object.deliveryId);
  const companies = await prisma.company.findMany({ where: { slug: { in: slugs } } });
  for (const company of companies) {
    assert.ok(slugs.includes(company.slug));
    await prisma.$transaction(async (tx) => {
      await tx.operationJob.deleteMany({ where: { companyId: company.id } });
      await tx.supportTicket.deleteMany({ where: { companyId: company.id } });
      await tx.invoice.deleteMany({ where: { companyId: company.id } });
      await tx.order.deleteMany({ where: { companyId: company.id } });
      await tx.recurringOrder.deleteMany({ where: { companyId: company.id } });
      await tx.user.deleteMany({ where: { companyId: company.id } });
      await tx.company.delete({ where: { id: company.id } });
    }, { timeout: 60_000 });
  }
  for (const companyId of createdCompanyIds) {
    const result = await createAdminClient().storage.from("delivery-pods").list(companyId, { limit: 1 });
    assert.equal(result.error, null);
    assert.equal(result.data?.length, 0);
  }
}

async function run() {
  const before = await totals();
  try {
    const base = await prisma.company.create({ data: { slug: fixtureKey, name: "DATA-02 retention fixture", isDemo: true, status: "ACTIVE" } });
    createdCompanyIds.push(base.id);
    const a = await ensureDemoSessionEnvironment(base.id, sessionIds[0]!);
    createdCompanyIds.push(a.companyId);
    const b = await ensureDemoSessionEnvironment(base.id, sessionIds[1]!);
    createdCompanyIds.push(b.companyId);
    // Only this run's synthetic fixture receives an elapsed timestamp; no clock override in CLI.
    const createdAt = new Date(Date.now() - 10 * 60 * 60 * 1000);
    const aCompany = await prisma.company.findUniqueOrThrow({ where: { id: a.companyId } });
    await prisma.company.update({ where: { id: a.companyId }, data: {
      createdAt, settings: { ...(aCompany.settings as object), demoRetention: demoRetentionSettings(createdAt) },
    } });
    await prisma.company.update({ where: { id: base.id }, data: { isDemo: false } });
    const beforeB = await fingerprint(b.companyId);
    const beforeNormal = await fingerprint(base.id);
    const beforeA = await fingerprint(a.companyId);
    assert.equal((await cleanupExpiredDemoSession(a.companyId)).status, "eligible");
    assert.equal(await fingerprint(a.companyId), beforeA);
    assert.equal((await cleanupExpiredDemoSession(b.companyId, apply)).reason, "ACTIVE_SESSION");
    assert.equal((await cleanupExpiredDemoSession(base.id, apply)).reason, "UNMANAGED_OR_NON_DEMO");

    const delivery = await prisma.delivery.findFirstOrThrow({ where: { companyId: a.companyId } });
    const invoice = await prisma.invoice.create({ data: { reference: `${fixtureKey}-cross`, companyId: b.companyId, orderId: delivery.orderId, amount: 0 } });
    assert.equal((await cleanupExpiredDemoSession(a.companyId, apply)).reason, "CROSS_TENANT_REFERENCE");
    assert.ok(await prisma.invoice.findUnique({ where: { id: invoice.id } }));
    await prisma.invoice.delete({ where: { id: invoice.id } });

    const user = await prisma.user.findFirstOrThrow({ where: { companyId: a.companyId } });
    await prisma.user.update({ where: { id: user.id }, data: { authId: randomUUID() } });
    assert.equal((await cleanupExpiredDemoSession(a.companyId, apply)).reason, "NON_SYNTHETIC_OR_CHANGED_ROSTER");
    await prisma.user.update({ where: { id: user.id }, data: { authId: user.authId, updatedAt: user.updatedAt } });

    const object = { companyId: a.companyId, deliveryId: delivery.id, path: await uploadPodPhoto({ companyId: a.companyId, deliveryId: delivery.id, bytes, contentType: "image/png" }) };
    uploaded.push(object);
    assert.equal((await cleanupExpiredDemoSession(a.companyId, apply)).reason, "STORAGE_OBJECTS_PRESENT");
    const stored = await createAdminClient().storage.from("delivery-pods").download(object.path);
    assert.equal(stored.error, null);
    assert.deepEqual(Buffer.from(await stored.data!.arrayBuffer()), bytes);
    await prisma.delivery.update({ where: { id: delivery.id }, data: { podPhotoPath: object.path } });
    assert.equal((await cleanupExpiredDemoSession(a.companyId, apply)).reason, "EXTERNAL_ASSET_REFERENCE");
    await prisma.delivery.update({ where: { id: delivery.id }, data: { podPhotoPath: null, updatedAt: delivery.updatedAt } });
    await deletePodPhoto(object.path, object.companyId, object.deliveryId);

    const beforeFailure = await fingerprint(a.companyId);
    failDeleteCompany = a.companyId;
    await assert.rejects(cleanupExpiredDemoSession(a.companyId, apply), /INJECTED_FAILURE/);
    assert.equal(await fingerprint(a.companyId), beforeFailure);
    const concurrent = await Promise.all([cleanupExpiredDemoSession(a.companyId, apply), cleanupExpiredDemoSession(a.companyId, apply)]);
    assert.deepEqual(concurrent.map((result) => result.status).sort(), ["deleted", "missing"]);
    assert.equal((await cleanupExpiredDemoSession(a.companyId, apply)).status, "missing");
    assert.equal(await fingerprint(b.companyId), beforeB);
    assert.equal(await fingerprint(base.id), beforeNormal);
    assert.equal(await prisma.company.count({ where: { id: a.companyId } }), 0);
    assert.equal(await prisma.user.count({ where: { companyId: a.companyId } }), 0);
    assert.equal(await prisma.order.count({ where: { companyId: a.companyId } }), 0);
    assert.equal(await prisma.delivery.count({ where: { companyId: a.companyId } }), 0);
    Object.assign(evidence, { passed: true, expiredDeleted: true, dryRunUnchanged: true, activeUnchanged: true, normalUnchanged: true,
      crossTenantReferenceRejected: true, foreignInvoicePreserved: true, nonSyntheticIdentityRejected: true,
      storageOrphanPreserved: true, attachedPhotoRejected: true, transactionFailureFullyRolledBack: true,
      concurrentWorkers: ["deleted", "missing"], replay: "missing", authMutations: 0, cleanupStorageMutations: 0 });
  } catch {
    evidence.passed = false;
    evidence.error = "DEMO_RETENTION_ASSERTION_OR_PROVIDER_FAILED";
    process.exitCode = 1;
  } finally {
    try {
      await cleanupFixtures();
      const after = await totals();
      assert.deepEqual(after, before);
      assert.equal(await prisma.company.count({ where: { slug: { in: slugs } } }), 0);
      Object.assign(evidence, { clean: true, fixtureCompaniesRemaining: 0, fixtureStorageObjectsRemaining: 0, all17ModelCountsRestored: true });
    } catch { evidence.clean = false; process.exitCode = 1; }
    await mkdir("outputs/data02", { recursive: true });
    await writeFile("outputs/data02/demo-retention-connected.json", `${JSON.stringify(evidence, null, 2)}\n`);
    await prisma.$disconnect();
  }
  console.log(JSON.stringify(evidence));
}
void run();
