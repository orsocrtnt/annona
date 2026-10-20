import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "../../src/services/prisma/client";
import {
  createClientOrder,
  getClientOrderById,
} from "../../src/domains/order/order.service";
import {
  assignDeliveryToDriver,
  getClientDeliveryById,
  getDriverMissionById,
  updateDeliveryStatusByDriver,
} from "../../src/domains/delivery/delivery.service";
import { acknowledgeDeliveryMissionByDriver } from "../../src/domains/delivery/acknowledge-delivery-mission.service";
import { startDeliveryMissionByDriver } from "../../src/domains/delivery/start-delivery-mission.service";
import {
  createOrderInvoice,
  getClientInvoiceById,
} from "../../src/domains/invoice/invoice.service";
import {
  getOrderConversation,
  postOrderMessage,
  type ConversationActor,
} from "../../src/domains/order-conversation/order-conversation.service";
import { getOrderTracking } from "../../src/domains/tracking/tracking.service";
import { DEFAULT_DISPATCH_SETTINGS } from "../../src/lib/validations/dispatch-settings";

const outputPath = resolve(process.argv[2] ?? "outputs/test2/connected.json");
const fixtureKey = `test2-${randomUUID()}`;
const fixtureDeliveryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

type FixtureCompany = {
  id: string;
  slug: string;
  admin: { id: string };
  client: { id: string; email: string };
  driver: { id: string };
};

async function roleIds() {
  const roles = await Promise.all(
    (["COMPANY_ADMIN", "CLIENT", "DRIVER"] as const).map(async (systemRole) => {
      const role = await prisma.role.findFirst({ where: { systemRole }, select: { id: true } });
      assert.ok(role, `ROLE_MISSING:${systemRole}`);
      return [systemRole, role.id] as const;
    })
  );
  return Object.fromEntries(roles) as Record<(typeof roles)[number][0], string>;
}

async function createCompany(
  suffix: "a" | "b",
  roles: Awaited<ReturnType<typeof roleIds>>
): Promise<FixtureCompany> {
  const slug = `${fixtureKey}-${suffix}`;
  const company = await prisma.company.create({
    data: {
      name: `TEST-2 — entreprise ${suffix.toUpperCase()}`,
      slug,
      isDemo: true,
      settings: {
        dispatchRules: {
          ...DEFAULT_DISPATCH_SETTINGS,
          maxActiveDeliveriesPerDriver: 10,
        },
      },
    },
  });
  const [admin, client, driver] = await Promise.all([
    prisma.user.create({
      data: {
        authId: `${slug}-admin`,
        email: `admin@${slug}.invalid`,
        firstName: "Admin",
        lastName: `TEST-2 ${suffix.toUpperCase()}`,
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.COMPANY_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${slug}-client`,
        email: `client@${slug}.invalid`,
        firstName: "Client",
        lastName: `TEST-2 ${suffix.toUpperCase()}`,
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.CLIENT,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${slug}-driver`,
        email: `driver@${slug}.invalid`,
        firstName: "Livreur",
        lastName: `TEST-2 ${suffix.toUpperCase()}`,
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.DRIVER,
      },
    }),
  ]);
  return { id: company.id, slug, admin, client, driver };
}

function actor(
  user: { id: string },
  companyId: string,
  role: "COMPANY_ADMIN" | "CLIENT",
  suffix: string
): ConversationActor {
  return {
    id: user.id,
    companyId,
    role,
    permissions:
      role === "CLIENT"
        ? ["dashboard:client"]
        : ["orders:read", "orders:update", "deliveries:read", "deliveries:update"],
    name: `${role} TEST-2 ${suffix}`,
  };
}

