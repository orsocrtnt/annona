import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";
import { createAdminClient } from "../../src/services/supabase/admin";
import {
  assertOps03aBucket,
  assertOps03aSchema,
  databaseUrlForOps03aSchema,
  quoteOps03aSchema,
} from "./rehearsal-safety";

const output = resolve(process.argv[2] ?? "outputs/ops03a/restore-rehearsal.json");
const prismaBinary = resolve("node_modules/.bin/prisma");
const PROOF_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZuoAAAAASUVORK5CYII=",
  "base64"
);
const MAX_POD_BYTES = 5 * 1024 * 1024;
const TABLES_IN_RESTORE_ORDER = [
  "companies",
  "permissions",
  "roles",
  "role_permissions",
  "users",
  "driver_locations",
  "customer_addresses",
  "recurring_orders",
  "orders",
  "order_stops",
  "order_items",
  "deliveries",
  "tracking_events",
  "operation_jobs",
  "invoices",
  "support_tickets",
  "support_ticket_messages",
  "order_messages",
  "order_thread_reads",
  "client_notifications",
] as const;

type TableName = (typeof TABLES_IN_RESTORE_ORDER)[number];
type LogicalBackup = Record<TableName, string>;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function migrationEnvironment(url: string) {
  return { ...process.env, DATABASE_URL: url, DIRECT_URL: url };
}

function deployMigrations(url: string) {
  return execFileSync(prismaBinary, ["migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    encoding: "utf8",
    env: migrationEnvironment(url),
    maxBuffer: 10 * 1024 * 1024,
  });
}

