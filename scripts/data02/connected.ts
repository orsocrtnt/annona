import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { prisma } from "../../src/services/prisma/client";
import { exportCompanyData } from "../../src/domains/data-lifecycle/company-export.service";

import { exportCompanyArchive } from "../../src/domains/data-lifecycle/company-archive.service";
import { checkPodStorageHealth, deletePodPhoto, uploadPodPhoto } from "../../src/lib/storage/pod";
import { createAdminClient } from "../../src/services/supabase/admin";

const proofBytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZuoAAAAASUVORK5CYII=", "base64");
const uploaded: { path: string; companyId: string; deliveryId: string }[] = [];
const outputPath = resolve(process.argv[2] ?? "outputs/data02/connected.json");
const fixtureKey = `data02-${randomUUID()}`;

async function roleIds() {
  const rows = await prisma.role.findMany({
    where: { systemRole: { in: ["COMPANY_ADMIN", "CLIENT", "DRIVER"] } },
    select: { id: true, systemRole: true },
  });
  const roles = Object.fromEntries(rows.map((row) => [row.systemRole, row.id]));
  assert.ok(roles.COMPANY_ADMIN && roles.CLIENT && roles.DRIVER, "DATA02_ROLES_MISSING");
  return roles as Record<"COMPANY_ADMIN" | "CLIENT" | "DRIVER", string>;
}

async function createFixture(suffix: "a" | "b") {
  const roles = await roleIds();
  const slug = `${fixtureKey}-${suffix}`;
  const company = await prisma.company.create({
    data: { name: `DATA-02 ${suffix.toUpperCase()}`, slug, isDemo: true },
  });
  const [admin, client, driver] = await Promise.all([
    prisma.user.create({ data: { authId: `${slug}-admin`, email: `admin@${slug}.invalid`, firstName: "Admin", lastName: "DATA-02", status: "ACTIVE", roleId: roles.COMPANY_ADMIN, companyId: company.id } }),
    prisma.user.create({ data: { authId: `${slug}-client`, email: `client@${slug}.invalid`, firstName: "Client", lastName: "DATA-02", status: "ACTIVE", roleId: roles.CLIENT, companyId: company.id } }),
    prisma.user.create({ data: { authId: `${slug}-driver`, email: `driver@${slug}.invalid`, firstName: "Livreur", lastName: "DATA-02", status: "ACTIVE", roleId: roles.DRIVER, companyId: company.id } }),
  ]);
  await prisma.customerAddress.create({
    data: { label: "Site DATA-02", address: "1 rue de Test", city: "Paris", postalCode: "75001", isDefault: true, userId: client.id },
  });
  await prisma.driverLocation.create({
    data: { driverId: driver.id, latitude: 48.86, longitude: 2.34, accuracy: 10 },
  });
  const recurring = await prisma.recurringOrder.create({
    data: {
      label: `Récurrence ${slug}`,
      frequency: "WEEKLY",
      intervalValue: 1,
      intervalUnit: "WEEKS",
      nextRunAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      shippingAddress: "2 rue de Test",
      shippingCity: "Paris",
      shippingPostalCode: "75002",
      items: [{ name: "Dossier", quantity: 1 }],
      companyId: company.id,
      customerId: client.id,
    },
  });
  const order = await prisma.order.create({
    data: {
      reference: `CMD-DATA02-${suffix}-${randomUUID()}`,
      totalAmount: 25,
      itemCount: 1,
      notes: fixtureKey,
      companyId: company.id,
      customerId: client.id,
      customerEmail: client.email,
      recurringOrderId: recurring.id,
      shippingAddress: "3 rue de Test",
      shippingCity: "Paris",
      shippingPostalCode: "75003",
      items: { create: { name: "Colis DATA-02", quantity: 1, unitPrice: 25 } },
    },
  });
  const delivery = await prisma.delivery.create({
    data: {
      reference: `LIV-DATA02-${suffix}-${randomUUID()}`,
      status: "DELIVERED",
      address: "3 rue de Test",
      city: "Paris",
      postalCode: "75003",
      driverId: driver.id,
      driverName: "Livreur DATA-02",
      companyId: company.id,
      orderId: order.id,
      customerId: client.id,
      completedAt: new Date(),
      podOutcome: "SUCCESS",
      podPhotoPath: null,
      podCapturedAt: new Date(),
      trackingEvents: { create: { label: "Livrée", description: fixtureKey } },
    },
  });
  const path = await uploadPodPhoto({ companyId: company.id, deliveryId: delivery.id, bytes: proofBytes, contentType: "image/png" });
  uploaded.push({ path, companyId: company.id, deliveryId: delivery.id });
  await prisma.delivery.update({ where: { id: delivery.id }, data: { podPhotoPath: path } });
  const message = await prisma.orderMessage.create({
    data: { orderId: order.id, authorId: admin.id, authorName: "Admin DATA-02", authorRole: "COMPANY_ADMIN", body: fixtureKey, kind: "INSTRUCTION", requestKey: `${fixtureKey}-${suffix}` },
  });
  await Promise.all([
    prisma.orderThreadRead.create({ data: { orderId: order.id, userId: client.id, seenAt: new Date(), seenId: message.id } }),
    prisma.clientNotification.create({ data: { type: "ORDER_MESSAGE", title: "DATA-02", body: fixtureKey, href: `/portal/orders/${order.id}`, orderMessageId: message.id, userId: client.id } }),
    prisma.invoice.create({ data: { reference: `FAC-DATA02-${suffix}-${randomUUID()}`, amount: 25, lineItems: [{ label: "Livraison", amount: 25 }], companyId: company.id, orderId: order.id, customerId: client.id } }),
    prisma.supportTicket.create({ data: { subject: "DATA-02", message: fixtureKey, companyId: company.id, customerId: client.id, relatedOrderId: order.id, relatedDeliveryId: delivery.id, messages: { create: { body: fixtureKey, isStaff: false, authorId: client.id } } } }),
    prisma.operationJob.create({ data: { jobKey: `${fixtureKey}-${suffix}`, type: "CLIENT_NOTIFICATION", status: "SUCCEEDED", payload: { fixture: true }, completedAt: new Date(), companyId: company.id } }),
  ]);
  return { company, admin, client, driver, order, delivery, path };
}