async function createOrder(company: FixtureCompany, suffix: string) {
  return createClientOrder(
    company.client.id,
    company.id,
    company.client.email,
    {
      deliveryCategory: "STANDARD",
      items: [{ name: `Colis TEST-2 ${suffix}`, quantity: 1, estimatedPrice: 25 }],
      stops: undefined,
      pickupStops: undefined,
      shippingAddress: "1 place de la Concorde",
      shippingCity: "Paris",
      shippingPostalCode: "75008",
      requestedDeliveryDate: fixtureDeliveryDate,
      deliveryInstructions: "Fixture isolée TEST-2",
      notes: `${fixtureKey}:${suffix}`,
    },
    { idempotencyKey: `${fixtureKey}:create:${suffix}` }
  );
}

async function createCourierOrder(company: FixtureCompany, suffix: string) {
  return createClientOrder(
    company.client.id,
    company.id,
    company.client.email,
    {
      deliveryCategory: "COURIER",
      items: [],
      stops: undefined,
      pickupStops: [
        {
          label: "Collecte TEST-2",
          address: "5 rue de Rivoli",
          city: "Paris",
          postalCode: "75001",
          items: [{ name: `Dossier TEST-2 ${suffix}`, quantity: 1, estimatedPrice: 18 }],
        },
      ],
      shippingAddress: "10 boulevard Voltaire",
      shippingCity: "Paris",
      shippingPostalCode: "75011",
      requestedDeliveryDate: fixtureDeliveryDate,
      deliveryInstructions: "Fixture coursier TEST-2",
      notes: `${fixtureKey}:${suffix}`,
    },
    { idempotencyKey: `${fixtureKey}:create:${suffix}` }
  );
}

async function assignAcceptStart(company: FixtureCompany, orderId: string) {
  const delivery = await prisma.delivery.findFirstOrThrow({ where: { orderId } });
  await assignDeliveryToDriver(company.id, delivery.id, company.driver.id, {
    reason: "Recette TEST-2",
  });
  const assigned = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  await acknowledgeDeliveryMissionByDriver(company.driver.id, company.id, delivery.id, {
    action: "accept",
    expectedUpdatedAt: assigned.updatedAt,
  });
  const accepted = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  await startDeliveryMissionByDriver(
    company.driver.id,
    company.id,
    delivery.id,
    accepted.updatedAt
  );
  return prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
}

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: fixtureKey } },
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
  const [companies, users, orders, deliveries, invoices, jobs] = await Promise.all([
    prisma.company.count({ where: { slug: { startsWith: fixtureKey } } }),
    prisma.user.count({ where: { authId: { startsWith: fixtureKey } } }),
    prisma.order.count({ where: { notes: { startsWith: fixtureKey } } }),
    prisma.delivery.count({ where: { order: { notes: { startsWith: fixtureKey } } } }),
    prisma.invoice.count({ where: { company: { slug: { startsWith: fixtureKey } } } }),
    prisma.operationJob.count({ where: { company: { slug: { startsWith: fixtureKey } } } }),
  ]);
  return { companies, users, orders, deliveries, invoices, jobs };
}

