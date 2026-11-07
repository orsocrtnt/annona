/**
 * NOTIF-1 — notifications du client : NOT-01 (rappel avant l'heure limite), NOT-02 (confirmation, avec
 * regroupement des modifications rapprochées), NOT-03 (livreur en approche, rejeu hors réseau), canaux et
 * isolation entre entreprises. Base en mémoire (`helpers/memory-db.ts`), canaux remplacés par des témoins.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONFIRMATION_WINDOW_MS,
  deliverMerchantNotificationJob,
  merchantsToRemind,
  queueOrderConfirmation,
  queueOrderReminders,
  queueStopApproach,
  type NotificationDb,
} from "../src/domains/notification/merchant-notification.service";
import {
  dispatchNotification,
  emailChannel,
  notificationChannels,
  registerNotificationChannel,
  type NotificationChannel,
  type NotificationMessage,
} from "../src/domains/notification/notification-channels";
import { markStopDelivered, reportStopIncident, startRound, type DriverRoundDb } from "../src/domains/round/round-driver.service";
import { createMemoryDb } from "./helpers/memory-db";

type Row = Record<string, unknown>;
const day = (date: string) => new Date(`${date}T00:00:00.000Z`);
/** Mardi 10 novembre 2026 : heure limite lundi 9 à 17 h (16 h UTC), rappel 2 h avant (14 h UTC). */
const D = "2026-11-10";

function user(id: string, companyId: string, merchantId: string | null, status = "ACTIVE", settings: Row = {}) {
  return { id, companyId, merchantId, status, email: `${id}@exemple.test`, settings, roleId: merchantId ? "role-merchant" : "role-driver" };
}
function merchant(id: string, companyId: string, active = true) {
  return { id, companyId, name: `Client ${id}`, active };
}
function order(id: string, companyId: string, merchantId: string, status = "VALIDATED", date = D) {
  return { id, companyId, merchantId, reference: `C-${id}`, deliveryDate: day(date), slotId: `slot-${companyId}`, status, origin: "MANUAL" };
}

function fixture() {
  const tables: Record<string, Row[]> = {
    company: [
      { id: "A", name: "Boulangerie A", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120 },
      { id: "B", name: "Boulangerie B", status: "ACTIVE", cutoffTime: "17:00", timezone: "Europe/Paris", reminderLeadMinutes: 120 },
    ],
    merchant: [
      merchant("M1", "A"), // aucune commande : rappel
      merchant("M2", "A"), // commande validée : pas de rappel
      merchant("M3", "A"), // récurrente active le mardi : pas de rappel
      merchant("M4", "A"), // récurrente suspendue : rappel
      merchant("M5", "A", false), // client désactivé : pas de rappel
      merchant("M6", "A"), // commande annulée : rappel
      merchant("M7", "A"), // seul compte désactivé : aucune tâche
      merchant("MB", "B"), // autre entreprise
    ],
    user: [
      user("u1", "A", "M1"),
      user("u1bis", "A", "M1", "ACTIVE", { orderReminders: false }),
      user("u2", "A", "M2"),
      user("u3", "A", "M3"),
      user("u4", "A", "M4"),
      user("u5", "A", "M5"),
      user("u6", "A", "M6"),
      user("u7", "A", "M7", "INACTIVE"),
      user("uB", "B", "MB"),
      user("driver1", "A", null),
    ],
    order: [order("O2", "A", "M2"), order("O6", "A", "M6", "CANCELLED")],
    recurringOrder: [
      { id: "R3", companyId: "A", merchantId: "M3", active: true, weekdays: [2, 4] },
      { id: "R4", companyId: "A", merchantId: "M4", active: false, weekdays: [2] },
      { id: "R4bis", companyId: "A", merchantId: "M4", active: true, weekdays: [1, 3] },
    ],
    slot: [
      { id: "slot-A", companyId: "A", label: null, startTime: "06:00", endTime: "07:00" },
      { id: "slot-B", companyId: "B", label: null, startTime: "06:00", endTime: "07:00" },
    ],
    product: [
      { id: "p1", companyId: "A", name: "Croissant", unit: "pièce", sortOrder: 1, basePriceCents: 120, vatRateBasisPoints: 550 },
      { id: "p2", companyId: "A", name: "Baguette", unit: "pièce", sortOrder: 2, basePriceCents: 100, vatRateBasisPoints: 550 },
    ],
    merchantPrice: [{ id: "mp1", companyId: "A", merchantId: "M2", productId: "p1", priceCents: 90 }],
    orderLine: [
      { id: "l1", companyId: "A", orderId: "O2", productId: "p1", quantityOrdered: 10, quantityDelivered: null, unitPriceFrozenCents: null },
      { id: "l2", companyId: "A", orderId: "O2", productId: "p2", quantityOrdered: 4, quantityDelivered: null, unitPriceFrozenCents: null },
    ],
    operationJob: [],
    clientNotification: [],
  };
  const db = createMemoryDb(tables, {
    decorate: {
      // Valeurs par défaut de Prisma que la base en mémoire ne pose pas.
      operationJob: (row) => ({ status: row.status ?? "PENDING", attempts: row.attempts ?? 0, nextAttemptAt: row.nextAttemptAt ?? row.createdAt }),
    },
  }) as unknown as NotificationDb & DriverRoundDb;
  return { tables, db };
}

