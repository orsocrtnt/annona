import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { prisma } from "../../src/services/prisma/client";
import { getCompanyOnboardingStatus } from "../../src/domains/onboarding/onboarding.service";
import { createClientOrder } from "../../src/domains/order/order.service";
import { assignDeliveryToDriver, updateDeliveryStatusByDriver } from "../../src/domains/delivery/delivery.service";
import { acknowledgeDeliveryMissionByDriver } from "../../src/domains/delivery/acknowledge-delivery-mission.service";
import { startDeliveryMissionByDriver } from "../../src/domains/delivery/start-delivery-mission.service";
import { DEFAULT_BILLING_SETTINGS } from "../../src/lib/validations/billing-settings";
import { DEFAULT_DISPATCH_SETTINGS } from "../../src/lib/validations/dispatch-settings";

const outputPath = resolve(process.argv[2] ?? "outputs/onboard1/connected.json");
const fixtureKey = `onboard1-${randomUUID()}`;

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

async function cleanup() {
  const companies = await prisma.company.findMany({
    where: { slug: { startsWith: fixtureKey } },
    select: { id: true },
  });
  const ids = companies.map((company) => company.id);
  if (ids.length === 0) return;
  await prisma.operationJob.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.invoice.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.order.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.user.deleteMany({ where: { companyId: { in: ids } } });
  await prisma.company.deleteMany({ where: { id: { in: ids } } });
}

async function residue() {
  const [companies, users, orders, deliveries, jobs] = await Promise.all([
    prisma.company.count({ where: { slug: { startsWith: fixtureKey } } }),
    prisma.user.count({ where: { authId: { startsWith: fixtureKey } } }),
    prisma.order.count({ where: { notes: { startsWith: fixtureKey } } }),
    prisma.delivery.count({ where: { order: { notes: { startsWith: fixtureKey } } } }),
    prisma.operationJob.count({ where: { company: { slug: { startsWith: fixtureKey } } } }),
  ]);
  return { companies, users, orders, deliveries, jobs };
}

async function waitForFixtureJobs(companyId: string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const running = await prisma.operationJob.count({
      where: { companyId, status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (running === 0) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("ONBOARD1_JOBS_DID_NOT_SETTLE");
}

async function run() {
  await cleanup();
  const startedAt = performance.now();
  const roles = await roleIds();

  const configStartedAt = performance.now();
  const company = await prisma.company.create({
    data: {
      name: "ONBOARD-1 — entreprise fictive",
      slug: `${fixtureKey}-company`,
      status: "TRIAL",
      isDemo: true,
      settings: {
        deliveryCategories: { STANDARD: true, COURIER: false, SPECIAL_MISSION: false },
        billing: DEFAULT_BILLING_SETTINGS,
        dispatchRules: DEFAULT_DISPATCH_SETTINGS,
      },
    },
  });
  const afterConfiguration = await getCompanyOnboardingStatus(company.id);
  assert.equal(afterConfiguration.completedSteps, 2);
  const configurationMs = performance.now() - configStartedAt;

  const accountsStartedAt = performance.now();
  const [admin, client, driver] = await Promise.all([
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-admin`,
        email: `admin@${fixtureKey}.invalid`,
        firstName: "Admin",
        lastName: "ONBOARD-1",
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.COMPANY_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-client`,
        email: `client@${fixtureKey}.invalid`,
        firstName: "Client",
        lastName: "ONBOARD-1",
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.CLIENT,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${fixtureKey}-driver`,
        email: `driver@${fixtureKey}.invalid`,
        firstName: "Livreur",
        lastName: "ONBOARD-1",
        status: "ACTIVE",
        companyId: company.id,
        roleId: roles.DRIVER,
      },
    }),
  ]);
  assert.ok(admin.id);
  const afterAccounts = await getCompanyOnboardingStatus(company.id);
  assert.equal(afterAccounts.completedSteps, 5);
  const accountsMs = performance.now() - accountsStartedAt;

  const orderStartedAt = performance.now();
  const order = await createClientOrder(
    client.id,
    company.id,
    client.email,
    {
      deliveryCategory: "STANDARD",
      items: [{ name: "Colis fictif ONBOARD-1", quantity: 1, estimatedPrice: 18 }],
      stops: undefined,
      pickupStops: undefined,
      shippingAddress: "1 place de la Concorde",
      shippingCity: "Paris",
      shippingPostalCode: "75008",
      requestedDeliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      deliveryInstructions: "Recette interne ONBOARD-1",
      notes: fixtureKey,
    },
    { idempotencyKey: `${fixtureKey}:order` }
  );
  const afterOrder = await getCompanyOnboardingStatus(company.id);
  assert.equal(afterOrder.completedSteps, 6);
  const createOrderMs = performance.now() - orderStartedAt;

  const deliveryStartedAt = performance.now();
  const delivery = await prisma.delivery.findFirstOrThrow({ where: { orderId: order.id } });
  await assignDeliveryToDriver(company.id, delivery.id, driver.id, {
    reason: "Première livraison fictive ONBOARD-1",
  });
  const assigned = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  await acknowledgeDeliveryMissionByDriver(driver.id, company.id, delivery.id, {
    action: "accept",
    expectedUpdatedAt: assigned.updatedAt,
  });
  const accepted = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
  await startDeliveryMissionByDriver(driver.id, company.id, delivery.id, accepted.updatedAt);
  await updateDeliveryStatusByDriver(driver.id, delivery.id, "IN_DELIVERY");
  await updateDeliveryStatusByDriver(driver.id, delivery.id, "DELIVERED", {
    confirmOutOfRange: true,
    podOutcome: "SUCCESS",
    podNote: "Preuve fictive ONBOARD-1",
    podPhotoPath: `${company.id}/${delivery.id}-${randomUUID()}.png`,
  });
  const finalStatus = await getCompanyOnboardingStatus(company.id);
  assert.equal(finalStatus.completedSteps, 7);
  assert.equal(finalStatus.readyForInternalTest, true);
  await waitForFixtureJobs(company.id);
  const completeDeliveryMs = performance.now() - deliveryStartedAt;

  return {
    task: "ONBOARD-1-internal",
    passed: true,
    fixture: "isolated-and-removed",
    progression: [
      { stage: "configuration", completedSteps: afterConfiguration.completedSteps },
      { stage: "accounts", completedSteps: afterAccounts.completedSteps },
      { stage: "first-order", completedSteps: afterOrder.completedSteps },
      { stage: "first-delivery", completedSteps: finalStatus.completedSteps },
    ],
    timingsMs: {
      configuration: Math.round(configurationMs),
      accountPreparation: Math.round(accountsMs),
      orderCreation: Math.round(createOrderMs),
      assignmentToProof: Math.round(completeDeliveryMs),
      totalAutomated: Math.round(performance.now() - startedAt),
    },
    assistance: {
      automatedFixture: true,
      realInvitationEmail: false,
      realPilot: false,
      initialImport: "not-offered",
    },
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
  assert.deepEqual(remaining, { companies: 0, users: 0, orders: 0, deliveries: 0, jobs: 0 });
  assert.ok(proof);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ ...proof, residue: remaining }, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify({ passed: true, totalAutomatedMs: proof.timingsMs.totalAutomated, residue: remaining })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