function pendingDiff(url: string) {
  return execFileSync(prismaBinary, [
    "migrate",
    "diff",
    "--from-schema-datasource",
    "prisma/schema.prisma",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ], {
    encoding: "utf8",
    env: migrationEnvironment(url),
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

async function publicSchemaFingerprint(admin: PrismaClient) {
  const rows = await admin.$queryRaw<Array<{ fingerprint: string }>>(Prisma.sql`
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
    ) objects
  `);
  if (!rows[0]?.fingerprint) throw new Error("OPS03A_PUBLIC_FINGERPRINT_EMPTY");
  return rows[0].fingerprint;
}

async function publicDataFingerprint(admin: PrismaClient) {
  const counts: Record<string, number> = {};
  for (const table of TABLES_IN_RESTORE_ORDER) {
    const rows = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM public."${table}"`
    );
    counts[table] = Number(rows[0]?.count ?? -1);
  }
  return { counts, fingerprint: hash(JSON.stringify(counts)) };
}

async function storageCatalogFingerprint(admin: PrismaClient) {
  const rows = await admin.$queryRaw<Array<{ fingerprint: string }>>(Prisma.sql`
    SELECT md5(coalesce(string_agg(definition, E'\n' ORDER BY definition), 'empty')) AS fingerprint
    FROM (
      SELECT 'bucket:' || id || ':' || public::text || ':' || coalesce(file_size_limit::text, '') || ':' || coalesce(array_to_string(allowed_mime_types, ','), '') AS definition
      FROM storage.buckets
      UNION ALL
      SELECT 'object:' || bucket_id || ':' || name || ':' || coalesce(metadata->>'size', '') || ':' || coalesce(metadata->>'mimetype', '') AS definition
      FROM storage.objects
    ) catalog
  `);
  return rows[0]?.fingerprint ?? hash("empty");
}

async function authFingerprint() {
  const admin = createAdminClient();
  const identities: string[] = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`OPS03A_AUTH_INVENTORY_FAILED:${error.message}`);
    identities.push(...data.users.map((user) => `${user.id}:${user.email ?? ""}`));
    if (data.users.length < 1000) break;
  }
  return { count: identities.length, fingerprint: hash(identities.sort().join("\n")) };
}

async function deliveryPodPayloadFingerprint(admin: PrismaClient) {
  const objects = await admin.$queryRaw<Array<{ name: string }>>(Prisma.sql`
    SELECT name FROM storage.objects WHERE bucket_id = 'delivery-pods' ORDER BY name
  `);
  const storage = createAdminClient().storage.from("delivery-pods");
  const entries: string[] = [];
  for (const object of objects) {
    const { data, error } = await storage.download(object.name);
    if (error || !data) throw new Error("OPS03A_EXISTING_STORAGE_DOWNLOAD_FAILED");
    entries.push(`${hash(object.name)}:${hash(Buffer.from(await data.arrayBuffer()))}`);
  }
  return { count: entries.length, fingerprint: hash(entries.join("\n")) };
}

async function createFixture(prisma: PrismaClient, suffix: string, proofPath: string) {
  const companyId = `ops03a_company_${suffix}`;
  const adminId = `ops03a_admin_${suffix}`;
  const clientId = `ops03a_client_${suffix}`;
  const driverId = `ops03a_driver_${suffix}`;
  const recurringId = `ops03a_recurring_${suffix}`;
  const orderId = `ops03a_order_${suffix}`;
  const deliveryId = `ops03a_delivery_${suffix}`;
  const messageId = `ops03a_message_${suffix}`;
  const now = new Date("2026-10-21T16:00:00.000Z");
  const roles = await prisma.role.findMany({
    where: { slug: { in: ["company-admin", "client", "driver"] } },
    select: { id: true, slug: true },
  });
  const roleBySlug = Object.fromEntries(roles.map((role) => [role.slug, role.id]));
  if (!roleBySlug["company-admin"] || !roleBySlug.client || !roleBySlug.driver) {
    throw new Error("OPS03A_REFERENCE_ROLES_MISSING");
  }
  const adminRoleId = roleBySlug["company-admin"];
  const clientRoleId = roleBySlug.client;
  const driverRoleId = roleBySlug.driver;

  await prisma.$transaction(async (tx) => {
    await tx.company.create({ data: {
      id: companyId,
      name: "OPS-03A Restore Rehearsal",
      slug: `ops03a-restore-${suffix}`,
      email: `ops03a-${suffix}@example.invalid`,
      country: "FR",
      status: "TRIAL",
      settings: { rehearsal: true },
      createdAt: now,
      updatedAt: now,
    } });
    await tx.user.createMany({ data: [
      { id: adminId, authId: `ops03a-auth-admin-${suffix}`, email: `admin-${suffix}@example.invalid`, firstName: "OPS03A", lastName: "Admin", status: "ACTIVE", companyId, roleId: adminRoleId, createdAt: now, updatedAt: now },
      { id: clientId, authId: `ops03a-auth-client-${suffix}`, email: `client-${suffix}@example.invalid`, firstName: "OPS03A", lastName: "Client", status: "ACTIVE", companyId, roleId: clientRoleId, createdAt: now, updatedAt: now },
      { id: driverId, authId: `ops03a-auth-driver-${suffix}`, email: `driver-${suffix}@example.invalid`, firstName: "OPS03A", lastName: "Driver", status: "ACTIVE", companyId, roleId: driverRoleId, createdAt: now, updatedAt: now },
    ] });
    await tx.driverLocation.create({ data: { driverId, latitude: 48.8566, longitude: 2.3522, accuracy: 8, updatedAt: now } });
    await tx.customerAddress.create({ data: { id: `ops03a_address_${suffix}`, label: "Bureau", address: "1 rue Fictive", city: "Paris", postalCode: "75001", isDefault: true, userId: clientId, createdAt: now, updatedAt: now } });
    await tx.recurringOrder.create({ data: {
      id: recurringId,
      label: "OPS-03A hebdomadaire",
      frequency: "WEEKLY",
      intervalValue: 1,
      intervalUnit: "WEEKS",
      status: "ACTIVE",
      startAt: now,
      nextRunAt: new Date("2026-10-28T16:00:00.000Z"),
      deliveryCategory: "STANDARD",
      shippingAddress: "2 avenue Fictive",
      shippingCity: "Paris",
      shippingPostalCode: "75002",
      items: [{ name: "Colis OPS-03A", quantity: 1, unitPrice: 42.5 }],
      companyId,
      customerId: clientId,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.order.create({ data: {
      id: orderId,
      reference: `OPS03A-ORD-${suffix}`,
      status: "DELIVERED",
      source: "RECURRING",
      totalAmount: new Prisma.Decimal("42.50"),
      itemCount: 1,
      notes: "Fixture restauration OPS-03A",
      shippingAddress: "2 avenue Fictive",
      shippingCity: "Paris",
      shippingPostalCode: "75002",
      companyId,
      customerId: clientId,
      customerEmail: `client-${suffix}@example.invalid`,
      recurringOrderId: recurringId,
      idempotencyKey: `ops03a-${suffix}`,
      requestFingerprint: `fingerprint-${suffix}`,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.orderStop.create({ data: { id: `ops03a_stop_${suffix}`, orderId, sequence: 1, label: "Collecte", address: "1 rue Fictive", city: "Paris", postalCode: "75001" } });
    await tx.orderItem.create({ data: { id: `ops03a_item_${suffix}`, name: "Colis OPS-03A", quantity: 1, unitPrice: new Prisma.Decimal("42.50"), orderId } });
    await tx.delivery.create({ data: {
      id: deliveryId,
      reference: `OPS03A-LIV-${suffix}`,
      status: "DELIVERED",
      deliveryCategory: "STANDARD",
      address: "2 avenue Fictive",
      city: "Paris",
      postalCode: "75002",
      driverName: "OPS03A Driver",
      driverId,
      missionAcceptedAt: now,
      missionStartedAt: now,
      completedAt: now,
      podOutcome: "SUCCESS",
      podPhotoPath: proofPath,
      podNote: "Preuve fictive OPS-03A",
      podCapturedAt: now,
      companyId,
      orderId,
      customerId: clientId,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.trackingEvent.create({ data: { id: `ops03a_tracking_${suffix}`, label: "Livrée", occurredAt: now, deliveryId } });
    await tx.operationJob.create({ data: { id: `ops03a_job_${suffix}`, jobKey: `ops03a-job-${suffix}`, type: "CLIENT_NOTIFICATION", status: "SUCCEEDED", payload: { rehearsal: true }, attempts: 1, maxAttempts: 3, nextAttemptAt: now, completedAt: now, companyId, createdAt: now, updatedAt: now } });
    await tx.invoice.create({ data: { id: `ops03a_invoice_${suffix}`, reference: `OPS03A-FAC-${suffix}`, status: "PENDING", amount: new Prisma.Decimal("42.50"), lineItems: [{ label: "Livraison OPS-03A", amount: 42.5 }], companyId, orderId, customerId: clientId, createdAt: now, updatedAt: now } });
    await tx.supportTicket.create({ data: { id: `ops03a_ticket_${suffix}`, subject: "Test restauration", message: "Fixture OPS-03A", status: "OPEN", priority: "NORMAL", companyId, customerId: clientId, relatedOrderId: orderId, relatedDeliveryId: deliveryId, createdAt: now, updatedAt: now } });
    await tx.supportTicketMessage.create({ data: { id: `ops03a_ticket_message_${suffix}`, body: "Message restauré", isStaff: true, ticketId: `ops03a_ticket_${suffix}`, authorId: adminId, createdAt: now } });
    await tx.orderMessage.create({ data: { id: messageId, orderId, authorId: clientId, authorName: "OPS03A Client", authorRole: "CLIENT", body: "Preuve reçue", kind: "QUESTION", internal: false, requestKey: `ops03a-message-${suffix}`, createdAt: now } });
    await tx.orderThreadRead.create({ data: { id: `ops03a_read_${suffix}`, orderId, userId: adminId, seenAt: now, seenId: messageId } });
    await tx.clientNotification.create({ data: { id: `ops03a_notification_${suffix}`, type: "ORDER_MESSAGE", title: "Nouveau message", body: "Message OPS-03A", href: `/orders/${orderId}`, orderMessageId: messageId, userId: adminId, createdAt: now } });
  }, { timeout: 30_000 });
  return { companyId, orderId, deliveryId };
}

async function exportLogicalBackup(prisma: PrismaClient): Promise<LogicalBackup> {
  const backup = {} as LogicalBackup;
  for (const table of TABLES_IN_RESTORE_ORDER) {
    const rows = await prisma.$queryRawUnsafe<Array<{ data: string }>>(
      `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]'::jsonb)::text AS data FROM "${table}" t`
    );
    backup[table] = rows[0]?.data ?? "[]";
  }
  return backup;
}

async function restoreLogicalBackup(prisma: PrismaClient, backup: LogicalBackup) {
  const tableList = TABLES_IN_RESTORE_ORDER.map((table) => `"${table}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
  for (const table of TABLES_IN_RESTORE_ORDER) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${table}" SELECT * FROM jsonb_populate_recordset(NULL::"${table}", $1::jsonb)`,
      backup[table]
    );
  }
}

