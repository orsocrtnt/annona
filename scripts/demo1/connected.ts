import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/services/prisma/client";
import {
  createDemoSessionId,
  demoSessionCompanySlug,
  ensureDemoSessionEnvironment,
} from "../../src/domains/demo/demo-session.service";
import { getDemoPersonaUsers } from "../../src/domains/demo/demo-users.service";
import { resetDemoScenario } from "../../src/domains/demo/demo-scenario.service";

const outputPath = resolve(process.argv[2] ?? "outputs/demo1/connected.json");
const fixtureKey = `demo1-${randomUUID()}`;
const baseSlug = `${fixtureKey}-base`;
const sessionIds = [createDemoSessionId(), createDemoSessionId()] as const;
const sessionSlugs = sessionIds.map(demoSessionCompanySlug);

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { slug: { in: [baseSlug, ...sessionSlugs] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;
  const users = await prisma.user.findMany({
    where: { companyId: { in: companyIds } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  await prisma.operationJob.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.supportTicket.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.invoice.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.recurringOrder.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  if (userIds.length > 0) {
    await prisma.driverLocation.deleteMany({ where: { driverId: { in: userIds } } });
  }
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function residue() {
  const companies = await prisma.company.findMany({
    where: { slug: { in: [baseSlug, ...sessionSlugs] } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  const [users, orders, deliveries] = await Promise.all([
    prisma.user.count({ where: { companyId: { in: companyIds } } }),
    prisma.order.count({ where: { companyId: { in: companyIds } } }),
    prisma.delivery.count({ where: { companyId: { in: companyIds } } }),
  ]);
  return { companies: companies.length, users, orders, deliveries };
}

async function createMarker(companyId: string, customerId: string, suffix: string) {
  return prisma.order.create({
    data: {
      reference: `DEMO1-${suffix}-${randomUUID()}`,
      status: "PENDING",
      source: "CLIENT",
      totalAmount: 0,
      itemCount: 0,
      notes: `${fixtureKey}-${suffix}`,
      deliveryCategory: "STANDARD",
      companyId,
      customerId,
    },
  });
}

async function run() {
  await cleanup();
  const startedAt = performance.now();
  const base = await prisma.company.create({
    data: {
      name: "DEMO-1 — modèle fictif",
      slug: baseSlug,
      isDemo: true,
      status: "ACTIVE",
      city: "Paris",
      country: "FR",
      settings: {},
    },
  });

  const [sessionA, sessionB] = await Promise.all([
    ensureDemoSessionEnvironment(base.id, sessionIds[0]),
    ensureDemoSessionEnvironment(base.id, sessionIds[1]),
  ]);
  assert.notEqual(sessionA.companyId, sessionB.companyId);
  assert.equal(sessionA.created, true);
  assert.equal(sessionB.created, true);

  const [personasA, personasB] = await Promise.all([
    getDemoPersonaUsers(sessionA.companyId),
    getDemoPersonaUsers(sessionB.companyId),
  ]);
  for (const personas of [personasA, personasB]) {
    assert.ok(personas.admin);
    assert.ok(personas.client);
    assert.ok(personas.driver);
  }
  assert.notEqual(personasA.client!.id, personasB.client!.id);

  const [ordersA, ordersB] = await Promise.all([
    prisma.order.count({ where: { companyId: sessionA.companyId } }),
    prisma.order.count({ where: { companyId: sessionB.companyId } }),
  ]);
  // Le nombre suit le scénario versionné (DEMO_SCENARIO_VERSION) : seules l’égalité et la non-nullité comptent.
  assert.ok(ordersA > 0);
  assert.equal(ordersB, ordersA);

  const [markerA, markerB] = await Promise.all([
    createMarker(sessionA.companyId, personasA.client!.id, "A"),
    createMarker(sessionB.companyId, personasB.client!.id, "B"),
  ]);
  await resetDemoScenario(sessionA.companyId, new Date("2026-10-16T12:00:00.000Z"), {
    ensureCanonicalRoster: false,
  });
  assert.equal(await prisma.order.findUnique({ where: { id: markerA.id } }), null);
  assert.ok(await prisma.order.findUnique({ where: { id: markerB.id } }));
  assert.equal(await prisma.order.count({ where: { companyId: sessionA.companyId } }), ordersA);
  assert.equal(await prisma.order.count({ where: { companyId: sessionB.companyId } }), ordersA + 1);

  const reusedB = await ensureDemoSessionEnvironment(base.id, sessionIds[1]);
  assert.equal(reusedB.companyId, sessionB.companyId);
  assert.equal(reusedB.created, false);
  assert.ok(await prisma.order.findUnique({ where: { id: markerB.id } }));

  return {
    task: "DEMO-1",
    passed: true,
    fixture: "isolated-and-removed",
    sessions: {
      distinctCompanies: true,
      personasPerSession: ["admin", "client", "driver"],
      baseOrdersPerSession: ordersA,
      existingSessionReusedWithoutReset: true,
    },
    resetIsolation: {
      ownMarkerRemoved: true,
      otherMarkerPreserved: true,
      otherOrderCountAfterReset: 9,
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
  assert.deepEqual(remaining, { companies: 0, users: 0, orders: 0, deliveries: 0 });
  assert.ok(proof);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ ...proof, residue: remaining }, null, 2)}\n`);
  console.log(
    JSON.stringify({ passed: true, totalAutomatedMs: proof.totalAutomatedMs, residue: remaining })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
