import assert from "node:assert/strict";
import test from "node:test";
import {
  INVOICE_REMINDER_SENDING_TTL_MINUTES,
  deliverInvoiceReminderJob,
  reminderBlocksNewOne,
  remindInvoice,
} from "../src/domains/invoice/invoice-reminder.service";
import { emailSendOutcome } from "../src/lib/email/transactional-email";
import { createInvoiceFakeDb, invoice, type FakeInvoice, type FakeReminder } from "./helpers/invoice-fake-db";

// C1 : réservation d'envoi par facture. Une seule relance peut être en cours d'envoi (SENDING)
// ou envoyée dans les 24 h ; la création (bouton) et l'envoi (tâche) prennent le même verrou.
const NOW = new Date("2026-10-28T10:00:00.000Z");
const HOUR = 3_600_000;
const USERS = [{ id: "client_a", companyId: "company_a", email: "client.a@example.test", firstName: "Studio", lastName: "Oberkampf" }];
const KEY = "client-notification:invoice-reminder:r1";

function setup(r1: Partial<FakeReminder> = {}, invoiceOverrides: Partial<FakeInvoice> = {}) {
  const db = createInvoiceFakeDb({
    invoices: [invoice({ id: "inv", status: "OVERDUE", ...invoiceOverrides })],
    users: USERS,
    companies: [{ id: "company_a", name: "Coursiers A", settings: {} }],
    // R1 : ancienne relance, créée il y a plus de 24 h, remise en file par l'exploitation.
    reminders: [{
      id: "r1", invoiceId: "inv", companyId: "company_a", sentById: "admin_a", channel: "EMAIL",
      result: "QUEUED", operationJobId: "job_1", completedAt: null, createdAt: new Date(NOW.getTime() - 30 * HOUR), ...r1,
    }],
  });
  const sent: Array<{ to: string; idempotencyKey: string }> = [];
  const hooks: { duringSend?: () => Promise<void> } = {};
  const deps = {
    db: db as never,
    now: NOW,
    appUrl: "https://app.example.test",
    getClientSettings: async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true }),
    send: async (input: { to: string; subject: string; text: string; idempotencyKey: string }) => {
      sent.push({ to: input.to, idempotencyKey: input.idempotencyKey });
      const hook = hooks.duringSend;
      hooks.duringSend = undefined;
      await hook?.();
      return { status: "sent" as const };
    },
  };
  const deliver = (reminderId = "r1", eventKey = `client-notification:invoice-reminder:${reminderId}`) =>
    deliverInvoiceReminderJob({ kind: "INVOICE_REMINDER", reminderId, companyId: "company_a" } as never, eventKey, deps);
  const remind = () =>
    remindInvoice(
      { companyId: "company_a", invoiceId: "inv", userId: "admin_a", emailConfigured: true, now: NOW },
      { db: db as never, kick: () => undefined }
    );
  const r = (id: string) => db.reminders.find((row) => row.id === id);
  return { db, sent, hooks, deliver, remind, r };
}

test("C1 : délai d'expiration d'une réservation orpheline (5 min, aligné sur le bail des tâches)", () => {
  assert.equal(INVOICE_REMINDER_SENDING_TTL_MINUTES, 5);
});

test("C1 : entrelacement exact — clic « Relancer » pendant l'envoi de R1, au plus un e-mail", async () => {
  const { db, sent, hooks, deliver, remind, r } = setup();
  let click: Awaited<ReturnType<typeof remind>> = null;
  // R1 a passé ses contrôles, son e-mail est en cours : l'administrateur clique « Relancer ».
  hooks.duringSend = async () => {
    click = await remind();
    if (click && !click.duplicate) await deliver(click.reminder.id);
  };

  await deliver();

  assert.equal(sent.length, 1, "au plus un e-mail");
  assert.equal(click!.duplicate, true, "le clic est refusé proprement");
  assert.equal(click!.reminder.id, "r1");
  assert.equal(click!.reminder.result, "SENDING");
  assert.equal(db.reminders.length, 1, "aucune relance R2 créée");
  assert.equal(r("r1")?.result, "SENT");
  assert.ok(db.log.some((line) => line.includes("pg_advisory_xact_lock") && line.includes("invoice-reminder:") && line.endsWith(":inv")), "verrou consultatif par facture, paramétré");
});

