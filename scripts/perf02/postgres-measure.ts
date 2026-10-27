import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/services/prisma/client";
import { createClientOrder, getCompanyOrders } from "../../src/domains/order/order.service";
import { getDispatchDriversMap } from "../../src/domains/delivery/dispatch-map.service";
import { activateManualPilot } from "../../src/domains/saas/saas.service";
import { percentile } from "./run-local";
import { PERF02_PG_CONCURRENCY, assertLocalPerf02Database } from "./local-database";

const outputPath = resolve(process.argv[2] ?? "outputs/perf02/postgres-local.json");
const COMPANIES = 10;
const DRIVERS_PER_COMPANY = 5;
const ORDERS_PER_LEVEL = 48;

type Fixture = { companyId: string; clientId: string; clientEmail: string };

function rounded(value: number) {
  return Math.round(value * 10) / 10;
}

function errorCode(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string") return code;
  return error instanceof Error ? error.message.split(":")[0]!.slice(0, 60) : "UNKNOWN";
}

async function roles() {
  const entries = [
    ["company-admin", "COMPANY_ADMIN"],
    ["client", "CLIENT"],
    ["driver", "DRIVER"],
  ] as const;
  const result: Record<string, string> = {};
  for (const [slug, systemRole] of entries) {
    const role = await prisma.role.upsert({
      where: { slug },
      create: { slug, name: slug, systemRole, isSystem: true },
      update: {},
    });
    result[systemRole] = role.id;
  }
  return result;
}

async function createFixtures(): Promise<Fixture[]> {
  const roleIds = await roles();
  const fixtures: Fixture[] = [];
  for (let index = 0; index < COMPANIES; index += 1) {
    const slug = `perf02-pg-${index}`;
    const company = await prisma.company.create({
      data: { name: `PERF-02 ${index}`, slug, isDemo: true, settings: { deliveryCategories: { STANDARD: true } } },
    });
    await activateManualPilot({
      companyId: company.id,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
      features: ["auto_dispatch"],
      limits: { admins: 1, drivers: DRIVERS_PER_COMPANY, dispatchers: 1, monthlyOrders: 10_000 },
    });
    const client = await prisma.user.create({
      data: { authId: `${slug}-client`, email: `client@${slug}.invalid`, firstName: "Client", lastName: slug, status: "ACTIVE", companyId: company.id, roleId: roleIds.CLIENT! },
    });
    await prisma.user.create({
      data: { authId: `${slug}-admin`, email: `admin@${slug}.invalid`, firstName: "Admin", lastName: slug, status: "ACTIVE", companyId: company.id, roleId: roleIds.COMPANY_ADMIN! },
    });
    await prisma.user.createMany({
      data: Array.from({ length: DRIVERS_PER_COMPANY }, (_, driver) => ({
        authId: `${slug}-driver-${driver}`,
        email: `driver-${driver}@${slug}.invalid`,
        firstName: `Livreur ${driver}`,
        lastName: slug,
        status: "ACTIVE" as const,
        companyId: company.id,
        roleId: roleIds.DRIVER!,
      })),
    });
    fixtures.push({ companyId: company.id, clientId: client.id, clientEmail: client.email });
  }
  return fixtures;
}

async function runLevel<T>(concurrency: number, total: number, operation: (index: number) => Promise<T>) {
  const durations: number[] = [];
  const errors: Record<string, number> = {};
  let next = 0;
  const startedAt = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < total) {
        const index = next;
        next += 1;
        const opStartedAt = performance.now();
        try {
          await operation(index);
          durations.push(performance.now() - opStartedAt);
        } catch (error) {
          const code = errorCode(error);
          errors[code] = (errors[code] ?? 0) + 1;
        }
      }
    })
  );
  const elapsedMs = performance.now() - startedAt;
  return {
    concurrency,
    operations: total,
    succeeded: durations.length,
    errors,
    p50Ms: rounded(percentile(durations, 0.5)),
    p95Ms: rounded(percentile(durations, 0.95)),
    maxMs: rounded(Math.max(0, ...durations)),
    throughputPerSecond: rounded((durations.length / elapsedMs) * 1000),
  };
}