const jobsOf = (tables: Record<string, Row[]>, prefix: string) => tables.operationJob!.filter((job) => String(job.jobKey).startsWith(prefix));

function recorder() {
  const sent: Array<{ message: NotificationMessage; userId: string; eventKey: string }> = [];
  const channel: NotificationChannel = {
    id: "in_app",
    async deliver(message, recipient, context) {
      sent.push({ message, userId: recipient.userId, eventKey: context.eventKey });
      return "sent";
    },
  };
  return { sent, channels: [channel] };
}

// ---------------------------------------------------------------------------
// NOT-01
// ---------------------------------------------------------------------------

test("NOT-01 : rappel seulement aux clients sans commande ni récurrente active, à partir de 2 h avant 17 h", async () => {
  const { tables, db } = fixture();
  const before = await queueOrderReminders({ now: new Date("2026-11-09T13:59:59Z"), db });
  assert.equal(before.windows.length, 0);
  assert.equal(tables.operationJob!.length, 0);

  const run = await queueOrderReminders({ now: new Date("2026-11-09T14:00:00Z"), db });
  assert.deepEqual(run.windows, [{ companyId: "A", date: D }, { companyId: "B", date: D }]);
  const keys = tables.operationJob!.map((job) => job.jobKey).sort();
  assert.deepEqual(keys, [
    `not01:M1:${D}:u1`,
    `not01:M1:${D}:u1bis`,
    `not01:M4:${D}:u4`,
    `not01:M6:${D}:u6`,
    `not01:MB:${D}:uB`,
  ]);
  // Chaque tâche porte l'entreprise de son client.
  assert.equal(tables.operationJob!.find((job) => job.jobKey === `not01:MB:${D}:uB`)!.companyId, "B");
  assert.deepEqual(await merchantsToRemind(db, "A", D), ["M1", "M4", "M6", "M7"]);
});

test("NOT-01 : une seule fois par client et par date, quel que soit le nombre de passages du cron", async () => {
  const { tables, db } = fixture();
  await queueOrderReminders({ now: new Date("2026-11-09T14:00:00Z"), db });
  const count = tables.operationJob!.length;
  await queueOrderReminders({ now: new Date("2026-11-09T14:10:00Z"), db });
  await queueOrderReminders({ now: new Date("2026-11-09T15:50:00Z"), db });
  assert.equal(tables.operationJob!.length, count);
  // À l'heure limite et après : plus aucun rappel.
  const late = await queueOrderReminders({ now: new Date("2026-11-09T16:00:00Z"), db });
  assert.equal(late.windows.length, 0);
});