async function companyCounts(companyId: string) {
  const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  const [companies, orders, deliveries, invoices, tickets, recurringOrders, jobs, locations, addresses] = await Promise.all([
    prisma.company.count({ where: { id: companyId } }),
    prisma.order.count({ where: { companyId } }),
    prisma.delivery.count({ where: { companyId } }),
    prisma.invoice.count({ where: { companyId } }),
    prisma.supportTicket.count({ where: { companyId } }),
    prisma.recurringOrder.count({ where: { companyId } }),
    prisma.operationJob.count({ where: { companyId } }),
    prisma.driverLocation.count({ where: { driverId: { in: userIds } } }),
    prisma.customerAddress.count({ where: { userId: { in: userIds } } }),
  ]);
  return { companies, users: users.length, orders, deliveries, invoices, tickets, recurringOrders, jobs, locations, addresses };
}

async function deleteFixtureCompany(companyId: string, expectedSlug: string) {
  assert.ok([`${fixtureKey}-a`, `${fixtureKey}-b`].includes(expectedSlug), "DATA02_FIXTURE_ONLY");
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { slug: true } });
  assert.equal(company?.slug, expectedSlug);
  await prisma.$transaction(async (tx) => {
    await tx.operationJob.deleteMany({ where: { companyId } });
    await tx.supportTicket.deleteMany({ where: { companyId } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.recurringOrder.deleteMany({ where: { companyId } });
    await tx.order.deleteMany({ where: { companyId } });
    await tx.user.deleteMany({ where: { companyId } });
    await tx.company.delete({ where: { id: companyId } });
  }, { maxWait: 10_000, timeout: 30_000 });
}

async function cleanup() {
  for (const proof of uploaded) {
    await deletePodPhoto(proof.path, proof.companyId, proof.deliveryId);
    const remaining = await createAdminClient().storage.from("delivery-pods").list(proof.companyId);
    assert.equal(remaining.error, null);
    assert.equal(remaining.data?.length, 0, "DATA02_STORAGE_RESIDUE");
  }
  const companies = await prisma.company.findMany({
    where: { slug: { in: [`${fixtureKey}-a`, `${fixtureKey}-b`] } },
    select: { id: true, slug: true },
  });
  for (const company of companies) await deleteFixtureCompany(company.id, company.slug);
}

async function run() {
  const evidence: Record<string, unknown> = {
    task: "DATA-02",
    executedAt: new Date().toISOString(),
    fixture: "Deux entreprises DATA-02 temporaires, identifiants aléatoires non exportés",
  };
  const archiveParent = await mkdtemp(join(tmpdir(), "data02-connected-"));
  try {
    await checkPodStorageHealth();
    const a = await createFixture("a");
    const b = await createFixture("b");
    const beforeB = await companyCounts(b.company.id);
    const exported = await exportCompanyData(a.company.id);
    assert.ok(exported);
    const serialized = JSON.stringify(exported);
    assert.equal(serialized.includes(b.company.id), false);
    assert.equal(serialized.includes(b.client.email), false);
    assert.equal(serialized.includes(b.order.reference), false);
    assert.equal(serialized.includes(a.admin.authId), false);
    assert.equal(serialized.includes("requestFingerprint"), false);
    assert.equal(serialized.includes("idempotencyKey"), false);
    assert.equal(exported.externalAssets.proofObjects.length, 1);

    const archive = await exportCompanyArchive(a.company.id, archiveParent);
    const rawManifest = await readFile(join(archive.path, "manifest.json"));
    assert.equal(createHash("sha256").update(rawManifest).digest("hex"), archive.manifestSha256);
    const manifest = JSON.parse(rawManifest.toString());
    for (const entry of manifest.entries) {
      const bytes = await readFile(join(archive.path, entry.path));
      assert.equal(bytes.length, entry.bytes);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256);
    }
    assert.deepEqual(await readFile(join(archive.path, "proofs/000001.png")), proofBytes);
    assert.equal(manifest.proofCount, 1);
    assert.equal(manifest.entries[1].deliveryId, a.delivery.id);
    const companyJson = await readFile(join(archive.path, "company.json"), "utf8");
    assert.equal(companyJson.includes(b.company.id), false);
    const beforeFiles = await readdir(archiveParent);
    await prisma.delivery.update({ where: { id: a.delivery.id }, data: { podPhotoPath: `${a.company.id}/${a.delivery.id}-0.png` } });
    await assert.rejects(exportCompanyArchive(a.company.id, archiveParent), /ARCHIVE_(PROOF_MISSING|DOWNLOAD_FAILED)/);
    assert.deepEqual(await readdir(archiveParent), beforeFiles);
    await prisma.delivery.update({ where: { id: a.delivery.id }, data: { podPhotoPath: b.path } });
    await assert.rejects(exportCompanyArchive(a.company.id, archiveParent), /ARCHIVE_INVALID_PROOF_PATH/);
    assert.deepEqual(await readdir(archiveParent), beforeFiles);
    await prisma.delivery.update({ where: { id: a.delivery.id }, data: { podPhotoPath: a.path } });
    const bPhoto = await createAdminClient().storage.from("delivery-pods").download(b.path);
    assert.equal(bPhoto.error, null);
    assert.deepEqual(Buffer.from(await bPhoto.data!.arrayBuffer()), proofBytes);
    const digest = createHash("sha256").update(serialized).digest("hex");
    await deleteFixtureCompany(a.company.id, a.company.slug);
    const [afterA, afterB] = await Promise.all([
      companyCounts(a.company.id),
      companyCounts(b.company.id),
    ]);
    assert.ok(Object.values(afterA).every((value) => value === 0));
    assert.deepEqual(afterB, beforeB);

    Object.assign(evidence, {
      passed: true,
      export: {
        schema: exported.schema,
        version: exported.version,
        counts: exported.counts,
        sha256: digest,
        authIdsExcluded: true,
        internalKeysExcluded: true,
        foreignCompanyExcluded: true,
        proofManifestIncluded: true,
        proofBinaryExported: true,
        proofBytesExact: true,
        manifestAndFilesSha256Verified: true,
        missingObjectRejectedWithoutPartialArchive: true,
        foreignObjectRejectedWithoutPartialArchive: true,
        companyBProofUnchanged: true,
        manifestSha256: archive.manifestSha256,
      },
      deletion: {
        fixtureOnlyGuard: true,
        companyADeleted: true,
        companyBUnchanged: true,
        authProviderDeletionTested: false,
        storageDeletionTested: "Exact fixture objects only; checked in final cleanup",
        backupDeletionTested: false,
      },
    });
  } catch (error) {
    Object.assign(evidence, {
      passed: false,
      error: error instanceof Error && /^(ARCHIVE_|POD_)[A-Z_]+$/.test(error.message) ? error.message : "DATA02_ASSERTION_OR_PROVIDER_FAILED",
    });
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
      Object.assign(evidence, { fixtureStorageObjectsRemaining: 0 });
    } catch {
      Object.assign(evidence, { clean: false, cleanupFailed: true });
      process.exitCode = 1;
    }
    await rm(archiveParent, { recursive: true, force: true });
    const residue = await prisma.company.count({ where: { slug: { in: [`${fixtureKey}-a`, `${fixtureKey}-b`] } } });
    Object.assign(evidence, { clean: residue === 0 && !evidence.cleanupFailed, fixtureCompaniesRemaining: residue });
    if (residue !== 0) process.exitCode = 1;
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({ passed: evidence.passed, clean: evidence.clean }));
}

void run();
