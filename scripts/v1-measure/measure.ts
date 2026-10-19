import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "../../src/services/prisma/client";
import { createClientOrder } from "../../src/domains/order/order.service";
import { assignDeliveryToDriver } from "../../src/domains/delivery/delivery.service";
import {
  getOrderConversation,
  postOrderMessage,
  type ConversationActor,
} from "../../src/domains/order-conversation/order-conversation.service";
import { getOrderTracking } from "../../src/domains/tracking/tracking.service";
import { DEFAULT_DISPATCH_SETTINGS } from "../../src/lib/validations/dispatch-settings";

const SAMPLE_COUNT = 5;
const outputPath = resolve(
  process.argv[2] ?? "outputs/v1-mesure/internal-baseline.json"
);
const runKey = `v1mesure-${randomUUID()}`;

type Sample = {
  index: number;
  creationMs: number;
  assignmentMs: number;
  clientQuestionMs: number;
  adminReplyMs: number;
  conversationReadMs: number;
  clientTrackingReadMs: number;
  adminTrackingReadMs: number;
  positionState: string;
  timelineEntries: number;
};

function elapsed(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

function aggregate(samples: Sample[], key: keyof Sample) {
  const values = samples
    .map((sample) => sample[key])
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {
    samples: values,
    minMs: values[0],
    medianMs:
      values.length % 2
        ? values[middle]
        : Math.round(((values[middle - 1] ?? 0) + (values[middle] ?? 0)) * 5) / 10,
    maxMs: values.at(-1),
  };
}

async function counts() {
  const [companies, users, orders, deliveries, messages] = await Promise.all([
    prisma.company.count(),
    prisma.user.count(),
    prisma.order.count(),
    prisma.delivery.count(),
    prisma.orderMessage.count(),
  ]);
  return { companies, users, orders, deliveries, messages };
}

async function cleanup() {
  const company = await prisma.company.findUnique({
    where: { slug: runKey },
    select: { id: true },
  });
  if (!company) return;

  await prisma.operationJob.deleteMany({ where: { companyId: company.id } });
  await prisma.order.deleteMany({ where: { companyId: company.id } });
  await prisma.user.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: company.id, slug: runKey } });
}

async function residue() {
  const [companies, users, orders, deliveries, messages, jobs] = await Promise.all([
    prisma.company.count({ where: { slug: runKey } }),
    prisma.user.count({ where: { email: { endsWith: `@${runKey}.invalid` } } }),
    prisma.order.count({ where: { notes: { startsWith: runKey } } }),
    prisma.delivery.count({ where: { order: { notes: { startsWith: runKey } } } }),
    prisma.orderMessage.count({ where: { body: { startsWith: runKey } } }),
    prisma.operationJob.count({ where: { company: { slug: runKey } } }),
  ]);
  return { companies, users, orders, deliveries, messages, jobs };
}