test("C1 : entrelacement inverse — R2 créée avant la réservation de R1, seule R2 part", async () => {
  const { sent, deliver, remind, r } = setup();
  const click = await remind();
  assert.equal(click?.duplicate, false);
  await deliver();
  await deliver(click!.reminder.id);
  assert.equal(sent.length, 1);
  assert.equal(r("r1")?.result, "SKIPPED_SUPERSEDED");
  assert.equal(r(click!.reminder.id)?.result, "SENT");
});

test("C1 : le bouton refuse une nouvelle relance tant qu'une relance est SENDING", async () => {
  const { db, remind } = setup({ result: "SENDING", completedAt: new Date(NOW.getTime() - 60_000) });
  const click = await remind();
  assert.equal(click?.duplicate, true);
  assert.equal(click?.reminder.result, "SENDING");
  assert.equal(db.reminders.length, 1);
  assert.equal(reminderBlocksNewOne({ result: "SENDING", createdAt: new Date(NOW.getTime() - 30 * HOUR), completedAt: new Date(NOW.getTime() - 60_000) }, NOW), true);
});

test("C1 : réservation encore valide — une autre exécution envoie, la tâche est rejouée plus tard sans envoi", async () => {
  const { sent, deliver, r } = setup({ result: "SENDING", completedAt: new Date(NOW.getTime() - 60_000) });
  await assert.rejects(deliver(), /INVOICE_REMINDER_SEND_IN_PROGRESS/);
  assert.equal(sent.length, 0);
  assert.equal(r("r1")?.result, "SENDING");
});

test("C1 : R1 orpheline expirée — reprise possible, avec la même clé d'idempotence fournisseur", async () => {
  const { sent, deliver, r } = setup({ result: "SENDING", completedAt: new Date(NOW.getTime() - (INVOICE_REMINDER_SENDING_TTL_MINUTES + 1) * 60_000) });
  // Même si la tâche est reprise sous une autre clé d'événement, la clé fournisseur reste celle de la relance.
  await deliver("r1", "reprise-apres-crash");
  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.idempotencyKey, KEY);
  assert.equal(r("r1")?.result, "SENT");
});

test("C1 : une autre relance réservée ou envoyée dans les 24 h bloque l'envoi", async () => {
  for (const other of [
    { result: "SENDING", completedAt: new Date(NOW.getTime() - 60_000) },
    { result: "SENT", completedAt: new Date(NOW.getTime() - 2 * HOUR) },
  ]) {
    const { db, sent, deliver, r } = setup();
    db.reminders.push({ id: "rem_0", invoiceId: "inv", companyId: "company_a", sentById: "admin_a", channel: "EMAIL", operationJobId: null, createdAt: new Date(NOW.getTime() - 40 * HOUR), ...other });
    await deliver();
    assert.equal(sent.length, 0, other.result);
    assert.equal(r("r1")?.result, "SKIPPED_SUPERSEDED", other.result);
  }
});

test("C1 : facture payée entre-temps, y compris pour une reprise orpheline — aucun envoi", async () => {
  for (const r1 of [{}, { result: "SENDING", completedAt: new Date(NOW.getTime() - 10 * 60_000) }]) {
    const { sent, deliver, r } = setup(r1, { status: "PAID" });
    await deliver();
    assert.equal(sent.length, 0);
    assert.equal(r("r1")?.result, "NOT_SENT_INVOICE_SETTLED");
  }
});

