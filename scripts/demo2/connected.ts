import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/services/prisma/client";
import { DEMO_COMPANY_SLUG, DEMO_POOL_MIN_READY } from "../../src/lib/demo/constants";
import {
  createDemoSessionId,
} from "../../src/domains/demo/demo-session.service";
import {
  DemoPoolUnavailableError,
  getActiveDemoPoolLease,
  getDemoPoolStats,
  leaseDemoPoolEnvironment,
  maintainDemoPool,
  prepareDemoPool,
  recycleDemoPoolEnvironment,
  requestDemoPoolRecycle,
} from "../../src/domains/demo/demo-pool.service";
import { getDemoPersonaUsers } from "../../src/domains/demo/demo-users.service";

const outputPath = resolve(process.argv[2] ?? "outputs/demo2/connected.json");
const sessionIds = Array.from({ length: 6 }, () => createDemoSessionId());
const touched = new Set<string>();

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * value) - 1)] ?? 0;
}

async function marker(companyId: string, suffix: string) {
  const personas = await getDemoPersonaUsers(companyId);
  assert.ok(personas.client);
  return prisma.order.create({
    data: {
      reference: `DEMO2-${suffix}-${randomUUID()}`,
      status: "PENDING",
      source: "CLIENT",
      totalAmount: 0,
      itemCount: 1,
      notes: `DEMO-2 marqueur ${suffix}`,
      deliveryCategory: "STANDARD",
      companyId,
      customerId: personas.client.id,
    },
  });
}

async function release(companyId: string) {
  const environment = await prisma.demoPoolEnvironment.findUnique({ where: { companyId } });
  if (!environment || environment.state === "READY") return;
  if (environment.state === "LEASED") await requestDemoPoolRecycle(companyId);
  if (environment.state === "QUARANTINED" || environment.state === "PREPARING") {
    await prisma.demoPoolEnvironment.update({
      where: { companyId },
      data: {
        state: "RECYCLING",
        leaseKeyHash: null,
        recycleRequestedAt: new Date(),
        recycleStartedAt: null,
        lastFailureCode: null,
      },
    });
  }
  const result = await recycleDemoPoolEnvironment(companyId);
  assert.ok(["recycled", "ready"].includes(result.status), JSON.stringify(result));
}

