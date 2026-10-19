import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/services/prisma/client";
import {
  createClientOrder,
  getClientOrderById,
  updateCompanyOrderStatus,
} from "../../src/domains/order/order.service";
import {
  assignDeliveryToDriver,
  updateDeliveryStatusByDriver,
} from "../../src/domains/delivery/delivery.service";
import { acknowledgeDeliveryMissionByDriver } from "../../src/domains/delivery/acknowledge-delivery-mission.service";
import { startDeliveryMissionByDriver } from "../../src/domains/delivery/start-delivery-mission.service";
import {
  createOrderInvoice,
  getClientInvoiceById,
} from "../../src/domains/invoice/invoice.service";
import { DEFAULT_BILLING_SETTINGS } from "../../src/lib/validations/billing-settings";
import { DEFAULT_DISPATCH_SETTINGS } from "../../src/lib/validations/dispatch-settings";

const outputPath = resolve(process.argv[2] ?? "outputs/special1/connected.json");
const fixturePrefix = "special1-";
const fixtureKey = `${fixturePrefix}${randomUUID()}`;

async function roleIds() {
  const roles = await Promise.all(
    (["COMPANY_ADMIN", "CLIENT", "DRIVER"] as const).map(async (systemRole) => {
      const role = await prisma.role.findFirst({
        where: { systemRole },
        select: { id: true },
      });
      assert.ok(role, `ROLE_MISSING:${systemRole}`);
      return [systemRole, role.id] as const;
    })
  );
  return Object.fromEntries(roles) as Record<(typeof roles)[number][0], string>;
}

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: fixturePrefix } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  if (companyIds.length === 0) return;
  await prisma.operationJob.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.invoice.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.order.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.user.deleteMany({ where: { companyId: { in: companyIds } } });
  await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
}

async function residue() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: fixturePrefix } },
    select: { id: true },
  });
  const companyIds = companies.map((company) => company.id);
  const [users, orders, deliveries, invoices, jobs] = await Promise.all([
    prisma.user.count({ where: { authId: { startsWith: fixturePrefix } } }),
    prisma.order.count({ where: { notes: { startsWith: fixturePrefix } } }),
    prisma.delivery.count({ where: { order: { notes: { startsWith: fixturePrefix } } } }),
    prisma.invoice.count({ where: { companyId: { in: companyIds } } }),
    prisma.operationJob.count({ where: { companyId: { in: companyIds } } }),
  ]);
  return { companies: companies.length, users, orders, deliveries, invoices, jobs };
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
  throw new Error("SPECIAL1_JOBS_DID_NOT_SETTLE");
}