test("C1 : panne du fournisseur — la réservation est libérée (QUEUED) pour le rejeu, sans bloquer", async () => {
  const { db, deliver, r } = setup();
  const deps = { db: db as never, now: NOW, getClientSettings: async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true }) };
  await assert.rejects(
    deliverInvoiceReminderJob({ kind: "INVOICE_REMINDER", reminderId: "r1", companyId: "company_a" } as never, KEY, {
      ...deps, send: async () => { throw new Error("EMAIL_PROVIDER_HTTP_503"); },
    }),
    /EMAIL_PROVIDER_HTTP_503/
  );
  assert.equal(r("r1")?.result, "QUEUED");
  assert.equal(r("r1")?.completedAt, null);
  await deliver();
  assert.equal(r("r1")?.result, "SENT");
});

// C4 : issue d'envoi ambiguë. Le fournisseur accepte l'e-mail, mais la réponse se perd (expiration).
function lostResponse() {
  return Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
}

test("C4 : acceptation avec réponse perdue — R1 reste SENDING et un clic ne crée aucune R2", async () => {
  const { db, deliver, remind, r } = setup();
  const sentKeys: string[] = [];
  const deps = {
    db: db as never, now: NOW,
    getClientSettings: async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true }),
    send: async (input: { idempotencyKey: string }) => { sentKeys.push(input.idempotencyKey); throw lostResponse(); },
  };
  await assert.rejects(
    deliverInvoiceReminderJob({ kind: "INVOICE_REMINDER", reminderId: "r1", companyId: "company_a" } as never, KEY, deps),
    /timeout/
  );
  assert.equal(r("r1")?.result, "SENDING", "réservation gardée : l'e-mail est peut-être parti");
  assert.equal(r("r1")?.completedAt?.getTime(), NOW.getTime());

  const click = await remind();
  assert.equal(click?.duplicate, true);
  assert.equal(click?.reminder.result, "SENDING");
  assert.equal(db.reminders.length, 1, "aucune R2");
  // Rejeu de la tâche avant expiration : rien ne part.
  await assert.rejects(deliver(), /INVOICE_REMINDER_SEND_IN_PROGRESS/);
  assert.equal(sentKeys.length, 1);
  assert.equal(emailSendOutcome(lostResponse()), "unknown");
});

test("C4 : reprise après expiration de la réservation — même clé d'idempotence, puis SENT", async () => {
  const { db, sent, r } = setup();
  const settings = async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true });
  const payload = { kind: "INVOICE_REMINDER", reminderId: "r1", companyId: "company_a" } as never;
  const keys: string[] = [];
  await assert.rejects(deliverInvoiceReminderJob(payload, KEY, {
    db: db as never, now: NOW, getClientSettings: settings,
    send: async (input: { idempotencyKey: string }) => { keys.push(input.idempotencyKey); throw lostResponse(); },
  }));
  const later = new Date(NOW.getTime() + (INVOICE_REMINDER_SENDING_TTL_MINUTES + 1) * 60_000);
  await deliverInvoiceReminderJob(payload, "autre-cle-de-tache", {
    db: db as never, now: later, getClientSettings: settings,
    send: async (input: { idempotencyKey: string }) => { keys.push(input.idempotencyKey); return { status: "sent" }; },
  });
  assert.deepEqual(keys, [KEY, KEY], "le fournisseur déduplique : un seul e-mail");
  assert.equal(r("r1")?.result, "SENT");
  assert.equal(sent.length, 0);
});

test("C4 : refus 4xx certain — réservation libérée, une nouvelle relance est possible", async () => {
  const { db, remind, r } = setup();
  await assert.rejects(deliverInvoiceReminderJob({ kind: "INVOICE_REMINDER", reminderId: "r1", companyId: "company_a" } as never, KEY, {
    db: db as never, now: NOW,
    getClientSettings: async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true }),
    send: async () => { throw Object.assign(new Error("EMAIL_PROVIDER_HTTP_422"), { name: "Error" }); },
  }), /EMAIL_PROVIDER_HTTP_422/);
  assert.equal(r("r1")?.result, "QUEUED");
  assert.equal(r("r1")?.completedAt, null);
  const click = await remind();
  assert.equal(click?.duplicate, false, "R1 (créée il y a 30 h) ne bloque plus : nouvelle relance");
  assert.equal(db.reminders.length, 2);
});

