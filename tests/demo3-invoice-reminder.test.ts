import assert from "node:assert/strict";
import test from "node:test";
import {
  INVOICE_REMINDER_COOLDOWN_HOURS,
  deliverInvoiceReminderJob,
  remindInvoice,
} from "../src/domains/invoice/invoice-reminder.service";
import { createInvoiceFakeDb, invoice, type FakeInvoice, type FakeReminder } from "./helpers/invoice-fake-db";

const NOW = new Date("2026-10-28T10:00:00.000Z");
const USERS = [
  { id: "client_a", companyId: "company_a", email: "client.a@example.test", firstName: "Studio", lastName: "Oberkampf" },
  { id: "client_b", companyId: "company_b", email: "client.b@example.test", firstName: "Autre", lastName: "Client" },
];
const COMPANIES = [
  { id: "company_a", name: "Coursiers A", settings: {} },
  { id: "company_b", name: "Coursiers B", settings: {} },
];

function setup(invoices: FakeInvoice[]) {
  const db = createInvoiceFakeDb({ invoices, users: USERS, companies: COMPANIES });
  const kicks: string[] = [];
  const remind = (overrides: Partial<Parameters<typeof remindInvoice>[0]> = {}) =>
    remindInvoice(
      { companyId: "company_a", invoiceId: "inv", userId: "admin_a", emailConfigured: true, now: NOW, ...overrides },
      { db: db as never, kick: (id) => kicks.push(id) }
    );
  return { db, kicks, remind };
}

test("DEMO-3 relance : délai anti-doublon de 24 heures", () => {
  assert.equal(INVOICE_REMINDER_COOLDOWN_HOURS, 24);
});

test("DEMO-3 relance : une facture en attente est relancée, tracée et mise en file d'envoi", async () => {
  const { db, kicks, remind } = setup([invoice({ id: "inv" })]);

  const result = await remind();

  assert.equal(result?.duplicate, false);
  assert.equal(result?.reminder.result, "QUEUED");
  assert.equal(result?.reminder.channel, "EMAIL");
  assert.equal(db.reminders.length, 1);
  assert.equal(db.reminders[0]!.sentById, "admin_a", "qui");
  assert.ok(db.reminders[0]!.createdAt instanceof Date, "quand");
  assert.equal(db.jobs.length, 1);
  const job = db.jobs[0]!;
  assert.equal(job.type, "CLIENT_NOTIFICATION");
  assert.equal(job.jobKey, `client-notification:invoice-reminder:${db.reminders[0]!.id}`);
  assert.deepEqual(job.payload, { kind: "INVOICE_REMINDER", reminderId: db.reminders[0]!.id, companyId: "company_a" }, "aucune donnée personnelle dans la tâche");
  assert.equal(db.reminders[0]!.operationJobId, job.id);
  assert.deepEqual(kicks, [job.id]);
  assert.ok(db.log.some((line) => line.startsWith("lock:") && line.includes("FOR UPDATE")), "facture verrouillée");
});

test("DEMO-3 relance : une facture en retard se relance aussi", async () => {
  const { remind } = setup([invoice({ id: "inv", status: "OVERDUE" })]);
  assert.equal((await remind())?.reminder.result, "QUEUED");
});

test("DEMO-3 relance : une deuxième relance sous 24 h rejoue la première sans nouvel envoi", async () => {
  const { db, kicks, remind } = setup([invoice({ id: "inv" })]);
  const first = await remind();
  const second = await remind({ now: new Date(NOW.getTime() + 60 * 60 * 1000) });

  assert.equal(second?.duplicate, true);
  assert.equal(second?.reminder.id, first?.reminder.id);
  assert.equal(db.reminders.length, 1);
  assert.equal(db.jobs.length, 1);
  assert.equal(kicks.length, 1);
});

test("DEMO-3 relance : deux clics simultanés ne créent qu'une relance", async () => {
  const { db, kicks, remind } = setup([invoice({ id: "inv" })]);
  const results = await Promise.all([remind(), remind()]);

  assert.deepEqual(results.map((result) => result?.duplicate).sort(), [false, true]);
  assert.equal(db.reminders.length, 1);
  assert.equal(kicks.length, 1);
});

test("DEMO-3 relance : après 24 h, une nouvelle relance est possible", async () => {
  const { db, remind } = setup([invoice({ id: "inv" })]);
  await remind();
  const later = await remind({ now: new Date(NOW.getTime() + 25 * 60 * 60 * 1000) });
  assert.equal(later?.duplicate, false);
  assert.equal(db.reminders.length, 2);
});

test("DEMO-3 relance : un envoi précédent en échec définitif ne bloque pas une nouvelle relance", async () => {
  const { db, remind } = setup([invoice({ id: "inv" })]);
  await remind();
  db.jobs[0]!.status = "FAILED";
  const retry = await remind();
  assert.equal(retry?.duplicate, false);
  assert.equal(db.reminders.length, 2);
});