test("NOT-01 : heure de Paris aux changements d'heure (25 octobre et 29 mars 2026) et délai paramétrable", async () => {
  const { tables, db } = fixture();
  // Livraison du lundi 26 octobre : heure limite dimanche 25 à 17 h, heure d'hiver (16 h UTC) → rappel 14 h UTC.
  assert.equal((await queueOrderReminders({ now: new Date("2026-10-25T13:59:00Z"), db })).windows.length, 0);
  assert.equal((await queueOrderReminders({ now: new Date("2026-10-25T14:00:00Z"), db })).windows[0]?.date, "2026-10-26");
  // Livraison du dimanche 25 octobre : heure limite samedi 24 à 17 h, heure d'été (15 h UTC) → rappel 13 h UTC.
  assert.equal((await queueOrderReminders({ now: new Date("2026-10-24T12:59:00Z"), db })).windows.length, 0);
  assert.equal((await queueOrderReminders({ now: new Date("2026-10-24T13:00:00Z"), db })).windows[0]?.date, "2026-10-25");
  // Livraison du lundi 30 mars : heure limite dimanche 29 à 17 h, heure d'été (15 h UTC) → rappel 13 h UTC.
  assert.equal((await queueOrderReminders({ now: new Date("2026-03-29T12:59:00Z"), db })).windows.length, 0);
  assert.equal((await queueOrderReminders({ now: new Date("2026-03-29T13:00:00Z"), db })).windows[0]?.date, "2026-03-30");
  // Délai réglé à 30 minutes ; délai 0 : pas de rappel.
  tables.company![0]!.reminderLeadMinutes = 30;
  tables.company![1]!.reminderLeadMinutes = 0;
  assert.equal((await queueOrderReminders({ now: new Date("2026-11-09T15:29:00Z"), db })).windows.length, 0);
  assert.deepEqual((await queueOrderReminders({ now: new Date("2026-11-09T15:30:00Z"), db })).windows, [{ companyId: "A", date: D }]);
});

test("NOT-01 : à l'envoi, rappel coupé par le client, commande passée entre-temps ou compte désactivé → rien", async () => {
  const { tables, db } = fixture();
  const now = new Date("2026-11-09T14:05:00Z");
  const { sent, channels } = recorder();
  const payload = (userId: string, merchantId: string) => ({ kind: "ORDER_REMINDER", companyId: "A", merchantId, userId, deliveryDate: D });
  assert.equal((await deliverMerchantNotificationJob(payload("u1", "M1"), "k1", { db, channels, now })).delivered, true);
  assert.equal(sent[0]!.message.title, "Pensez à commander pour demain");
  assert.match(sent[0]!.message.body, /mardi 10 novembre 2026/);
  assert.match(sent[0]!.message.body, /lun\. 9 nov\. à 17:00/);
  assert.equal((await deliverMerchantNotificationJob(payload("u1bis", "M1"), "k2", { db, channels, now })).delivered, false);
  tables.order!.push(order("O4", "A", "M4"));
  assert.equal((await deliverMerchantNotificationJob(payload("u4", "M4"), "k3", { db, channels, now })).delivered, false);
  assert.equal((await deliverMerchantNotificationJob(payload("u7", "M7"), "k4", { db, channels, now })).delivered, false);
  // Tâche retardée au-delà de l'heure limite.
  assert.equal((await deliverMerchantNotificationJob(payload("u6", "M6"), "k5", { db, channels, now: new Date("2026-11-09T16:00:00Z") })).delivered, false);
  assert.equal(sent.length, 1);
});

// ---------------------------------------------------------------------------
// NOT-02
// ---------------------------------------------------------------------------

test("NOT-02 : confirmation immédiate puis regroupement des modifications rapprochées (fenêtre de 5 min)", async () => {
  const { tables, db } = fixture();
  tables.user!.push(user("u2off", "A", "M2", "INACTIVE"));
  const t0 = new Date("2026-11-08T10:00:00Z");
  const input = { companyId: "A", orderId: "O2", merchantId: "M2", source: "MERCHANT" as const };

  const first = await queueOrderConfirmation(input, { now: t0, db });
  assert.equal(first.immediate.length, 1); // compte désactivé exclu
  assert.deepEqual(jobsOf(tables, "not02:O2:").map((job) => job.jobKey), ["not02:O2:0:u2"]);

  // Pas encore partie : la modification suivante s'y regroupe (l'envoi relira l'état final).
  assert.equal((await queueOrderConfirmation(input, { now: new Date(t0.getTime() + 30_000), db })).grouped, true);
  assert.equal(jobsOf(tables, "not02:O2:").length, 1);

  // Partie : une modification 1 min après est différée à la fin de la fenêtre.
  Object.assign(jobsOf(tables, "not02:O2:0")[0]!, { status: "SUCCEEDED", attempts: 1, nextAttemptAt: t0 });
  const second = await queueOrderConfirmation(input, { now: new Date(t0.getTime() + 60_000), db });
  assert.equal(second.immediate.length, 0);
  assert.equal(second.deferredUntil?.getTime(), t0.getTime() + CONFIRMATION_WINDOW_MS);
  assert.equal((await queueOrderConfirmation(input, { now: new Date(t0.getTime() + 120_000), db })).grouped, true);
  assert.equal(jobsOf(tables, "not02:O2:").length, 2);

  // Bien plus tard : nouvelle confirmation immédiate.
  Object.assign(jobsOf(tables, "not02:O2:1")[0]!, { status: "SUCCEEDED", attempts: 1 });
  const third = await queueOrderConfirmation(input, { now: new Date(t0.getTime() + 20 * 60_000), db });
  assert.equal(third.immediate.length, 1);
  assert.equal(jobsOf(tables, "not02:O2:2").length, 1);
});

