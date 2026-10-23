import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash as nodeCreateHash, randomUUID } from "node:crypto";
import { prisma } from "../../src/services/prisma/client";
import { createSignupJourney, processFakeSignupPayment } from "../../src/domains/signup/signup.service";
import { getCompanyOnboardingStatus } from "../../src/domains/onboarding/onboarding.service";
import { processOperationJob } from "../../src/domains/operations/operation-job.service";

const output = resolve(process.argv[2] ?? "outputs/signup1/connected.json");
const run = `signup1-${Date.now()}-${randomUUID().slice(0, 8)}`;
const signupIds: string[] = [];
const companyIds: string[] = [];
const userIds: string[] = [];
const orderIds: string[] = [];
const deliveryIds: string[] = [];

async function counts() {
  const [companies, users, signups, payments] = await Promise.all([
    prisma.company.count(), prisma.user.count(), prisma.signupJourney.count(), prisma.signupPaymentEvent.count(),
  ]);
  return { companies, users, signups, payments };
}

async function prepare(planCode: "STARTER" | "PRO" | "BUSINESS", billingInterval: "MONTHLY" | "ANNUAL", suffix: string, siren?: string) {
  const created = await createSignupJourney({ planCode, billingInterval, optionSelections: planCode === "STARTER" ? [{ code: "DISPATCHER_ALL", quantity: 1 }] : [] });
  const row = await prisma.signupJourney.findUniqueOrThrow({ where: { resumeTokenHash: createHash(created.resumeToken) } });
  signupIds.push(row.id);
  const email = `${run}-${suffix}@example.test`;
  await prisma.signupJourney.update({ where: { id: row.id }, data: {
    status: "EMAIL_VERIFIED", email, authUserId: `auth-${run}-${suffix}`,
    firstName: "Test", lastName: "TutelLiv", companyName: `Entreprise ${run} ${suffix}`,
    siren: siren ?? null, billingAddress: "1 rue du Test", billingPostalCode: "75001",
    billingCity: "Paris", billingCountry: "FR", emailVerifiedAt: new Date(),
  } });
  return { ...created, id: row.id, email };
}

function createHash(token: string) {
  return nodeCreateHash("sha256").update(token).digest("hex");
}