async function scenario() {
  const roles = await roleIds();
  const [companyA, companyB] = await Promise.all([
    createCompany("a", roles),
    createCompany("b", roles),
  ]);
  const clientA = actor(companyA.client, companyA.id, "CLIENT", "A");
  const adminA = actor(companyA.admin, companyA.id, "COMPANY_ADMIN", "A");
  const clientB = actor(companyB.client, companyB.id, "CLIENT", "B");

  const [deliveredOrder, failedOrder, companyBOrder] = await Promise.all([
    createOrder(companyA, "delivered"),
    createOrder(companyA, "failed"),
    createOrder(companyB, "tenant-b"),
  ]);
  const [idempotentA, idempotentB] = await Promise.all([
    createOrder(companyA, "idempotent"),
    createOrder(companyA, "idempotent"),
  ]);
  const [courierA, courierB] = await Promise.all([
    createCourierOrder(companyA, "courier"),
    createCourierOrder(companyA, "courier"),
  ]);
  assert.equal(idempotentA.id, idempotentB.id);
  assert.equal(courierA.id, courierB.id);
  const [idempotentCount, courierCount] = await Promise.all([
    prisma.order.count({ where: { companyId: companyA.id, notes: `${fixtureKey}:idempotent` } }),
    prisma.order.count({ where: { companyId: companyA.id, notes: `${fixtureKey}:courier` } }),
  ]);
  assert.equal(idempotentCount, 1);
  assert.equal(courierCount, 1);

  await postOrderMessage(clientA, deliveredOrder.id, {
    body: `${fixtureKey}: question client`,
    kind: "QUESTION",
    internal: false,
    requestKey: `${fixtureKey}:question`,
  });
  await postOrderMessage(adminA, deliveredOrder.id, {
    body: `${fixtureKey}: réponse dispatch`,
    kind: "INSTRUCTION",
    internal: false,
    requestKey: `${fixtureKey}:reply`,
  });
  const conversation = await getOrderConversation(clientA, deliveredOrder.id);
  assert.equal(conversation.messages.length, 2);

  const deliveryToComplete = await assignAcceptStart(companyA, deliveredOrder.id);
  await updateDeliveryStatusByDriver(companyA.driver.id, deliveryToComplete.id, "IN_DELIVERY");
  await updateDeliveryStatusByDriver(companyA.driver.id, deliveryToComplete.id, "DELIVERED", {
    confirmOutOfRange: true,
    podOutcome: "SUCCESS",
    podNote: "Preuve fictive TEST-2",
    podPhotoPath: `${companyA.id}/${deliveryToComplete.id}-${randomUUID()}.png`,
  });

  const deliveryToFail = await assignAcceptStart(companyA, failedOrder.id);
  await updateDeliveryStatusByDriver(companyA.driver.id, deliveryToFail.id, "IN_DELIVERY");
  await assert.rejects(
    updateDeliveryStatusByDriver(companyA.driver.id, deliveryToFail.id, "FAILED", {
      confirmOutOfRange: true,
      podOutcome: "FAILED",
      podNote: "Motif manquant — fixture TEST-2",
    }),
    /POD_REASON_REQUIRED/
  );
  await updateDeliveryStatusByDriver(companyA.driver.id, deliveryToFail.id, "FAILED", {
    confirmOutOfRange: true,
    podOutcome: "FAILED",
    podFailureCode: "ABSENT",
    podNote: "Destinataire absent — fixture TEST-2",
  });

  const courierDelivery = await assignAcceptStart(companyA, courierA.id);
  await assert.rejects(
    updateDeliveryStatusByDriver(companyA.driver.id, courierDelivery.id, "IN_DELIVERY"),
    /INVALID_STATUS_TRANSITION/
  );
  await updateDeliveryStatusByDriver(companyA.driver.id, courierDelivery.id, "PURCHASING", {
    confirmOutOfRange: true,
  });
  await updateDeliveryStatusByDriver(companyA.driver.id, courierDelivery.id, "IN_DELIVERY");
  await updateDeliveryStatusByDriver(companyA.driver.id, courierDelivery.id, "DELIVERED", {
    confirmOutOfRange: true,
    podOutcome: "SUCCESS",
    podNote: "Course livrée — fixture TEST-2",
    podPhotoPath: `${companyA.id}/${courierDelivery.id}-${randomUUID()}.png`,
  });

  const invoice = await createOrderInvoice(companyA.id, deliveredOrder.id, {
    feeIds: [],
    includePurchases: false,
    customLines: [{ label: "Livraison TEST-2", amount: 25 }],
  });
  assert.ok(invoice);

  const [completedState, failedState, courierState, tracking, failedAdminTracking, failedClientTracking, courierAdminTracking, courierClientTracking, ownBOrder] = await Promise.all([
    prisma.order.findUniqueOrThrow({ where: { id: deliveredOrder.id } }),
    prisma.order.findUniqueOrThrow({ where: { id: failedOrder.id } }),
    prisma.order.findUniqueOrThrow({ where: { id: courierA.id } }),
    getOrderTracking(adminA, deliveredOrder.id),
    getOrderTracking(adminA, failedOrder.id),
    getOrderTracking(clientA, failedOrder.id),
    getOrderTracking(adminA, courierA.id),
    getOrderTracking(clientA, courierA.id),
    getClientOrderById(companyB.client.id, companyB.id, companyBOrder.id),
  ]);
  assert.equal(completedState.status, "DELIVERED");
  assert.equal(failedState.status, "FAILED");
  assert.equal(courierState.status, "DELIVERED");
  assert.equal(invoice.status, "PENDING");
  assert.ok(tracking.deliveries.some((delivery) => delivery.status === "DELIVERED"));
  for (const view of [failedAdminTracking, failedClientTracking]) {
    assert.equal(view.status, "FAILED");
    assert.ok(
      view.deliveries.some(
        (delivery) =>
          delivery.status === "FAILED" &&
          delivery.timeline.some((event) => event.description?.includes("Destinataire absent"))
      )
    );
  }
  for (const view of [courierAdminTracking, courierClientTracking]) {
    assert.equal(view.status, "DELIVERED");
    assert.ok(view.deliveries.some((delivery) => delivery.status === "DELIVERED"));
  }
  assert.ok(ownBOrder);

  const [foreignOrder, foreignDelivery, foreignInvoice, foreignMission, foreignInvoiceWrite] =
    await Promise.all([
      getClientOrderById(companyB.client.id, companyB.id, deliveredOrder.id),
      getClientDeliveryById(companyB.client.id, companyB.id, deliveryToComplete.id),
      getClientInvoiceById(companyB.client.id, companyB.id, invoice.id),
      getDriverMissionById(companyB.driver.id, companyB.id, deliveryToComplete.id),
      createOrderInvoice(companyB.id, deliveredOrder.id, {
        feeIds: [],
        includePurchases: false,
        customLines: [{ label: "Refus TEST-2", amount: 1 }],
      }),
    ]);
  assert.equal(foreignOrder, null);
  assert.equal(foreignDelivery, null);
  assert.equal(foreignInvoice, null);
  assert.equal(foreignMission, null);
  assert.equal(foreignInvoiceWrite, null);
  await assert.rejects(getOrderConversation(clientB, deliveredOrder.id));

  return {
    companies: 2,
    roles: { client: true, admin: true, driver: true },
    delivered: {
      order: completedState.status,
      delivery: "DELIVERED",
      trackingVisible: true,
      proofRecorded: true,
    },
    failed: { order: failedState.status, delivery: "FAILED", reasonRecorded: true },
    idempotency: {
      standardConcurrentCreate: idempotentCount === 1,
      courierConcurrentCreate: courierCount === 1,
    },
    courier: {
      order: courierState.status,
      delivery: "DELIVERED",
      pickupRequired: true,
      invalidSkipRefused: true,
      adminClientTimelineConsistent: true,
    },
    failureReason: {
      missingReasonRefused: true,
      adminClientTimelineConsistent: true,
    },
    invoice: { status: invoice.status, clientVisible: Boolean(await getClientInvoiceById(companyA.client.id, companyA.id, invoice.id)) },
    tenantIsolation: {
      order: foreignOrder === null,
      delivery: foreignDelivery === null,
      invoice: foreignInvoice === null,
      driverMission: foreignMission === null,
      invoiceWrite: foreignInvoiceWrite === null,
      conversation: true,
    },
  };
}

async function run() {
  let output: Record<string, unknown> = {
    task: "TEST-2",
    executedAt: new Date().toISOString(),
    fixture: "Deux entreprises temporaires TEST-2, identifiants aléatoires non exportés",
  };
  try {
    output = { ...output, ...(await scenario()), passed: true };
  } catch (error) {
    output = {
      ...output,
      passed: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
    process.exitCode = 1;
  } finally {
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_000));
    await cleanup();
    const fixtureResidue = await residue();
    const clean = Object.values(fixtureResidue).every((value) => value === 0);
    output = { ...output, fixtureResidue, clean };
    if (!clean) process.exitCode = 1;
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await prisma.$disconnect();
  }
  console.log(JSON.stringify({ passed: output.passed, clean: output.clean }));
}

void run();
