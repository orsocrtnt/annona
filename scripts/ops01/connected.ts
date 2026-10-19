import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/services/prisma/client";
import { processDueRecurringOrders } from "../../src/domains/client-portal/recurring-order.service";
import { createClientOrder } from "../../src/domains/order/order.service";
import { DEFAULT_DISPATCH_SETTINGS } from "../../src/lib/validations/dispatch-settings";

const outputPath = resolve(process.argv[2] ?? "outputs/ops01/connected.json");
const fixtureKey = `ops01-${randomUUID()}`;

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: "ops01-" } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;
  await prisma.operationJob.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.recurringOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function residue() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: "ops01-" } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  const [users, recurrences, orders, deliveries, jobs] = await Promise.all([
    prisma.user.count({ where: { authId: { startsWith: fixtureKey } } }),
    prisma.recurringOrder.count({ where: { companyId: { in: companyIds } } }),
    prisma.order.count({ where: { notes: fixtureKey } }),
    prisma.delivery.count({ where: { order: { notes: fixtureKey } } }),
    prisma.operationJob.count({ where: { companyId: { in: companyIds } } }),
  ]);
  return { companies: companies.length, users, recurrences, orders, deliveries, jobs };
}

async function waitForJobs(companyId: string) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const running = await prisma.operationJob.count({
      where: { companyId, status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (running === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("OPS01_JOBS_DID_NOT_SETTLE");
}

async function createFixture() {
  const clientRole = await prisma.role.findFirst({
    where: { systemRole: "CLIENT" },
    select: { id: true },
  });
  assert.ok(clientRole, "ROLE_MISSING:CLIENT");

  const company = await prisma.company.create({
    data: {
      name: "OPS-01 — entreprise fictive",
      slug: `${fixtureKey}-company`,
      isDemo: true,
      settings: { dispatchRules: DEFAULT_DISPATCH_SETTINGS },
    },
  });
  const client = await prisma.user.create({
    data: {
      authId: `${fixtureKey}-client`,
      email: `client@${fixtureKey}.invalid`,
      firstName: "Client",
      lastName: "OPS-01",
      status: "ACTIVE",
      companyId: company.id,
      roleId: clientRole.id,
    },
  });
  return { company, client };
}

function recurrenceData(companyId: string, customerId: string, idSuffix: string) {
  return {
    label: `OPS-01 ${idSuffix}`,
    frequency: "WEEKLY" as const,
    intervalValue: 1,
    intervalUnit: "DAYS" as const,
    status: "ACTIVE" as const,
    startAt: new Date("2026-01-01T00:00:00.000Z"),
    nextRunAt: new Date("2026-01-01T00:00:00.000Z"),
    endAt: null,
    deliveryCategory: "STANDARD" as const,
    shippingAddress: "1 place de la Concorde",
    shippingCity: "Paris",
    shippingPostalCode: "75008",
    notes: fixtureKey,
    items: [{ name: "Colis fictif OPS-01", quantity: 1, estimatedPrice: 12 }],
    companyId,
    customerId,
  };
}

async function run() {
  await cleanup();
  const startedAt = performance.now();
  const { company, client } = await createFixture();

  const backlog = await prisma.recurringOrder.create({
    data: {
      ...recurrenceData(company.id, client.id, "lot connecté"),
      endAt: new Date("2026-01-05T23:59:59.999Z"),
    },
  });
  const backlogResult = await processDueRecurringOrders({
    now: new Date("2026-01-05T12:00:00.000Z"),
    maxOccurrences: 10,
  });
  assert.deepEqual(backlogResult, {
    processed: 5,
    failed: 0,
    cancelled: 0,
    skipped: 0,
    hasMore: false,
  });

  const backlogOrders = await prisma.order.findMany({
    where: { recurringOrderId: backlog.id },
    orderBy: { requestedDeliveryDate: "asc" },
    select: { idempotencyKey: true, requestedDeliveryDate: true },
  });
  assert.equal(backlogOrders.length, 5);
  assert.equal(new Set(backlogOrders.map((order) => order.idempotencyKey)).size, 5);
  assert.equal(backlogOrders[0]?.requestedDeliveryDate?.toISOString().slice(0, 10), "2026-01-01");
  assert.equal(backlogOrders[4]?.requestedDeliveryDate?.toISOString().slice(0, 10), "2026-01-05");
  const backlogAfter = await prisma.recurringOrder.findUniqueOrThrow({ where: { id: backlog.id } });
  assert.equal(backlogAfter.status, "CANCELLED");

  const replay = await prisma.recurringOrder.create({
    data: recurrenceData(company.id, client.id, "rejeu après crash"),
  });
  const replayKey = `recurring:${replay.id}:${replay.nextRunAt.toISOString()}`;
  const replayPayload = {
    deliveryCategory: "STANDARD" as const,
    items: [{ name: "Colis fictif OPS-01", quantity: 1, estimatedPrice: 12 }],
    stops: undefined,
    pickupStops: undefined,
    pickupAddress: undefined,
    pickupCity: undefined,
    pickupPostalCode: undefined,
    pickupInstructions: undefined,
    shippingAddress: "1 place de la Concorde",
    shippingCity: "Paris",
    shippingPostalCode: "75008",
    deliveryInstructions: undefined,
    notes: fixtureKey,
    requestedDeliveryDate: "2026-01-01",
    recurringOrderId: replay.id,
  };
  await createClientOrder(client.id, company.id, client.email, replayPayload, {
    idempotencyKey: replayKey,
  });
  const replayResult = await processDueRecurringOrders({
    now: new Date("2026-01-01T12:00:00.000Z"),
    maxOccurrences: 1,
  });
  assert.equal(replayResult.processed, 1);
  assert.equal(replayResult.failed, 0);
  assert.equal(await prisma.order.count({ where: { recurringOrderId: replay.id } }), 1);
  const replayAfter = await prisma.recurringOrder.findUniqueOrThrow({ where: { id: replay.id } });
  assert.equal(replayAfter.nextRunAt.toISOString(), "2026-01-02T00:00:00.000Z");

  await prisma.recurringOrder.createMany({
    data: [
      { ...recurrenceData(company.id, client.id, "pause"), status: "PAUSED" },
      { ...recurrenceData(company.id, client.id, "annulée"), status: "CANCELLED" },
    ],
  });
  const beforeInactiveCheck = await prisma.order.count({ where: { companyId: company.id } });
  const inactiveResult = await processDueRecurringOrders({
    now: new Date("2026-01-01T12:00:00.000Z"),
    maxOccurrences: 10,
  });
  assert.equal(inactiveResult.processed, 0);
  assert.equal(await prisma.order.count({ where: { companyId: company.id } }), beforeInactiveCheck);

  await waitForJobs(company.id);
  return {
    task: "OPS-01",
    passed: true,
    fixture: "isolated-and-removed",
    backlog: {
      dueOccurrences: 5,
      ordersCreated: backlogOrders.length,
      uniqueOccurrenceKeys: new Set(backlogOrders.map((order) => order.idempotencyKey)).size,
      firstOccurrence: "2026-01-01",
      lastOccurrence: "2026-01-05",
      finalStatus: backlogAfter.status,
    },
    crashReplay: {
      durableOrdersBeforeReplay: 1,
      durableOrdersAfterReplay: 1,
      nextOccurrence: replayAfter.nextRunAt.toISOString(),
    },
    inactiveSchedules: {
      pauseRespected: true,
      cancellationRespected: true,
      additionalOrders: 0,
    },
    totalAutomatedMs: Math.round(performance.now() - startedAt),
  };
}

async function main() {
  let proof: Awaited<ReturnType<typeof run>> | undefined;
  try {
    proof = await run();
  } finally {
    await cleanup();
  }
  const remaining = await residue();
  assert.deepEqual(remaining, {
    companies: 0,
    users: 0,
    recurrences: 0,
    orders: 0,
    deliveries: 0,
    jobs: 0,
  });
  assert.ok(proof);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ ...proof, residue: remaining }, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, totalAutomatedMs: proof.totalAutomatedMs, residue: remaining }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