async function main() {
  const before = await counts();
  const roles = await Promise.all(
    (["COMPANY_ADMIN", "CLIENT", "DRIVER"] as const).map(async (systemRole) => {
      const role = await prisma.role.findFirst({ where: { systemRole }, select: { id: true } });
      assert.ok(role, `ROLE_MISSING:${systemRole}`);
      return [systemRole, role.id] as const;
    })
  );
  const roleIds = Object.fromEntries(roles) as Record<(typeof roles)[number][0], string>;

  const company = await prisma.company.create({
    data: {
      name: "V1 Mesure — fixture temporaire",
      slug: runKey,
      isDemo: true,
      settings: {
        dispatchRules: {
          ...DEFAULT_DISPATCH_SETTINGS,
          maxActiveDeliveriesPerDriver: 10,
        },
      },
    },
  });
  const now = new Date();
  const [admin, client, driver] = await Promise.all([
    prisma.user.create({
      data: {
        authId: `${runKey}-admin`,
        email: `admin@${runKey}.invalid`,
        firstName: "Admin",
        lastName: "Mesure",
        status: "ACTIVE",
        companyId: company.id,
        roleId: roleIds.COMPANY_ADMIN,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${runKey}-client`,
        email: `client@${runKey}.invalid`,
        firstName: "Client",
        lastName: "Mesure",
        status: "ACTIVE",
        companyId: company.id,
        roleId: roleIds.CLIENT,
      },
    }),
    prisma.user.create({
      data: {
        authId: `${runKey}-driver`,
        email: `driver@${runKey}.invalid`,
        firstName: "Livreur",
        lastName: "Mesure",
        status: "ACTIVE",
        companyId: company.id,
        roleId: roleIds.DRIVER,
        settings: {
          trackingService: {
            active: true,
            startedAt: now.toISOString(),
            endedAt: null,
          },
        },
      },
    }),
  ]);

  const adminActor: ConversationActor = {
    id: admin.id,
    companyId: company.id,
    role: "COMPANY_ADMIN",
    permissions: ["orders:read", "orders:update", "deliveries:read", "deliveries:update", "deliveries:dispatch"],
    name: "Admin Mesure",
  };
  const clientActor: ConversationActor = {
    id: client.id,
    companyId: company.id,
    role: "CLIENT",
    permissions: ["dashboard:client"],
    name: "Client Mesure",
  };

  const samples: Sample[] = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const note = `${runKey}:${index}`;
    const requestedDeliveryDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    let startedAt = performance.now();
    const order = await createClientOrder(
      client.id,
      company.id,
      client.email,
      {
        deliveryCategory: "STANDARD",
        items: [{ name: "Colis de mesure", quantity: 1, estimatedPrice: 10 }],
        stops: undefined,
        pickupStops: undefined,
        shippingAddress: "1 place de la Concorde",
        shippingCity: "Paris",
        shippingPostalCode: "75008",
        requestedDeliveryDate,
        deliveryInstructions: "Fixture V1-MESURE",
        notes: note,
      },
      { idempotencyKey: `${runKey}:create:${index}` }
    );
    const creationMs = elapsed(startedAt);
    const delivery = await prisma.delivery.findFirstOrThrow({ where: { orderId: order.id } });

    startedAt = performance.now();
    await assignDeliveryToDriver(company.id, delivery.id, driver.id, {
      reason: "Affectation V1-MESURE",
    });
    const assignmentMs = elapsed(startedAt);

    startedAt = performance.now();
    await postOrderMessage(clientActor, order.id, {
      body: `${note}: question client`,
      kind: "QUESTION",
      internal: false,
      requestKey: `${runKey}:question:${index}`,
    });
    const clientQuestionMs = elapsed(startedAt);

    startedAt = performance.now();
    await postOrderMessage(adminActor, order.id, {
      body: `${note}: réponse dispatch`,
      kind: "INSTRUCTION",
      internal: false,
      requestKey: `${runKey}:reply:${index}`,
    });
    const adminReplyMs = elapsed(startedAt);

    startedAt = performance.now();
    const conversation = await getOrderConversation(clientActor, order.id);
    const conversationReadMs = elapsed(startedAt);
    assert.equal(conversation.messages.length, 2);

    const missionStartedAt = new Date();
    await prisma.$transaction([
      prisma.order.update({ where: { id: order.id }, data: { status: "IN_DELIVERY" } }),
      prisma.delivery.update({
        where: { id: delivery.id },
        data: {
          status: "IN_DELIVERY",
          missionAcceptedAt: missionStartedAt,
          missionStartedAt,
        },
      }),
      prisma.driverLocation.upsert({
        where: { driverId: driver.id },
        create: {
          driverId: driver.id,
          latitude: 48.8656,
          longitude: 2.3212,
          accuracy: 8,
        },
        update: {
          latitude: 48.8656,
          longitude: 2.3212,
          accuracy: 8,
        },
      }),
      prisma.trackingEvent.create({
        data: {
          deliveryId: delivery.id,
          label: "En cours de livraison",
          description: "Position fictive V1-MESURE",
        },
      }),
    ]);

    startedAt = performance.now();
    const clientTracking = await getOrderTracking(clientActor, order.id);
    const clientTrackingReadMs = elapsed(startedAt);

    startedAt = performance.now();
    const adminTracking = await getOrderTracking(adminActor, order.id);
    const adminTrackingReadMs = elapsed(startedAt);
    const trackedDelivery = clientTracking.deliveries[0];
    assert.ok(trackedDelivery);
    assert.equal(trackedDelivery.position.state, "FRESH");
    assert.equal(adminTracking.deliveries[0]?.id, trackedDelivery.id);

    samples.push({
      index,
      creationMs,
      assignmentMs,
      clientQuestionMs,
      adminReplyMs,
      conversationReadMs,
      clientTrackingReadMs,
      adminTrackingReadMs,
      positionState: trackedDelivery.position.state,
      timelineEntries: trackedDelivery.timeline.length,
    });
  }

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1_500));
  return {
    before,
    samples,
    aggregates: {
      creation: aggregate(samples, "creationMs"),
      assignment: aggregate(samples, "assignmentMs"),
      clientQuestion: aggregate(samples, "clientQuestionMs"),
      adminReply: aggregate(samples, "adminReplyMs"),
      conversationRead: aggregate(samples, "conversationReadMs"),
      clientTrackingRead: aggregate(samples, "clientTrackingReadMs"),
      adminTrackingRead: aggregate(samples, "adminTrackingReadMs"),
    },
  };
}

async function run() {
  let output: Record<string, unknown> = {
    task: "V1-MESURE",
    measuredAt: new Date().toISOString(),
    environment: {
      machine: "Mac Apple M1, 8 Go, arm64",
      runtime: `Node ${process.version}`,
      application: "Services TutelLiv locaux, PostgreSQL Supabase distant de test",
      network: "Connexion courante non bridée ; aucun réseau mobile ni mode hors ligne",
      device: "Harnais automatisé Node ; aucun téléphone physique",
      volume: `${SAMPLE_COUNT} scénarios identiques, 1 commande/livraison et 2 messages par scénario`,
      assistance: "Harnais automatisé ; aucune mesure d’autonomie d’un utilisateur novice",
    },
    interpretation:
      "Latences techniques internes sur données fictives. Elles ne mesurent ni un temps humain complet ni un gain client et ne doivent pas être publiées comme promesse commerciale.",
  };

  try {
    output = { ...output, ...(await main()), passed: true };
  } catch (error) {
    output = {
      ...output,
      passed: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
    process.exitCode = 1;
  } finally {
    await cleanup();
    const fixtureResidue = await residue();
    const after = await counts();
    const clean = Object.values(fixtureResidue).every((value) => value === 0);
    output = { ...output, after, fixtureResidue, clean };
    if (!clean) process.exitCode = 1;
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    await prisma.$disconnect();
  }

  console.log(
    JSON.stringify({
      passed: output.passed,
      clean: output.clean,
      aggregates: output.aggregates,
    })
  );
}

void run();