async function run() {
  await cleanup();
  const startedAt = performance.now();
  const roles = await roleIds();

  const companyA = await prisma.company.create({
    data: {
      name: "SPECIAL-1 — entreprise fictive A",
      slug: `${fixtureKey}-a`,
      isDemo: true,
      settings: {
        deliveryCategories: { STANDARD: true, COURIER: true, SPECIAL_MISSION: true },
        billing: DEFAULT_BILLING_SETTINGS,
        dispatchRules: {
          ...DEFAULT_DISPATCH_SETTINGS,
          driverRules: [],
        },
      },
    },
  });
  const companyB = await prisma.company.create({
    data: {
      name: "SPECIAL-1 — entreprise fictive B",
      slug: `${fixtureKey}-b`,
      isDemo: true,
      settings: { dispatchRules: DEFAULT_DISPATCH_SETTINGS },
    },
  });

  const [adminA, clientA, driverA, clientB] = await Promise.all([
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-admin-a`,
        email: `admin@${fixtureKey}-a.invalid`,
        firstName: "Admin",
        lastName: "SPECIAL-1 A",
        status: "ACTIVE",
        companyId: companyA.id,
        roleId: roles.COMPANY_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-client-a`,
        email: `client@${fixtureKey}-a.invalid`,
        firstName: "Client",
        lastName: "SPECIAL-1 A",
        status: "ACTIVE",
        companyId: companyA.id,
        roleId: roles.CLIENT,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-driver-a`,
        email: `driver@${fixtureKey}-a.invalid`,
        firstName: "Livreur",
        lastName: "SPECIAL-1 A",
        status: "ACTIVE",
        companyId: companyA.id,
        roleId: roles.DRIVER,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-client-b`,
        email: `client@${fixtureKey}-b.invalid`,
        firstName: "Client",
        lastName: "SPECIAL-1 B",
        status: "ACTIVE",
        companyId: companyB.id,
        roleId: roles.CLIENT,
      },
    }),
  ]);
  assert.ok(adminA.id);

  await prisma.company.update({
    where: { id: companyA.id },
    data: {
      settings: {
        deliveryCategories: { STANDARD: true, COURIER: true, SPECIAL_MISSION: true },
        billing: DEFAULT_BILLING_SETTINGS,
        dispatchRules: {
          ...DEFAULT_DISPATCH_SETTINGS,
          driverRules: [
            {
              driverId: driverA.id,
              priority: 1,
              allowedCategories: {
                STANDARD: true,
                COURIER: true,
                SPECIAL_MISSION: true,
              },
              zoneIds: [],
              postalCodePrefixes: [],
              dispatchStatus: "ACTIVE",
            },
          ],
        },
      },
    },
  });

  const order = await createClientOrder(
    clientA.id,
    companyA.id,
    clientA.email,
    {
      deliveryCategory: "SPECIAL_MISSION",
      missionDescription:
        "Transport fictif de mobilier fragile entre trois adresses pour la recette SPECIAL-1.",
      stops: [
        { label: "Départ", address: "1 place de la Concorde", city: "Paris", postalCode: "75008" },
        { label: "Étape", address: "8 boulevard du Palais", city: "Paris", postalCode: "75001" },
        { label: "Arrivée", address: "5 avenue Anatole France", city: "Paris", postalCode: "75007" },
      ],
      items: [],
      pickupStops: undefined,
      requestedDeliveryDate: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      notes: fixtureKey,
    },
    { idempotencyKey: `${fixtureKey}:request` }
  );
  assert.equal(order.status, "QUOTE_REQUESTED");
  assert.equal(order.stops.length, 3);
  assert.equal(await prisma.delivery.count({ where: { orderId: order.id } }), 0);

  assert.equal(await getClientOrderById(clientB.id, companyB.id, order.id), null);
  assert.equal(await updateCompanyOrderStatus(companyB.id, order.id, "PENDING"), null);
  await assert.rejects(
    updateCompanyOrderStatus(companyA.id, order.id, "DELIVERED"),
    /SPECIAL_QUOTE_TRANSITION_INVALID/
  );
  assert.equal(
    (await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status,
    "QUOTE_REQUESTED"
  );

  const converted = await updateCompanyOrderStatus(companyA.id, order.id, "PENDING");
  assert.ok(converted);
  await waitForJobs(companyA.id);
  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { orderId: order.id },
    include: { trackingEvents: { orderBy: { occurredAt: "asc" } } },
  });
  assert.equal(delivery.deliveryCategory, "SPECIAL_MISSION");
  assert.equal(delivery.pickupAddress, "1 place de la Concorde");
  assert.equal(delivery.address, "5 avenue Anatole France");
  assert.ok(
    delivery.trackingEvents.some((event) => event.label === "Accord confirmé hors TutelLiv")
  );

  await assignDeliveryToDriver(companyA.id, delivery.id, driverA.id, {
    reason: "Affectation fictive SPECIAL-1",
  });
  const assigned = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  await acknowledgeDeliveryMissionByDriver(driverA.id, companyA.id, delivery.id, {
    action: "accept",
    expectedUpdatedAt: assigned.updatedAt,
  });
  const accepted = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  await startDeliveryMissionByDriver(driverA.id, companyA.id, delivery.id, accepted.updatedAt);
  await updateDeliveryStatusByDriver(driverA.id, delivery.id, "IN_DELIVERY");
  await updateDeliveryStatusByDriver(driverA.id, delivery.id, "DELIVERED", {
    confirmOutOfRange: true,
    podOutcome: "SUCCESS",
    podNote: "Preuve fictive SPECIAL-1",
    podPhotoPath: `${companyA.id}/${delivery.id}-${randomUUID()}.png`,
  });

  const invoice = await createOrderInvoice(companyA.id, order.id, {
    feeIds: [],
    includePurchases: false,
    customLines: [
      { label: "Mission spéciale — montant convenu hors TutelLiv", amount: 320 },
    ],
    notes: "Facturation fictive après livraison SPECIAL-1",
  });
  assert.ok(invoice);
  assert.equal(Number(invoice.amount), 384);
  assert.ok(await getClientInvoiceById(clientA.id, companyA.id, invoice.id));
  assert.equal(await getClientInvoiceById(clientB.id, companyB.id, invoice.id), null);
  await waitForJobs(companyA.id);

  const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  const finalDelivery = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  assert.equal(finalOrder.status, "DELIVERED");
  assert.equal(finalDelivery.status, "DELIVERED");

  return {
    task: "SPECIAL-1",
    passed: true,
    fixture: "isolated-and-removed",
    request: {
      status: "QUOTE_REQUESTED",
      orderedStops: 3,
      deliveryBeforeManualConversion: 0,
      directCompletionRejected: true,
    },
    quoteBoundary: {
      pricedQuoteInTutelLiv: false,
      clientAcceptanceInTutelLiv: false,
      agreementRecordedAsExternal: true,
      pilotPromise: "excluded",
    },
    execution: {
      deliveryCreatedAfterManualConversion: true,
      pickupFromFirstStop: true,
      destinationFromLastStop: true,
      driverAcknowledgedAndCompleted: true,
      proofRecorded: true,
    },
    billing: {
      invoiceAfterDelivery: true,
      customNetAmount: 320,
      totalWithVat: Number(invoice.amount),
      visibleToOwningClient: true,
    },
    tenantIsolation: {
      foreignOrderRead: true,
      foreignStatusWrite: true,
      foreignInvoiceRead: true,
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
    orders: 0,
    deliveries: 0,
    invoices: 0,
    jobs: 0,
  });
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