test("DEMO-3 relance : e-mail non configuré, relance tracée « non envoyée » sans erreur ni tâche", async () => {
  const { db, kicks, remind } = setup([invoice({ id: "inv" })]);

  const result = await remind({ emailConfigured: false });

  assert.equal(result?.duplicate, false);
  assert.equal(result?.reminder.result, "NOT_SENT_EMAIL_NOT_CONFIGURED");
  assert.equal(db.jobs.length, 0);
  assert.deepEqual(kicks, []);
  // Une tentative non envoyée ne bloque pas une vraie relance une fois l'e-mail configuré.
  assert.equal((await remind())?.reminder.result, "QUEUED");
});

test("DEMO-3 relance : client sans adresse e-mail ou supprimé, relance tracée sans destinataire", async () => {
  for (const customerId of [null, "client_b"]) {
    const { db, remind } = setup([invoice({ id: "inv", customerId })]);
    const result = await remind();
    assert.equal(result?.reminder.result, "NOT_SENT_NO_RECIPIENT", `client ${customerId}`);
    assert.equal(db.jobs.length, 0);
  }
  const { db, remind } = setup([invoice({ id: "inv" })]);
  (db as unknown as { invoices: FakeInvoice[] }).invoices[0]!.customerId = "client_empty";
  USERS.push({ id: "client_empty", companyId: "company_a", email: " ", firstName: "Sans", lastName: "Adresse" });
  try {
    assert.equal((await remind())?.reminder.result, "NOT_SENT_NO_RECIPIENT");
  } finally {
    USERS.pop();
  }
});

test("DEMO-3 relance : facture payée, annulée ou brouillon non relançable", async () => {
  for (const status of ["PAID", "CANCELLED", "DRAFT"] as const) {
    const { db, kicks, remind } = setup([invoice({ id: "inv", status })]);
    await assert.rejects(remind(), /INVOICE_NOT_REMINDABLE/, status);
    assert.equal(db.reminders.length, 0);
    assert.equal(kicks.length, 0);
  }
});

test("DEMO-3 relance : la facture d'une autre entreprise est introuvable et rien n'est tracé", async () => {
  const { db, remind } = setup([invoice({ id: "inv", companyId: "company_b", customerId: "client_b" })]);
  assert.equal(await remind(), null);
  assert.equal(db.reminders.length, 0);
});

function deliverySetup(overrides: Partial<FakeInvoice> = {}, companyName = "Coursiers A", others: FakeReminder[] = []) {
  const db = createInvoiceFakeDb({
    invoices: [invoice({ id: "inv", status: "OVERDUE", amount: 45, reference: "FAC-1027", dueDate: new Date("2026-10-16T09:00:00.000Z"), ...overrides })],
    users: USERS,
    companies: [{ id: "company_a", name: companyName, settings: {} }],
    reminders: [{ id: "rem_1", invoiceId: "inv", companyId: "company_a", sentById: "admin_a", channel: "EMAIL", result: "QUEUED", operationJobId: "job_1", completedAt: null, createdAt: NOW }, ...others],
  });
  const sent: Array<{ to: string; subject: string; text: string; idempotencyKey: string }> = [];
  const prefs = { emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true };
  const deps = {
    db: db as never,
    now: NOW,
    appUrl: "https://app.example.test/",
    getClientSettings: async () => prefs,
    send: async (input: { to: string; subject: string; text: string; idempotencyKey: string }) => {
      sent.push(input);
      return { status: "sent" as const };
    },
  };
  const deliver = (payload: Record<string, unknown> = { kind: "INVOICE_REMINDER", reminderId: "rem_1", companyId: "company_a" }) =>
    deliverInvoiceReminderJob(payload as never, "client-notification:invoice-reminder:rem_1", deps);
  return { db, sent, prefs, deps, deliver };
}

test("DEMO-3 relance (envoi) : l'e-mail part une fois, avec montant, retard et lien portail", async () => {
  const { db, sent, deliver } = deliverySetup();

  await deliver();

  assert.equal(sent.length, 1);
  assert.equal(sent[0]!.to, "client.a@example.test");
  assert.equal(sent[0]!.subject, "Rappel : facture FAC-1027");
  assert.equal(sent[0]!.idempotencyKey, "client-notification:invoice-reminder:rem_1");
  assert.match(sent[0]!.text, /FAC-1027/);
  assert.match(sent[0]!.text, /45,00\s€/);
  assert.match(sent[0]!.text, /Coursiers A/);
  assert.match(sent[0]!.text, /en retard de 12 jours/);
  assert.match(sent[0]!.text, /https:\/\/app\.example\.test\/portal\/invoices\/inv/);
  assert.equal(db.reminders[0]!.result, "SENT");
  assert.ok(db.reminders[0]!.completedAt instanceof Date);
});

test("DEMO-3 relance (envoi) : un rejeu de la tâche n'envoie pas de second e-mail", async () => {
  const { sent, deliver } = deliverySetup();
  await deliver();
  await deliver();
  assert.equal(sent.length, 1);
});