async function settleJobs() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const running = await prisma.operationJob.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } });
    if (running === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("PERF02_JOBS_DID_NOT_SETTLE");
}

async function main() {
  const database = assertLocalPerf02Database(process.env.DATABASE_URL);
  assert.equal(new URL(process.env.GEOCODING_URL ?? "https://invalid").hostname, "127.0.0.1", "PERF02_GEOCODING_MUST_BE_LOCAL");
  const fixtures = await createFixtures();
  const serverVersion = await prisma.$queryRaw<{ server_version: string }[]>`SHOW server_version`;

  const orderCreation = [];
  const ordersByCompany = new Map<string, Set<string>>();
  for (const concurrency of PERF02_PG_CONCURRENCY) {
    orderCreation.push(
      await runLevel(concurrency, ORDERS_PER_LEVEL, async (index) => {
        const fixture = fixtures[index % fixtures.length]!;
        const order = await createClientOrder(fixture.clientId, fixture.companyId, fixture.clientEmail, {
          deliveryCategory: "STANDARD",
          items: [{ name: "Colis PERF-02", quantity: 1, estimatedPrice: 12 }],
          stops: undefined,
          pickupStops: undefined,
          shippingAddress: `${index + 1} rue de la Mesure`,
          shippingCity: "Paris",
          shippingPostalCode: "75011",
          requestedDeliveryDate: new Date(Date.now() + 86_400_000).toISOString(),
          notes: `perf02-c${concurrency}-${index}`,
        });
        const created = ordersByCompany.get(fixture.companyId) ?? new Set<string>();
        created.add(order.id);
        ordersByCompany.set(fixture.companyId, created);
      })
    );
    await settleJobs();
  }

  const dashboardReads = [];
  const dispatchMapReads = [];
  for (const concurrency of PERF02_PG_CONCURRENCY) {
    dashboardReads.push(
      await runLevel(concurrency, ORDERS_PER_LEVEL, (index) => getCompanyOrders(fixtures[index % fixtures.length]!.companyId))
    );
    dispatchMapReads.push(
      await runLevel(concurrency, ORDERS_PER_LEVEL, (index) => getDispatchDriversMap(fixtures[index % fixtures.length]!.companyId))
    );
  }

  // Isolation : chaque entreprise ne relit que ses propres commandes.
  for (const fixture of fixtures) {
    const read = (await getCompanyOrders(fixture.companyId)).map((order) => order.id).sort();
    const created = [...(ordersByCompany.get(fixture.companyId) ?? [])].sort();
    assert.deepEqual(read, created, "PERF02_TENANT_ORDERS_MISMATCH");
  }
  const autoDispatchJobs = await prisma.operationJob.count({ where: { type: "AUTO_DISPATCH" } });

  const proof = {
    task: "PERF-02",
    slice: "postgres-local",
    executedAt: new Date().toISOString(),
    target: { host: database.hostname, port: database.port, database: database.pathname.slice(1), postgres: serverVersion[0]?.server_version ?? null },
    environment: {
      node: process.version,
      connectionLimit: Number(new URL(process.env.DATABASE_URL!).searchParams.get("connection_limit") ?? process.env.DATABASE_CONNECTION_LIMIT ?? 5),
      geocoding: "local refusé (aucun appel réseau)",
      companies: COMPANIES,
      driversPerCompany: DRIVERS_PER_COMPANY,
      operationsPerLevel: ORDERS_PER_LEVEL,
    },
    orderCreation,
    dashboardReads,
    dispatchMapReads,
    isolation: { companiesChecked: fixtures.length, tenantLeak: false },
    autoDispatchJobs,
    limits: [
      "Base locale sans latence réseau : ces durées excluent l'aller-retour vers Supabase (≈ 550 ms par requête depuis le poste, voir DISPATCH-3).",
      "Aucune mesure Next.js, Storage, Realtime, hébergement ni préproduction.",
    ],
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    passed: true,
    orderCreation: orderCreation.map(({ concurrency, p50Ms, p95Ms, errors }) => ({ concurrency, p50Ms, p95Ms, errors })),
    autoDispatchJobs,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