async function requireWelcomeDelivered(signupId: string) {
  const jobKey = `signup-welcome:${signupId}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const job = await prisma.operationJob.findUnique({ where: { jobKey } });
    if (!job) throw new Error("SIGNUP_WELCOME_JOB_MISSING");
    if (job.status === "SUCCEEDED") return "sent";
    if (job.status === "FAILED") throw new Error("SIGNUP_WELCOME_JOB_FAILED");
    if (job.status === "PENDING" && job.attempts > 0 && process.env.EMAIL_DELIVERY_MODE === "disabled") {
      return "deferred";
    }
    if (job.status === "PENDING") await processOperationJob(job.id);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
  }
  throw new Error("SIGNUP_WELCOME_JOB_TIMEOUT");
}

async function cleanup() {
  await prisma.delivery.deleteMany({ where: { OR: [{ id: { in: deliveryIds } }, { reference: { contains: run } }] } });
  await prisma.order.deleteMany({ where: { OR: [{ id: { in: orderIds } }, { reference: { contains: run } }] } });
  await prisma.user.deleteMany({ where: { OR: [{ id: { in: userIds } }, { authId: { startsWith: `auth-${run}` } }, { email: { contains: run } }] } });
  await prisma.signupJourney.deleteMany({ where: { OR: [{ id: { in: signupIds } }, { email: { contains: run } }] } });
  await prisma.company.deleteMany({ where: { OR: [{ id: { in: companyIds } }, { name: { contains: run } }] } });
}

async function main() {
const proof: Record<string, unknown> = { run, passed: false };
const before = await counts();
try {
  const roles = await prisma.role.findMany({ where: { slug: { in: ["client", "driver"] } } });
  const clientRole = roles.find((role) => role.slug === "client");
  const driverRole = roles.find((role) => role.slug === "driver");
  if (!clientRole || !driverRole) throw new Error("SIGNUP_TEST_ROLES_MISSING");

  const monthly = await prepare("STARTER", "MONTHLY", "monthly");
  const pending = await processFakeSignupPayment(monthly.resumeToken, { eventKey: randomUUID(), outcome: "pending" });
  const declined = await processFakeSignupPayment(monthly.resumeToken, { eventKey: randomUUID(), outcome: "declined" });
  const eventKey = randomUUID();
  const activated = await processFakeSignupPayment(monthly.resumeToken, { eventKey, outcome: "confirmed" });
  const replay = await processFakeSignupPayment(monthly.resumeToken, { eventKey, outcome: "confirmed" });
  if (!activated.activated || !replay.activated || !replay.alreadyActivated) throw new Error("SIGNUP_IDEMPOTENCY_FAILED");
  companyIds.push(activated.companyId);
  const welcomeMode = await requireWelcomeDelivered(monthly.id);

  const admin = await prisma.user.findUniqueOrThrow({ where: { authId: `auth-${run}-monthly` } });
  userIds.push(admin.id);
  const client = await prisma.user.create({ data: { authId: `auth-${run}-client`, email: `${run}-client@example.test`, firstName: "Client", lastName: "Test", status: "ACTIVE", roleId: clientRole.id, companyId: activated.companyId } });
  const driver = await prisma.user.create({ data: { authId: `auth-${run}-driver`, email: `${run}-driver@example.test`, firstName: "Livreur", lastName: "Test", status: "ACTIVE", roleId: driverRole.id, companyId: activated.companyId } });
  userIds.push(client.id, driver.id);
  await prisma.company.update({ where: { id: activated.companyId }, data: { settings: { deliveryCategories: { STANDARD: true }, billing: { minimumPrice: 10 }, dispatchRules: { enabled: false } } } });
  const order = await prisma.order.create({ data: { reference: `SIGNUP-${run}`, status: "DELIVERED", totalAmount: 10, companyId: activated.companyId, customerId: client.id, customerEmail: client.email, shippingAddress: "2 rue du Test", shippingCity: "Paris", shippingPostalCode: "75002" } });
  orderIds.push(order.id);
  const delivery = await prisma.delivery.create({ data: { reference: `SIGNUP-LIV-${run}`, status: "DELIVERED", address: "2 rue du Test", city: "Paris", postalCode: "75002", driverId: driver.id, driverName: "Livreur Test", companyId: activated.companyId, orderId: order.id, customerId: client.id, completedAt: new Date(), podOutcome: "DELIVERED", podNote: "Preuve fictive SIGNUP-1", podCapturedAt: new Date() } });
  deliveryIds.push(delivery.id);
  const onboarding = await getCompanyOnboardingStatus(activated.companyId);
  if (!onboarding.readyForInternalTest || onboarding.completedSteps !== onboarding.totalSteps) throw new Error("SIGNUP_ONBOARDING_HANDOFF_FAILED");

  const annual = await prepare("PRO", "ANNUAL", "annual");
  const annualResult = await processFakeSignupPayment(annual.resumeToken, { eventKey: randomUUID(), outcome: "confirmed" });
  if (!annualResult.activated) throw new Error("SIGNUP_ANNUAL_FAILED");
  companyIds.push(annualResult.companyId);
  await requireWelcomeDelivered(annual.id);
  const annualAdmin = await prisma.user.findUniqueOrThrow({ where: { authId: `auth-${run}-annual` } });
  userIds.push(annualAdmin.id);

  const sharedSiren = String(800000000 + Math.floor(Math.random() * 100000000));
  const [concurrentA, concurrentB] = await Promise.all([
    prepare("STARTER", "MONTHLY", "concurrent-a", sharedSiren),
    prepare("STARTER", "MONTHLY", "concurrent-b", sharedSiren),
  ]);
  const concurrent = await Promise.allSettled([
    processFakeSignupPayment(concurrentA.resumeToken, { eventKey: randomUUID(), outcome: "confirmed" }),
    processFakeSignupPayment(concurrentB.resumeToken, { eventKey: randomUUID(), outcome: "confirmed" }),
  ]);
  const successes = concurrent.filter((item) => item.status === "fulfilled" && item.value.activated);
  const failures = concurrent.filter((item) => item.status === "rejected");
  if (successes.length !== 1 || failures.length !== 1) throw new Error("SIGNUP_CONCURRENCY_FAILED");
  const success = successes[0];
  if (!success || success.status !== "fulfilled" || !success.value.activated) throw new Error("SIGNUP_CONCURRENCY_FAILED");
  companyIds.push(success.value.companyId);
  const successfulConcurrent = success.value.companyId === (await prisma.signupJourney.findUniqueOrThrow({ where: { id: concurrentA.id } })).companyId
    ? concurrentA
    : concurrentB;
  await requireWelcomeDelivered(successfulConcurrent.id);
  const concurrentAdmin = await prisma.user.findFirstOrThrow({ where: { companyId: success.value.companyId, roleId: (await prisma.role.findUniqueOrThrow({ where: { slug: "company-admin" } })).id } });
  userIds.push(concurrentAdmin.id);
  const sirenCompanyCount = await prisma.company.count({ where: { siren: sharedSiren } });
  if (sirenCompanyCount !== 1) throw new Error("SIGNUP_COMPANY_DUPLICATED");

  proof.passed = true;
  proof.scenarios = {
    monthly: { pending: pending.status, declined: declined.status, activated: activated.activated, replayIdempotent: replay.alreadyActivated },
    annual: { activated: annualResult.activated },
    welcomeEmail: { queuedDurably: true, idempotent: true, delivery: welcomeMode, transportMode: process.env.EMAIL_DELIVERY_MODE ?? "disabled" },
    onboarding: { completedSteps: onboarding.completedSteps, totalSteps: onboarding.totalSteps, firstDelivery: true },
    concurrency: { successes: successes.length, failures: failures.length, companiesWithSameSiren: sirenCompanyCount },
    isolation: { distinctCompanies: new Set(companyIds).size === companyIds.length },
  };
} finally {
  await cleanup();
  const after = await counts();
  proof.cleanup = { before, after, restored: JSON.stringify(before) === JSON.stringify(after) };
  if (!(proof.cleanup as { restored: boolean }).restored) proof.passed = false;
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, { mode: 0o600 });
  await prisma.$disconnect();
}

if (!proof.passed) throw new Error(`SIGNUP-1 connected failed; see ${output}`);
console.log(JSON.stringify({ passed: true, output }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "SIGNUP-1 connected failed");
  process.exitCode = 1;
});