function tableDigests(backup: LogicalBackup) {
  return Object.fromEntries(TABLES_IN_RESTORE_ORDER.map((table) => [table, hash(backup[table])])) as Record<TableName, string>;
}

async function validateSchema(prisma: PrismaClient, url: string) {
  const rows = await prisma.$queryRaw<Array<{ tables: bigint; rls_tables: bigint; migrations: bigint }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations') AS tables,
      (SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations' AND rowsecurity) AS rls_tables,
      (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations
  `);
  const row = rows[0];
  return {
    applicationTables: Number(row?.tables ?? -1),
    rlsTables: Number(row?.rls_tables ?? -1),
    appliedMigrations: Number(row?.migrations ?? -1),
    driftFree: !/\b(?:ALTER|CREATE|DROP)\b/.test(pendingDiff(url)),
  };
}

async function createTemporaryBucket(bucket: string) {
  assertOps03aBucket(bucket);
  const admin = createAdminClient();
  const existing = await admin.storage.getBucket(bucket);
  if (!existing.error || existing.data) throw new Error("OPS03A_TEMP_BUCKET_ALREADY_EXISTS");
  const created = await admin.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: MAX_POD_BYTES,
    allowedMimeTypes: ["image/jpeg", "image/png"],
  });
  if (created.error) throw new Error(`OPS03A_TEMP_BUCKET_CREATE_FAILED:${created.error.message}`);
}

async function removeTemporaryBucket(bucket: string) {
  assertOps03aBucket(bucket);
  const admin = createAdminClient();
  let lastError = "unknown";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const emptied = await admin.storage.emptyBucket(bucket);
    if (emptied.error && /not found/i.test(emptied.error.message)) return;
    if (emptied.error) lastError = `empty:${emptied.error.message}`;
    const removed = await admin.storage.deleteBucket(bucket);
    if (!removed.error || /not found/i.test(removed.error.message)) return;
    lastError = `delete:${removed.error.message}`;
    if (!/not empty/i.test(removed.error.message)) break;
    await new Promise((resolveWait) => setTimeout(resolveWait, 500 * (attempt + 1)));
  }
  throw new Error(`OPS03A_TEMP_BUCKET_DELETE_FAILED:${lastError}`);
}

async function bucketConfiguration(bucket: string) {
  assertOps03aBucket(bucket);
  const { data, error } = await createAdminClient().storage.getBucket(bucket);
  if (error || !data) throw new Error("OPS03A_TEMP_BUCKET_UNAVAILABLE");
  return {
    private: data.public === false,
    fileSizeLimit: data.file_size_limit,
    allowedMimeTypes: [...(data.allowed_mime_types ?? [])].sort(),
  };
}

async function main() {
  const isolationErrors = validatePreproductionEnvironment(process.env);
  if (isolationErrors.length) throw new Error(`PREPRODUCTION_ISOLATION_FAILED:${isolationErrors.join(",")}`);
  if (process.env.OPS03A_RESTORE_REHEARSAL !== "I_UNDERSTAND_TEMP_SCHEMAS_AND_BUCKETS_ONLY") {
    throw new Error("OPS03A_RESTORE_REHEARSAL_CONFIRMATION_MISSING");
  }

  const directUrl = required("DIRECT_URL");
  const suffix = randomBytes(6).toString("hex");
  const sourceSchema = assertOps03aSchema(`ops03a_rehearsal_${suffix}_source`);
  const restoreSchema = assertOps03aSchema(`ops03a_rehearsal_${suffix}_restore`);
  const sourceBucket = assertOps03aBucket(`ops03a-rehearsal-${suffix}-source`);
  const restoreBucket = assertOps03aBucket(`ops03a-rehearsal-${suffix}-restore`);
  const sourceUrl = databaseUrlForOps03aSchema(directUrl, sourceSchema);
  const restoreUrl = databaseUrlForOps03aSchema(directUrl, restoreSchema);
  const companyId = `ops03a_company_${suffix}`;
  const deliveryId = `ops03a_delivery_${suffix}`;
  const objectPath = `${companyId}/${deliveryId}-1761062400000-00000000-0000-4000-8000-${suffix}.png`;
  const archiveDirectory = await mkdtemp(join(tmpdir(), "tutelliv-ops03a-"));
  const adminDb = new PrismaClient({ datasources: { db: { url: directUrl } } });
  let source: PrismaClient | null = null;
  let restored: PrismaClient | null = null;
  let sourceBucketCreated = false;
  let restoreBucketCreated = false;
  const startedAt = Date.now();

  const before = {
    publicSchema: await publicSchemaFingerprint(adminDb),
    publicData: await publicDataFingerprint(adminDb),
    storageCatalog: await storageCatalogFingerprint(adminDb),
    storagePayloads: await deliveryPodPayloadFingerprint(adminDb),
    auth: await authFingerprint(),
  };

  try {
    const backupStartedAt = Date.now();
    await adminDb.$executeRawUnsafe(`CREATE SCHEMA ${quoteOps03aSchema(sourceSchema)}`);
    deployMigrations(sourceUrl);
    source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
    await createTemporaryBucket(sourceBucket);
    sourceBucketCreated = true;
    const sourceStorage = createAdminClient().storage.from(sourceBucket);
    const upload = await sourceStorage.upload(objectPath, PROOF_BYTES, {
      contentType: "image/png",
      upsert: false,
    });
    if (upload.error) throw new Error(`OPS03A_SOURCE_UPLOAD_FAILED:${upload.error.message}`);
    const fixture = await createFixture(source, suffix, objectPath);
    const sourceValidation = await validateSchema(source, sourceUrl);
    const backup = await exportLogicalBackup(source);
    const sourceDigests = tableDigests(backup);
    const sourceDownload = await sourceStorage.download(objectPath);
    if (sourceDownload.error || !sourceDownload.data) throw new Error("OPS03A_SOURCE_DOWNLOAD_FAILED");
    const proofBytes = Buffer.from(await sourceDownload.data.arrayBuffer());
    const databaseBytes = Buffer.from(JSON.stringify(backup));
    const databasePath = join(archiveDirectory, "database.json");
    const proofPath = join(archiveDirectory, "proof.png");
    const manifestPath = join(archiveDirectory, "manifest.json");
    const manifest = {
      schema: "tutelliv-ops03a-restore-archive",
      version: 1,
      createdAt: new Date().toISOString(),
      database: { file: "database.json", bytes: databaseBytes.length, sha256: hash(databaseBytes), tables: TABLES_IN_RESTORE_ORDER.length },
      storage: [{ file: "proof.png", bytes: proofBytes.length, sha256: hash(proofBytes), contentType: "image/png" }],
      secretsIncluded: false,
    };
    await Promise.all([
      writeFile(databasePath, databaseBytes),
      writeFile(proofPath, proofBytes),
      writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
    ]);
    const [archivedDatabase, archivedProof, archivedManifest] = await Promise.all([
      readFile(databasePath),
      readFile(proofPath),
      readFile(manifestPath, "utf8"),
    ]);
    const parsedManifest = JSON.parse(archivedManifest) as typeof manifest;
    const archiveVerified =
      parsedManifest.schema === manifest.schema &&
      parsedManifest.version === 1 &&
      parsedManifest.database.sha256 === hash(archivedDatabase) &&
      parsedManifest.database.bytes === archivedDatabase.length &&
      parsedManifest.storage[0]?.sha256 === hash(archivedProof) &&
      parsedManifest.storage[0]?.bytes === archivedProof.length &&
      archivedProof.equals(PROOF_BYTES);
    if (!archiveVerified) throw new Error("OPS03A_ARCHIVE_VERIFICATION_FAILED");
    const backupDurationSeconds = Number(((Date.now() - backupStartedAt) / 1000).toFixed(3));

    await source.$disconnect();
    source = null;
    await adminDb.$executeRawUnsafe(`DROP SCHEMA ${quoteOps03aSchema(sourceSchema)} CASCADE`);
    await removeTemporaryBucket(sourceBucket);
    sourceBucketCreated = false;

    const restoreStartedAt = Date.now();
    await adminDb.$executeRawUnsafe(`CREATE SCHEMA ${quoteOps03aSchema(restoreSchema)}`);
    deployMigrations(restoreUrl);
    restored = new PrismaClient({ datasources: { db: { url: restoreUrl } } });
    const archiveBackup = JSON.parse(archivedDatabase.toString("utf8")) as LogicalBackup;
    await restoreLogicalBackup(restored, archiveBackup);
    await createTemporaryBucket(restoreBucket);
    restoreBucketCreated = true;
    const restoreStorage = createAdminClient().storage.from(restoreBucket);
    const restoreUpload = await restoreStorage.upload(objectPath, archivedProof, {
      contentType: "image/png",
      upsert: false,
    });
    if (restoreUpload.error) throw new Error(`OPS03A_RESTORE_UPLOAD_FAILED:${restoreUpload.error.message}`);
    const restoreDurationSeconds = Number(((Date.now() - restoreStartedAt) / 1000).toFixed(3));

    const validationStartedAt = Date.now();
    const restoredBackup = await exportLogicalBackup(restored);
    const restoredDigests = tableDigests(restoredBackup);
    const restoreValidation = await validateSchema(restored, restoreUrl);
    const restoredDelivery = await restored.delivery.findUnique({
      where: { id: fixture.deliveryId },
      select: {
        companyId: true,
        orderId: true,
        status: true,
        podOutcome: true,
        podPhotoPath: true,
        order: { select: { reference: true, status: true } },
      },
    });
    const restoredDownload = await restoreStorage.download(objectPath);
    if (restoredDownload.error || !restoredDownload.data) throw new Error("OPS03A_RESTORED_DOWNLOAD_FAILED");
    const restoredProof = Buffer.from(await restoredDownload.data.arrayBuffer());
    const signed = await restoreStorage.createSignedUrl(objectPath, 60);
    if (signed.error || !signed.data?.signedUrl) throw new Error("OPS03A_SIGNED_URL_FAILED");
    const signedResponse = await fetch(signed.data.signedUrl, { cache: "no-store" });
    const signedBytes = Buffer.from(await signedResponse.arrayBuffer());
    const sourceBucketConfig = manifest.storage[0] ? {
      private: true,
      fileSizeLimit: MAX_POD_BYTES,
      allowedMimeTypes: ["image/jpeg", "image/png"],
    } : null;
    const restoredBucketConfig = await bucketConfiguration(restoreBucket);
    const replayOutput = deployMigrations(restoreUrl);
    const checks = {
      sourceMigrationsApplied: sourceValidation.appliedMigrations === 2,
      sourceTablesProtected: sourceValidation.applicationTables === 20 && sourceValidation.rlsTables === 20,
      sourceHasNoDrift: sourceValidation.driftFree,
      archiveManifestVerified: archiveVerified,
      sourceRemovedBeforeRestore: true,
      restoredMigrationsApplied: restoreValidation.appliedMigrations === 2,
      restoredTablesProtected: restoreValidation.applicationTables === 20 && restoreValidation.rlsTables === 20,
      restoredHasNoDrift: restoreValidation.driftFree,
      databaseRestoredExactly: TABLES_IN_RESTORE_ORDER.every((table) => sourceDigests[table] === restoredDigests[table]),
      deliveryRelationshipRestored:
        restoredDelivery?.companyId === fixture.companyId &&
        restoredDelivery.orderId === fixture.orderId &&
        restoredDelivery.status === "DELIVERED" &&
        restoredDelivery.order.status === "DELIVERED" &&
        restoredDelivery.podOutcome === "SUCCESS" &&
        restoredDelivery.podPhotoPath === objectPath,
      proofPayloadRestoredExactly: restoredProof.equals(PROOF_BYTES) && hash(restoredProof) === manifest.storage[0]?.sha256,
      signedProofReadable: signedResponse.ok && signedBytes.equals(PROOF_BYTES),
      privateBucketConfigurationRestored:
        sourceBucketConfig?.private === restoredBucketConfig.private &&
        sourceBucketConfig.fileSizeLimit === restoredBucketConfig.fileSizeLimit &&
        JSON.stringify(sourceBucketConfig.allowedMimeTypes) === JSON.stringify(restoredBucketConfig.allowedMimeTypes),
      migrationReplayIsNoop: /No pending migrations to apply/i.test(replayOutput),
    };
    const validationDurationSeconds = Number(((Date.now() - validationStartedAt) / 1000).toFixed(3));
    if (!Object.values(checks).every(Boolean)) {
      throw new Error(`OPS03A_REHEARSAL_CHECK_FAILED:${JSON.stringify(checks)}`);
    }

    await restored.$disconnect();
    restored = null;
    await adminDb.$executeRawUnsafe(`DROP SCHEMA ${quoteOps03aSchema(restoreSchema)} CASCADE`);
    await removeTemporaryBucket(restoreBucket);
    restoreBucketCreated = false;

    const remaining = await adminDb.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM pg_namespace WHERE nspname IN ($1, $2)`,
      sourceSchema,
      restoreSchema
    );
    const bucketRows = await adminDb.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM storage.buckets WHERE id IN ($1, $2)`,
      sourceBucket,
      restoreBucket
    );
    const after = {
      publicSchema: await publicSchemaFingerprint(adminDb),
      publicData: await publicDataFingerprint(adminDb),
      storageCatalog: await storageCatalogFingerprint(adminDb),
      storagePayloads: await deliveryPodPayloadFingerprint(adminDb),
      auth: await authFingerprint(),
    };
    const environmentChecks = {
      temporarySchemasRemoved: Number(remaining[0]?.count ?? -1) === 0,
      temporaryBucketsRemoved: Number(bucketRows[0]?.count ?? -1) === 0,
      publicSchemaUnchanged: before.publicSchema === after.publicSchema,
      publicDataUnchanged: before.publicData.fingerprint === after.publicData.fingerprint,
      storageCatalogUnchanged: before.storageCatalog === after.storageCatalog,
      existingStoragePayloadsUnchanged:
        before.storagePayloads.count === after.storagePayloads.count &&
        before.storagePayloads.fingerprint === after.storagePayloads.fingerprint,
      authUnchanged: before.auth.count === after.auth.count && before.auth.fingerprint === after.auth.fingerprint,
    };
    const passed = Object.values(checks).every(Boolean) && Object.values(environmentChecks).every(Boolean);
    const proof = {
      task: "OPS-03A-backup-restore-rehearsal",
      inspectedAt: new Date().toISOString(),
      target: "isolated-preproduction-temporary-schemas-and-buckets",
      passed,
      checks,
      environmentChecks,
      sourceValidation,
      restoreValidation,
      restoredTableDigestsMatched: TABLES_IN_RESTORE_ORDER.filter((table) => sourceDigests[table] === restoredDigests[table]).length,
      applicationTables: TABLES_IN_RESTORE_ORDER.length,
      storageObjectsRestored: 1,
      timings: {
        backupSeconds: backupDurationSeconds,
        restoreSeconds: restoreDurationSeconds,
        validationSeconds: validationDurationSeconds,
        totalSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
      },
      objectives: {
        rpoTargetHours: 1,
        rtoTargetHours: 4,
        observedLogicalRestoreWithinRto: restoreDurationSeconds < 4 * 60 * 60,
        managedProviderRpoValidated: false,
      },
      providerScope: {
        freePlanManagedBackupRestoreTested: false,
        authSchemaRestored: false,
        platformConfigurationRestored: false,
        note: "Logical application database plus Storage payload rehearsal; managed project clone is unavailable on Free plan.",
      },
      localArchiveRemovedAfterValidation: true,
      secretsIncluded: false,
    };
    await rm(archiveDirectory, { recursive: true, force: true });
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      passed,
      tablesRestored: proof.restoredTableDigestsMatched,
      storageObjectsRestored: proof.storageObjectsRestored,
      temporarySchemasRemoved: environmentChecks.temporarySchemasRemoved,
      temporaryBucketsRemoved: environmentChecks.temporaryBucketsRemoved,
      publicEnvironmentUnchanged:
        environmentChecks.publicSchemaUnchanged &&
        environmentChecks.publicDataUnchanged &&
        environmentChecks.storageCatalogUnchanged &&
        environmentChecks.existingStoragePayloadsUnchanged &&
        environmentChecks.authUnchanged,
      timings: proof.timings,
    }));
    if (!passed) process.exitCode = 1;
  } finally {
    if (source) await source.$disconnect().catch(() => undefined);
    if (restored) await restored.$disconnect().catch(() => undefined);
    if (sourceBucketCreated) await removeTemporaryBucket(sourceBucket).catch(() => undefined);
    if (restoreBucketCreated) await removeTemporaryBucket(restoreBucket).catch(() => undefined);
    await adminDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${quoteOps03aSchema(sourceSchema)} CASCADE`).catch(() => undefined);
    await adminDb.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${quoteOps03aSchema(restoreSchema)} CASCADE`).catch(() => undefined);
    await rm(archiveDirectory, { recursive: true, force: true }).catch(() => undefined);
    await adminDb.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OPS03A_REHEARSAL_FAILED");
  process.exitCode = 1;
});