test("NOT-02 : récapitulatif (date, créneau, lignes, total au prix du client), validée, modifiée, corrigée, annulée", async () => {
  const { tables, db } = fixture();
  const { sent, channels } = recorder();
  const payload = (revision: number, source = "MERCHANT") => ({ kind: "ORDER_CONFIRMATION", companyId: "A", orderId: "O2", userId: "u2", source, revision });
  await deliverMerchantNotificationJob(payload(0), "c0", { db, channels });
  const message = sent[0]!.message;
  assert.equal(message.title, "Commande validée");
  assert.equal(message.href, "/portal/orders/O2");
  // 10 croissants au prix du client (0,90 €) + 4 baguettes (1,00 €) = 13,00 € HT ; TVA 5,5 % = 0,72 € → 13,72 € TTC.
  assert.match(message.body, /C-O2 · mardi 10 novembre 2026, 6h – 7h : 14 articles, 13,72\s€ TTC\./);
  assert.match(message.email.text, /- 10 × Croissant \(pièce\) : 9,00\s€ HT/);
  assert.match(message.email.text, /- 4 × Baguette \(pièce\) : 4,00\s€ HT/);
  assert.match(message.email.text, /Total : 13,00\s€ HT, TVA 0,72\s€, 13,72\s€ TTC/);
  assert.match(message.email.text, /Modifiable jusqu'au lun\. 9 nov\. à 17:00/);
  await deliverMerchantNotificationJob(payload(1), "c1", { db, channels });
  assert.equal(sent[1]!.message.title, "Commande modifiée");
  await deliverMerchantNotificationJob(payload(2, "ADMIN"), "c2", { db, channels });
  assert.equal(sent[2]!.message.title, "Commande corrigée par la boulangerie");
  tables.order!.find((row) => row.id === "O2")!.status = "CANCELLED";
  await deliverMerchantNotificationJob(payload(3), "c3", { db, channels });
  assert.equal(sent[3]!.message.title, "Commande annulée");
});

test("NOT-02 : chaque route d'écriture de commande (client et administrateur) déclenche la confirmation", () => {
  for (const file of [
    "src/app/api/portal/orders/route.ts",
    "src/app/api/portal/orders/[id]/cancel/route.ts",
    "src/app/api/portal/orders/[id]/reorder/route.ts",
    "src/app/api/orders/[id]/route.ts",
    "src/app/api/orders/[id]/cancel/route.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /confirmOrderChange\(\{ companyId: guard\.actor\.companyId/, file);
  }
});

// ---------------------------------------------------------------------------
// NOT-03
// ---------------------------------------------------------------------------

function roundFixture() {
  const base = fixture();
  const { tables } = base;
  tables.merchant!.push(merchant("N1", "A"), merchant("N2", "A"), merchant("N3", "A"));
  tables.user!.push(user("v1", "A", "N1"), user("v2", "A", "N2"), user("v3", "A", "N3"));
  tables.order!.push(order("Q1", "A", "N1", "LOCKED"), order("Q2", "A", "N2", "LOCKED"), order("Q3", "A", "N3", "LOCKED"));
  tables.orderLine!.push(
    { id: "q1", companyId: "A", orderId: "Q1", productId: "p1", quantityOrdered: 2, quantityDelivered: null },
    { id: "q2", companyId: "A", orderId: "Q2", productId: "p1", quantityOrdered: 2, quantityDelivered: null },
  );
  tables.round = [{ id: "R", companyId: "A", date: day(D), slotId: "slot-A", name: "Tournée 1", status: "ASSIGNED", driverId: "driver1", startedAt: null, completedAt: null }];
  const stop = (id: string, orderId: string, sequence: number) => ({ id, companyId: "A", roundId: "R", orderId, sequence, status: "PENDING", deliveredAt: null, incidentCode: null, incidentComment: null, incidentPhotoPath: null, incidentAt: null });
  tables.stop = [stop("S1", "Q1", 1), stop("S2", "Q2", 2), stop("S3", "Q3", 3)];
  tables.driverLocation = [];
  return base;
}

const DRIVER = { companyId: "A", userId: "driver1" };
const NOW = new Date(`${D}T05:00:00Z`);

test("NOT-03 : démarrage → premier arrêt ; « Livré » → arrêt suivant, une seule fois, y compris au rejeu hors réseau", async () => {
  const { tables, db } = roundFixture();
  const kicked: string[][] = [];
  const kick = (ids: string[]) => kicked.push(ids);
  await startRound(DRIVER, "R", { now: NOW, db, kick });
  assert.deepEqual(jobsOf(tables, "not03:").map((job) => job.jobKey), ["not03:S1:v1"]);
  await startRound(DRIVER, "R", { now: NOW, db, kick }); // déjà démarrée : rien de plus
  assert.equal(jobsOf(tables, "not03:").length, 1);

  await markStopDelivered(DRIVER, "S1", { now: NOW, db, kick });
  assert.deepEqual(jobsOf(tables, "not03:").map((job) => job.jobKey), ["not03:S1:v1", "not03:S2:v2"]);
  // Rejeu de la file hors réseau (réponse perdue) : aucune nouvelle tâche.
  const replay = await markStopDelivered(DRIVER, "S1", { at: NOW.toISOString(), now: new Date(NOW.getTime() + 600_000), db, kick });
  assert.equal(replay.replayed, true);
  assert.equal(jobsOf(tables, "not03:").length, 2);

  // Problème chez S2 : le livreur repart, S3 est prévenu.
  await reportStopIncident(DRIVER, "S2", { code: "ABSENT", at: NOW.toISOString() }, { now: NOW, db, kick });
  assert.deepEqual(jobsOf(tables, "not03:").map((job) => job.jobKey).sort(), ["not03:S1:v1", "not03:S2:v2", "not03:S3:v3"]);
  assert.deepEqual(kicked.flat().length, 3);
});

test("NOT-03 : « Livré » hors réseau sans « Démarrer » prévient l'arrêt suivant ; un arrêt déjà livré n'est plus prévenu", async () => {
  const { tables, db } = roundFixture();
  // Hors réseau, « Livré » sur S1 arrive avant tout démarrage : la tournée démarre et S2 est prévenu.
  await markStopDelivered(DRIVER, "S1", { at: new Date(NOW.getTime() - 300_000).toISOString(), now: NOW, db, kick: () => undefined });
  assert.deepEqual(jobsOf(tables, "not03:").map((job) => job.jobKey), ["not03:S2:v2"]);
  const { sent, channels } = recorder();
  const payload = { kind: "STOP_APPROACH", companyId: "A", stopId: "S2", orderId: "Q2", userId: "v2" };
  assert.equal((await deliverMerchantNotificationJob(payload, "a1", { db, channels })).delivered, true);
  assert.equal(sent[0]!.message.title, "Livreur en approche");
  assert.match(sent[0]!.message.body, /C-Q2/);
  // Le livreur a déjà livré S2 quand la tâche est rejouée : rien n'est envoyé.
  await markStopDelivered(DRIVER, "S2", { now: NOW, db, kick: () => undefined });
  assert.equal((await deliverMerchantNotificationJob(payload, "a1", { db, channels })).delivered, false);
  // Ordre : livrer S3 en dernier ne prévient personne (plus d'arrêt restant).
  await markStopDelivered(DRIVER, "S3", { now: NOW, db, kick: () => undefined });
  assert.equal(jobsOf(tables, "not03:").length, 2);
});

// ---------------------------------------------------------------------------
// Isolation et canaux
// ---------------------------------------------------------------------------

test("NOTIF-1 isolation : aucune notification ne franchit la frontière d'entreprise ni de client", async () => {
  const { tables, db } = roundFixture();
  const { sent, channels } = recorder();
  // Compte de B avec l'entreprise A, ou l'inverse : introuvable.
  assert.equal((await deliverMerchantNotificationJob({ kind: "ORDER_CONFIRMATION", companyId: "A", orderId: "O2", userId: "uB", source: "MERCHANT", revision: 0 }, "x1", { db, channels })).delivered, false);
  assert.equal((await deliverMerchantNotificationJob({ kind: "ORDER_CONFIRMATION", companyId: "B", orderId: "O2", userId: "uB", source: "MERCHANT", revision: 0 }, "x2", { db, channels })).delivered, false);
  // Compte d'un autre client de la même entreprise : la commande n'est pas la sienne.
  assert.equal((await deliverMerchantNotificationJob({ kind: "ORDER_CONFIRMATION", companyId: "A", orderId: "O2", userId: "u1", source: "MERCHANT", revision: 0 }, "x3", { db, channels })).delivered, false);
  assert.equal((await deliverMerchantNotificationJob({ kind: "STOP_APPROACH", companyId: "A", stopId: "S1", orderId: "Q1", userId: "u1" }, "x4", { db, channels })).delivered, false);
  assert.equal(sent.length, 0);
  // Tournée de A vue depuis B : aucun arrêt.
  assert.deepEqual(await queueStopApproach(db, { companyId: "B", roundId: "R" }), []);
  // Confirmation d'une commande de A demandée pour le client de B : destinataires de B seulement… et aucun.
  await queueOrderConfirmation({ companyId: "B", orderId: "O2", merchantId: "M2", source: "MERCHANT" }, { db });
  assert.equal(jobsOf(tables, "not02:").length, 0);
});

test("NOTIF-1 canaux : e-mail non configuré → notification dans l'application puis tâche « ignorée » ; canal natif ajoutable", async () => {
  const { db } = fixture();
  const { sent, channels } = recorder();
  const saved = process.env.EMAIL_DELIVERY_MODE;
  delete process.env.EMAIL_DELIVERY_MODE;
  try {
    await assert.rejects(
      deliverMerchantNotificationJob({ kind: "ORDER_CONFIRMATION", companyId: "A", orderId: "O2", userId: "u2", source: "MERCHANT", revision: 0 }, "e1", { db, channels: [...channels, emailChannel] }),
      (error: Error & { skipped?: boolean }) => error.message === "EMAIL_DISABLED" && error.skipped === true
    );
    assert.equal(sent.length, 1);
    // Copie par e-mail coupée par le client : pas d'erreur, rien à envoyer.
    const off = await emailChannel.deliver(sent[0]!.message, { userId: "u2", companyId: "A", email: "u2@exemple.test", emailCopy: false }, { eventKey: "e2", replayWindow: null });
    assert.equal(off, "off");
  } finally {
    if (saved === undefined) delete process.env.EMAIL_DELIVERY_MODE;
    else process.env.EMAIL_DELIVERY_MODE = saved;
  }
  // MOBILE-1 : le canal natif est ajouté par `native-push-channel.ts` sans toucher aux déclencheurs ;
  // un second enregistrement du même canal est ignoré.
  const pushed: string[] = [];
  const fakeNative = { id: "native_push" as const, deliver: async (message: { title: string }) => { pushed.push(message.title); return "sent" as const; } };
  registerNotificationChannel(fakeNative);
  assert.deepEqual(notificationChannels().map((channel) => channel.id), ["in_app", "email", "native_push"]);
  assert.notEqual(notificationChannels()[2], fakeNative, "le canal natif de MOBILE-1 reste en place");
  await dispatchNotification(sent[0]!.message, { userId: "u2", companyId: "A", email: null, emailCopy: false }, { eventKey: "e3", replayWindow: null }, [fakeNative]);
  assert.deepEqual(pushed, ["Commande validée"]);
});

test("NOT-01 déclenchement : route cron protégée par le secret, appelée par le workflow des 10 minutes", async () => {
  const workflow = readFileSync(".github/workflows/cron-lock-orders.yml", "utf8");
  assert.match(workflow, /cron: "\*\/10 \* \* \* \*"/);
  assert.match(workflow, /\/api\/cron\/order-reminders/);
  const route = readFileSync("src/app/api/cron/order-reminders/route.ts", "utf8");
  assert.match(route, /process\.env\.NODE_ENV === "production"/);
  const { GET } = await import("../src/app/api/cron/order-reminders/route");
  const saved = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "secret-de-test";
  try {
    assert.equal((await GET(new Request("http://x/api/cron/order-reminders"))).status, 401);
    assert.equal((await GET(new Request("http://x/api/cron/order-reminders", { headers: { authorization: "Bearer faux" } }))).status, 401);
  } finally {
    if (saved === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = saved;
  }
});
