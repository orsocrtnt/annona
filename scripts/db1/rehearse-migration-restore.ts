import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { validatePreproductionEnvironment } from "../ci/verify-preproduction-env";
import {
  assertDb1RehearsalSchema,
  databaseUrlForSchema,
  quoteRehearsalSchema,
} from "./rehearsal-safety";

const output = resolve(process.argv[2] ?? "outputs/db1/migration-restore-rehearsal.json");
const prismaBinary = resolve("node_modules/.bin/prisma");
const TABLES_IN_RESTORE_ORDER = [
  "companies",
  "permissions",
  "roles",
  "role_permissions",
  "saas_catalog_versions",
  "saas_plans",
  "saas_options",
  "saas_subscriptions",
  "saas_plan_assignments",
  "saas_subscription_items",
  "saas_usage_periods",
  "saas_seat_reservations",
  "users",
  "driver_locations",
  "customer_addresses",
  "recurring_orders",
  "orders",
  "saas_usage_events",
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

const EXPECTED_MIGRATIONS = 3;
const EXPECTED_APPLICATION_TABLES = TABLES_IN_RESTORE_ORDER.length;

type LogicalBackup = Record<(typeof TABLES_IN_RESTORE_ORDER)[number], string>;

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function hash(value: string) {
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

async function publicFingerprint(admin: PrismaClient) {
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
  if (!rows[0]?.fingerprint) throw new Error("DB1_PUBLIC_FINGERPRINT_EMPTY");
  return rows[0].fingerprint;
}

async function publicDataSummary(admin: PrismaClient) {
  const rows = await admin.$queryRaw<Array<{
    companies: bigint;
    users: bigint;
    orders: bigint;
    deliveries: bigint;
    storage_objects: bigint;
    bucket_signature: string;
  }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM public.companies) AS companies,
      (SELECT count(*) FROM public.users) AS users,
      (SELECT count(*) FROM public.orders) AS orders,
      (SELECT count(*) FROM public.deliveries) AS deliveries,
      (SELECT count(*) FROM storage.objects WHERE bucket_id = 'delivery-pods') AS storage_objects,
      coalesce((SELECT md5(concat_ws('|', id, name, public::text, file_size_limit::text, array_to_string(allowed_mime_types, ',')))
        FROM storage.buckets WHERE id = 'delivery-pods'), 'missing') AS bucket_signature
  `);
  const row = rows[0];
  if (!row) throw new Error("DB1_PUBLIC_SUMMARY_EMPTY");
  return {
    companies: Number(row.companies),
    users: Number(row.users),
    orders: Number(row.orders),
    deliveries: Number(row.deliveries),
    storageObjects: Number(row.storage_objects),
    bucketSignature: row.bucket_signature,
  };
}

async function createFixture(prisma: PrismaClient, suffix: string) {
  const companyId = `db1_company_${suffix}`;
  const adminId = `db1_admin_${suffix}`;
  const clientId = `db1_client_${suffix}`;
  const driverId = `db1_driver_${suffix}`;
  const recurringId = `db1_recurring_${suffix}`;
  const orderId = `db1_order_${suffix}`;
  const subscriptionId = `db1_subscription_${suffix}`;
  const usagePeriodId = `db1_usage_period_${suffix}`;
  const deliveryId = `db1_delivery_${suffix}`;
  const messageId = `db1_message_${suffix}`;
  const now = new Date("2026-10-21T12:00:00.000Z");

  const roles = await prisma.role.findMany({
    where: { slug: { in: ["company-admin", "client", "driver"] } },
    select: { id: true, slug: true },
  });
  const roleBySlug = Object.fromEntries(roles.map((role) => [role.slug, role.id]));
  if (!roleBySlug["company-admin"] || !roleBySlug.client || !roleBySlug.driver) {
    throw new Error("DB1_REFERENCE_ROLES_MISSING");
  }
  const adminRoleId = roleBySlug["company-admin"];
  const clientRoleId = roleBySlug.client;
  const driverRoleId = roleBySlug.driver;

  await prisma.$transaction(async (tx) => {
    await tx.company.create({ data: {
      id: companyId,
      name: "DB1 Restore Rehearsal",
      slug: `db1-restore-${suffix}`,
      email: `db1-${suffix}@example.invalid`,
      country: "FR",
      status: "TRIAL",
      settings: { rehearsal: true },
      createdAt: now,
      updatedAt: now,
    } });
    await tx.saasSubscription.create({ data: {
      id: subscriptionId,
      companyId,
      kind: "LEGACY",
      status: "ACTIVE",
      startsAt: now,
      currentPeriodStart: new Date("2026-10-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-11-01T00:00:00.000Z"),
      snapshot: { schemaVersion: 1, mode: "LEGACY", rehearsal: true },
      createdAt: now,
      updatedAt: now,
    } });
    await tx.saasUsagePeriod.create({ data: {
      id: usagePeriodId,
      subscriptionId,
      companyId,
      startsAt: new Date("2026-10-01T00:00:00.000Z"),
      endsAt: new Date("2026-11-01T00:00:00.000Z"),
      includedOrders: 1000,
      orderCount: 1,
      overageCount: 0,
      orderOverageUnitPriceCents: 10,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.saasSeatReservation.create({ data: {
      id: `db1_seat_${suffix}`,
      reservationKey: `db1-seat-${suffix}`,
      companyId,
      subscriptionId,
      role: "DRIVER",
      expiresAt: new Date("2026-10-21T12:10:00.000Z"),
      createdAt: now,
    } });
    await tx.user.createMany({ data: [
      { id: adminId, authId: `db1-auth-admin-${suffix}`, email: `admin-${suffix}@example.invalid`, firstName: "DB1", lastName: "Admin", status: "ACTIVE", companyId, roleId: adminRoleId, createdAt: now, updatedAt: now },
      { id: clientId, authId: `db1-auth-client-${suffix}`, email: `client-${suffix}@example.invalid`, firstName: "DB1", lastName: "Client", status: "ACTIVE", companyId, roleId: clientRoleId, createdAt: now, updatedAt: now },
      { id: driverId, authId: `db1-auth-driver-${suffix}`, email: `driver-${suffix}@example.invalid`, firstName: "DB1", lastName: "Driver", status: "ACTIVE", companyId, roleId: driverRoleId, createdAt: now, updatedAt: now },
    ] });
    await tx.driverLocation.create({ data: { driverId, latitude: 48.8566, longitude: 2.3522, accuracy: 8, updatedAt: now } });
    await tx.customerAddress.create({ data: { id: `db1_address_${suffix}`, label: "Bureau", address: "1 rue Fictive", city: "Paris", postalCode: "75001", isDefault: true, userId: clientId, createdAt: now, updatedAt: now } });
    await tx.recurringOrder.create({ data: {
      id: recurringId,
      label: "DB1 hebdomadaire",
      frequency: "WEEKLY",
      intervalValue: 1,
      intervalUnit: "WEEKS",
      status: "ACTIVE",
      startAt: now,
      nextRunAt: new Date("2026-10-28T12:00:00.000Z"),
      deliveryCategory: "STANDARD",
      shippingAddress: "2 avenue Fictive",
      shippingCity: "Paris",
      shippingPostalCode: "75002",
      items: [{ name: "Colis DB1", quantity: 1, unitPrice: 42.5 }],
      companyId,
      customerId: clientId,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.order.create({ data: {
      id: orderId,
      reference: `DB1-ORD-${suffix}`,
      status: "IN_DELIVERY",
      source: "RECURRING",
      totalAmount: new Prisma.Decimal("42.50"),
      itemCount: 1,
      notes: "Fixture restauration DB-1",
      shippingAddress: "2 avenue Fictive",
      shippingCity: "Paris",
      shippingPostalCode: "75002",
      companyId,
      customerId: clientId,
      customerEmail: `client-${suffix}@example.invalid`,
      recurringOrderId: recurringId,
      idempotencyKey: `db1-${suffix}`,
      requestFingerprint: `fingerprint-${suffix}`,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.saasUsageEvent.create({ data: {
      id: `db1_usage_event_${suffix}`,
      eventKey: `order-created:${orderId}`,
      kind: "ORDER_CREATED",
      companyId,
      subscriptionId,
      usagePeriodId,
      orderId,
      createdAt: now,
    } });
    await tx.orderStop.create({ data: { id: `db1_stop_${suffix}`, orderId, sequence: 1, label: "Collecte", address: "1 rue Fictive", city: "Paris", postalCode: "75001" } });
    await tx.orderItem.create({ data: { id: `db1_item_${suffix}`, name: "Colis DB1", quantity: 1, unitPrice: new Prisma.Decimal("42.50"), orderId } });
    await tx.delivery.create({ data: {
      id: deliveryId,
      reference: `DB1-LIV-${suffix}`,
      status: "IN_DELIVERY",
      deliveryCategory: "STANDARD",
      address: "2 avenue Fictive",
      city: "Paris",
      postalCode: "75002",
      driverName: "DB1 Driver",
      driverId,
      missionAcceptedAt: now,
      missionStartedAt: now,
      companyId,
      orderId,
      customerId: clientId,
      createdAt: now,
      updatedAt: now,
    } });
    await tx.trackingEvent.create({ data: { id: `db1_tracking_${suffix}`, label: "Mission démarrée", occurredAt: now, deliveryId } });
    await tx.operationJob.create({ data: { id: `db1_job_${suffix}`, jobKey: `db1-job-${suffix}`, type: "CLIENT_NOTIFICATION", status: "SUCCEEDED", payload: { rehearsal: true }, attempts: 1, maxAttempts: 3, nextAttemptAt: now, completedAt: now, companyId, createdAt: now, updatedAt: now } });
    await tx.invoice.create({ data: { id: `db1_invoice_${suffix}`, reference: `DB1-FAC-${suffix}`, status: "PENDING", amount: new Prisma.Decimal("42.50"), lineItems: [{ label: "Livraison DB1", amount: 42.5 }], companyId, orderId, customerId: clientId, createdAt: now, updatedAt: now } });
    await tx.supportTicket.create({ data: { id: `db1_ticket_${suffix}`, subject: "Test restauration", message: "Fixture DB-1", status: "OPEN", priority: "NORMAL", companyId, customerId: clientId, relatedOrderId: orderId, relatedDeliveryId: deliveryId, createdAt: now, updatedAt: now } });
    await tx.supportTicketMessage.create({ data: { id: `db1_ticket_message_${suffix}`, body: "Message restauré", isStaff: true, ticketId: `db1_ticket_${suffix}`, authorId: adminId, createdAt: now } });
    await tx.orderMessage.create({ data: { id: messageId, orderId, authorId: clientId, authorName: "DB1 Client", authorRole: "CLIENT", body: "Où est la livraison ?", kind: "QUESTION", internal: false, requestKey: `db1-message-${suffix}`, createdAt: now } });
    await tx.orderThreadRead.create({ data: { id: `db1_read_${suffix}`, orderId, userId: adminId, seenAt: now, seenId: messageId } });
    await tx.clientNotification.create({ data: { id: `db1_notification_${suffix}`, type: "ORDER_MESSAGE", title: "Nouveau message", body: "Message DB1", href: `/orders/${orderId}`, orderMessageId: messageId, userId: adminId, createdAt: now } });
  }, { timeout: 30_000 });
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

function backupDigests(backup: LogicalBackup) {
  return Object.fromEntries(TABLES_IN_RESTORE_ORDER.map((table) => [table, hash(backup[table])]));
}

function backupCounts(backup: LogicalBackup) {
  return Object.fromEntries(
    TABLES_IN_RESTORE_ORDER.map((table) => [table, (JSON.parse(backup[table]) as unknown[]).length])
  ) as Record<(typeof TABLES_IN_RESTORE_ORDER)[number], number>;
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

async function validateSchema(prisma: PrismaClient, url: string) {
  const rows = await prisma.$queryRaw<Array<{ tables: bigint; rls_tables: bigint; migrations: bigint }>>(Prisma.sql`
    SELECT
      (SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations') AS tables,
      (SELECT count(*) FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations' AND rowsecurity) AS rls_tables,
      (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS migrations
  `);
  const row = rows[0];
  const diff = pendingDiff(url);
  return {
    applicationTables: Number(row?.tables ?? -1),
    rlsTables: Number(row?.rls_tables ?? -1),
    appliedMigrations: Number(row?.migrations ?? -1),
    driftFree: !/\b(?:ALTER|CREATE|DROP)\b/.test(diff),
  };
}

async function main() {
  const isolationErrors = validatePreproductionEnvironment(process.env);
  if (isolationErrors.length) throw new Error(`PREPRODUCTION_ISOLATION_FAILED:${isolationErrors.join(",")}`);
  if (process.env.DB1_RESTORE_REHEARSAL !== "I_UNDERSTAND_TEMP_SCHEMAS_ONLY") {
    throw new Error("DB1_RESTORE_REHEARSAL_CONFIRMATION_MISSING");
  }

  const directUrl = required("DIRECT_URL");
  const suffix = randomBytes(6).toString("hex");
  const sourceSchema = assertDb1RehearsalSchema(`db1_rehearsal_${suffix}_source`);
  const restoreSchema = assertDb1RehearsalSchema(`db1_rehearsal_${suffix}_restore`);
  const sourceUrl = databaseUrlForSchema(directUrl, sourceSchema);
  const restoreUrl = databaseUrlForSchema(directUrl, restoreSchema);
  const admin = new PrismaClient({ datasources: { db: { url: directUrl } } });
  let source: PrismaClient | null = null;
  let restored: PrismaClient | null = null;
  const startedAt = Date.now();
  let cleanupPassed = false;

  const publicFingerprintBefore = await publicFingerprint(admin);
  const publicDataBefore = await publicDataSummary(admin);

  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA ${quoteRehearsalSchema(sourceSchema)}`);
    deployMigrations(sourceUrl);
    source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
    await createFixture(source, suffix);
    const sourceValidation = await validateSchema(source, sourceUrl);
    const backup = await exportLogicalBackup(source);
    const sourceDigests = backupDigests(backup);
    const counts = backupCounts(backup);

    await admin.$executeRawUnsafe(`CREATE SCHEMA ${quoteRehearsalSchema(restoreSchema)}`);
    deployMigrations(restoreUrl);
    restored = new PrismaClient({ datasources: { db: { url: restoreUrl } } });
    await restoreLogicalBackup(restored, backup);
    const restoredBackup = await exportLogicalBackup(restored);
    const restoredDigests = backupDigests(restoredBackup);
    const restoreValidation = await validateSchema(restored, restoreUrl);
    const replayOutput = deployMigrations(restoreUrl);

    const dataMatches = JSON.stringify(sourceDigests) === JSON.stringify(restoredDigests);
    const referenceCounts = {
      roles: counts.roles,
      permissions: counts.permissions,
      rolePermissions: counts.role_permissions,
    };
    const fixtureCounts = {
      companies: counts.companies,
      users: counts.users,
      orders: counts.orders,
      deliveries: counts.deliveries,
      invoices: counts.invoices,
      supportTickets: counts.support_tickets,
      operationJobs: counts.operation_jobs,
      saasSubscriptions: counts.saas_subscriptions,
      saasUsagePeriods: counts.saas_usage_periods,
      saasUsageEvents: counts.saas_usage_events,
    };
    const checks = {
      sourceMigrationsApplied: sourceValidation.appliedMigrations === EXPECTED_MIGRATIONS,
      sourceTablesProtected: sourceValidation.applicationTables === EXPECTED_APPLICATION_TABLES && sourceValidation.rlsTables === EXPECTED_APPLICATION_TABLES,
      sourceHasNoDrift: sourceValidation.driftFree,
      restoredMigrationsApplied: restoreValidation.appliedMigrations === EXPECTED_MIGRATIONS,
      restoredTablesProtected: restoreValidation.applicationTables === EXPECTED_APPLICATION_TABLES && restoreValidation.rlsTables === EXPECTED_APPLICATION_TABLES,
      restoredHasNoDrift: restoreValidation.driftFree,
      logicalBackupRestoredExactly: dataMatches,
      referenceDataRestored: referenceCounts.roles === 6 && referenceCounts.permissions === 33 && referenceCounts.rolePermissions === 109,
      representativeGraphRestored: Object.values(fixtureCounts).every((count) => count >= 1),
      migrationReplayIsNoop: /No pending migrations to apply/i.test(replayOutput),
    };
    const passed = Object.values(checks).every(Boolean);
    const proof = {
      task: "DB-1-migration-restore-rehearsal",
      inspectedAt: new Date().toISOString(),
      target: "isolated-preproduction-temporary-schemas",
      passed,
      checks,
      sourceValidation,
      restoreValidation,
      referenceCounts,
      fixtureCounts,
      tableCount: TABLES_IN_RESTORE_ORDER.length,
      restoredTableDigestsMatched: Object.keys(sourceDigests).filter((table) => sourceDigests[table] === restoredDigests[table]).length,
      durationSecondsBeforeCleanup: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
      publicSchemaFingerprintBefore: publicFingerprintBefore,
      publicSchemaFingerprintAfter: null as string | null,
      publicDataUnchanged: false,
      temporarySchemasRemoved: false,
      storagePayloadCopied: false,
      secretsIncluded: false,
    };
    if (!passed) throw new Error(`DB1_REHEARSAL_CHECK_FAILED:${JSON.stringify(checks)}`);

    await source.$disconnect();
    source = null;
    await restored.$disconnect();
    restored = null;
    await admin.$executeRawUnsafe(`DROP SCHEMA ${quoteRehearsalSchema(sourceSchema)} CASCADE`);
    await admin.$executeRawUnsafe(`DROP SCHEMA ${quoteRehearsalSchema(restoreSchema)} CASCADE`);
    cleanupPassed = true;

    const remaining = await admin.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT count(*) AS count FROM pg_namespace WHERE nspname IN ($1, $2)`,
      sourceSchema,
      restoreSchema
    );
    const publicFingerprintAfter = await publicFingerprint(admin);
    const publicDataAfter = await publicDataSummary(admin);
    proof.publicSchemaFingerprintAfter = publicFingerprintAfter;
    proof.publicDataUnchanged = JSON.stringify(publicDataBefore) === JSON.stringify(publicDataAfter);
    proof.temporarySchemasRemoved = Number(remaining[0]?.count ?? -1) === 0;
    proof.passed = proof.passed && proof.publicDataUnchanged && proof.temporarySchemasRemoved && publicFingerprintBefore === publicFingerprintAfter;
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      passed: proof.passed,
      checks: proof.checks,
      tablesRestored: proof.restoredTableDigestsMatched,
      temporarySchemasRemoved: proof.temporarySchemasRemoved,
      publicDataUnchanged: proof.publicDataUnchanged,
      publicSchemaUnchanged: publicFingerprintBefore === publicFingerprintAfter,
      durationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(3)),
    }));
    if (!proof.passed) process.exitCode = 1;
  } finally {
    if (source) await source.$disconnect().catch(() => undefined);
    if (restored) await restored.$disconnect().catch(() => undefined);
    if (!cleanupPassed) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${quoteRehearsalSchema(sourceSchema)} CASCADE`).catch(() => undefined);
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${quoteRehearsalSchema(restoreSchema)} CASCADE`).catch(() => undefined);
    }
    await admin.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "DB1_REHEARSAL_FAILED");
  process.exitCode = 1;
});