test("DEMO-3 relance (envoi) : facture réglée entre le clic et l'envoi, rien ne part", async () => {
  const { db, sent, deliver } = deliverySetup({ status: "PAID" });
  await deliver();
  assert.equal(sent.length, 0);
  assert.equal(db.reminders[0]!.result, "NOT_SENT_INVOICE_SETTLED");
});

test("DEMO-3 relance (envoi) : préférences du client respectées", async () => {
  for (const key of ["emailNotifications", "invoiceAlerts"] as const) {
    const { db, sent, prefs, deliver } = deliverySetup();
    prefs[key] = false;
    await deliver();
    assert.equal(sent.length, 0, key);
    assert.equal(db.reminders[0]!.result, "NOT_SENT_CLIENT_PREFERENCES");
  }
});

test("DEMO-3 relance (envoi) : e-mail désactivé au moment de l'envoi, trace « non configuré »", async () => {
  const { db, deps, deliver } = deliverySetup();
  deps.send = async () => ({ status: "disabled" as const }) as never;
  await deliver();
  assert.equal(db.reminders[0]!.result, "NOT_SENT_EMAIL_NOT_CONFIGURED");
});

test("DEMO-3 relance (envoi) : une panne du fournisseur est rejouée par la tâche durable", async () => {
  const { db, deps, deliver } = deliverySetup();
  deps.send = async () => { throw new Error("EMAIL_PROVIDER_HTTP_503"); };
  await assert.rejects(deliver(), /EMAIL_PROVIDER_HTTP_503/);
  assert.equal(db.reminders[0]!.result, "QUEUED", "reste en file pour le rejeu");
});

test("DEMO-3 relance (envoi) : aucune injection d'en-tête par la référence ou le nom d'entreprise", async () => {
  const { sent, deliver } = deliverySetup({ reference: "FAC\r\nBcc: pirate@example.test" }, "Coursiers\nBcc: pirate@example.test");
  await deliver();
  assert.doesNotMatch(sent[0]!.subject, /[\r\n]/);
  assert.doesNotMatch(sent[0]!.text, /Coursiers\n/);
});

test("DEMO-3 relance (envoi) : une tâche d'une autre entreprise ne lit rien et n'envoie rien", async () => {
  const { sent, deliver } = deliverySetup();
  await deliver({ kind: "INVOICE_REMINDER", reminderId: "rem_1", companyId: "company_b" });
  assert.equal(sent.length, 0);
  await assert.rejects(deliver({ kind: "INVOICE_REMINDER" }), /INVOICE_REMINDER_PAYLOAD_INVALID/);
});

test("DEMO-3 relance : clics répétés sans e-mail configuré, une seule trace « non envoyée » par jour", async () => {
  const { db, remind } = setup([invoice({ id: "inv" })]);
  const first = await remind({ emailConfigured: false });
  const second = await remind({ emailConfigured: false });
  assert.equal(second?.duplicate, true);
  assert.equal(second?.reminder.id, first?.reminder.id);
  assert.equal(db.reminders.length, 1);
  assert.equal("sentById" in (second?.reminder ?? {}), false, "identifiant interne non exposé");
});

const otherReminder = (overrides: Partial<FakeReminder>): FakeReminder => ({
  id: "rem_other", invoiceId: "inv", companyId: "company_a", sentById: "admin_a", channel: "EMAIL",
  result: "QUEUED", operationJobId: null, completedAt: null, createdAt: NOW, ...overrides,
});

test("DEMO-3 relance (envoi) : une relance en échec relancée par l'exploitation n'envoie rien si une plus récente existe", async () => {
  const later = otherReminder({ id: "rem_2", result: "SENT", createdAt: new Date(NOW.getTime() + 60_000), completedAt: new Date(NOW.getTime() + 61_000) });
  const { db, sent, deliver } = deliverySetup({}, "Coursiers A", [later]);
  await deliver();
  assert.equal(sent.length, 0);
  assert.equal(db.reminders.find((row) => row.id === "rem_1")?.result, "SKIPPED_SUPERSEDED");
});

test("DEMO-3 relance (envoi) : rien ne part si une relance a déjà été envoyée dans les 24 h", async () => {
  const earlier = otherReminder({ id: "rem_0", result: "SENT", createdAt: new Date(NOW.getTime() - 3 * 3_600_000), completedAt: new Date(NOW.getTime() - 3 * 3_600_000) });
  const { db, sent, deliver } = deliverySetup({}, "Coursiers A", [earlier]);
  await deliver();
  assert.equal(sent.length, 0);
  assert.equal(db.reminders.find((row) => row.id === "rem_1")?.result, "SKIPPED_SUPERSEDED");
});

test("DEMO-3 relance (envoi) : une relance envoyée il y a plus de 24 h ne bloque pas l'envoi", async () => {
  const old = otherReminder({ id: "rem_0", result: "SENT", createdAt: new Date(NOW.getTime() - 30 * 3_600_000), completedAt: new Date(NOW.getTime() - 30 * 3_600_000) });
  const { sent, deliver } = deliverySetup({}, "Coursiers A", [old]);
  await deliver();
  assert.equal(sent.length, 1);
});