async function run() {
  const base = await prisma.company.findUnique({ where: { slug: DEMO_COMPANY_SLUG } });
  assert.ok(base?.isDemo, "modèle permanent absent");
  const permanentBefore = await prisma.order.count({ where: { companyId: base.id } });
  const prepared = await prepareDemoPool({ baseCompanyId: base.id, size: DEMO_POOL_MIN_READY });
  assert.equal(prepared.ready, DEMO_POOL_MIN_READY);
  assert.equal(prepared.leased, 0);

  const openingStarted = performance.now();
  const [a1, a2, b] = await Promise.all([
    leaseDemoPoolEnvironment(sessionIds[0]!),
    leaseDemoPoolEnvironment(sessionIds[0]!),
    leaseDemoPoolEnvironment(sessionIds[1]!),
  ]);
  const firstOpeningMs = performance.now() - openingStarted;
  [a1.companyId, b.companyId].forEach((id) => touched.add(id));
  assert.equal(a1.companyId, a2.companyId, "double clic non idempotent");
  assert.notEqual(a1.companyId, b.companyId, "fuite A/B");

  const c = await leaseDemoPoolEnvironment(sessionIds[2]!);
  touched.add(c.companyId);
  assert.equal(new Set([a1.companyId, b.companyId, c.companyId]).size, 3);
  await assert.rejects(
    leaseDemoPoolEnvironment(sessionIds[3]!),
    (error: unknown) => error instanceof DemoPoolUnavailableError
  );

  const [markerA, markerB] = await Promise.all([
    marker(a1.companyId, "A"),
    marker(b.companyId, "B"),
  ]);
  const logoutStarted = performance.now();
  assert.equal(await requestDemoPoolRecycle(a1.companyId), true);
  const logoutQueueMs = performance.now() - logoutStarted;
  assert.ok(logoutQueueMs < 2_000, `mise en file logout trop lente: ${logoutQueueMs}ms`);
  assert.equal(await getActiveDemoPoolLease(sessionIds[0]!), null);
  assert.equal((await recycleDemoPoolEnvironment(a1.companyId)).status, "recycled");
  assert.equal(await prisma.order.findUnique({ where: { id: markerA.id } }), null);
  assert.ok(await prisma.order.findUnique({ where: { id: markerB.id } }));

  const d = await leaseDemoPoolEnvironment(sessionIds[3]!);
  touched.add(d.companyId);
  assert.equal(d.companyId, a1.companyId);
  assert.equal(await requestDemoPoolRecycle(d.companyId), true);
  const failed = await recycleDemoPoolEnvironment(d.companyId, {
    assertStorageEmpty: async () => { throw new Error("STORAGE_TIMEOUT"); },
  });
  assert.deepEqual({ status: failed.status, reason: failed.reason }, {
    status: "quarantined",
    reason: "STORAGE_TIMEOUT",
  });
  await prisma.demoPoolEnvironment.update({
    where: { companyId: d.companyId },
    data: {
      state: "RECYCLING",
      recycleRequestedAt: new Date(),
      lastFailureCode: null,
    },
  });
  assert.equal((await recycleDemoPoolEnvironment(d.companyId)).status, "recycled");

  // Une location abandonnée est récupérée à expiration, sans toucher B/C.
  await prisma.demoPoolEnvironment.update({
    where: { companyId: b.companyId },
    data: { leaseExpiresAt: new Date(Date.now() - 1_000) },
  });
  const expiryResults = await maintainDemoPool({ limit: 3 });
  assert.ok(expiryResults.some((item) => item.companyId === b.companyId && item.status === "recycled"));
  assert.equal(await prisma.order.findUnique({ where: { id: markerB.id } }), null);
  assert.ok(await getActiveDemoPoolLease(sessionIds[2]!));

  // Une fonction interrompue en PREPARING est reprise après le délai de verrou.
  assert.equal(await requestDemoPoolRecycle(c.companyId), true);
  await prisma.demoPoolEnvironment.update({
    where: { companyId: c.companyId },
    data: {
      state: "PREPARING",
      recycleStartedAt: new Date(Date.now() - 11 * 60 * 1000),
    },
  });
  const restartResults = await maintainDemoPool({ limit: 3 });
  assert.ok(restartResults.some((item) => item.companyId === c.companyId && item.status === "recycled"));

  const reconnect = await leaseDemoPoolEnvironment(sessionIds[4]!);
  touched.add(reconnect.companyId);
  const reconnectSamples: number[] = [];
  for (let index = 0; index < 20; index += 1) {
    const started = performance.now();
    const active = await getActiveDemoPoolLease(sessionIds[4]!);
    reconnectSamples.push(performance.now() - started);
    assert.equal(active?.companyId, reconnect.companyId);
  }
  await release(reconnect.companyId);

  const stats = await getDemoPoolStats();
  assert.deepEqual(stats, { ready: 3, leased: 0, quarantined: 0, total: 3 });
  assert.equal(await prisma.order.count({ where: { companyId: base.id } }), permanentBefore);
  return {
    task: "DEMO-2",
    passed: true,
    environment: "preproduction-database",
    pool: stats,
    isolation: {
      doubleClickSameLease: true,
      visitorsUseDistinctCompanies: true,
      poolEmptyFailsExplicitly: true,
      aRecyclePreservedB: true,
      permanentModelUnchanged: true,
    },
    recovery: {
      logoutQueuedBeforeRecycle: true,
      expirationRecycled: true,
      interruptedWorkerRecovered: true,
      storageFailureQuarantined: true,
      quarantineRecoveredByExplicitOperatorAction: true,
    },
    measurementsMs: {
      concurrentFirstLease: Math.round(firstOpeningMs),
      logoutQueue: Math.round(logoutQueueMs),
      reconnectP95: Math.round(percentile(reconnectSamples, 0.95)),
    },
  };
}

async function main() {
  let proof: Awaited<ReturnType<typeof run>> | undefined;
  try {
    proof = await run();
  } finally {
    for (const companyId of touched) await release(companyId);
  }
  assert.ok(proof);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, measurementsMs: proof.measurementsMs, pool: proof.pool }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
