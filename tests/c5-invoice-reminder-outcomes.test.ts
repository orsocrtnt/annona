import assert from "node:assert/strict";
import test from "node:test";
import {
  deliverInvoiceReminderJob,
  effectiveReminderResult,
  reminderBlocksNewOne,
  remindInvoice,
} from "../src/domains/invoice/invoice-reminder.service";
import { sendTransactionalEmail } from "../src/lib/email/transactional-email";
import { createInvoiceFakeDb, invoice, type FakeReminder } from "./helpers/invoice-fake-db";

// C5 : issue de chaque réponse Resend sur une relance de facture, avec un fournisseur simulé qui
// applique le contrat documenté (https://resend.com/docs/dashboard/emails/idempotency-keys) :
// même clé + même contenu → réponse d'origine sans nouvel e-mail ; même clé + autre contenu → 409
// invalid_idempotent_request ; clé conservée 24 h. On compte les e-mails réellement reçus.
const MIN = 60_000;
const HOUR = 60 * MIN;
// 28 octobre 2026, 23 h 50 à Paris (UTC+1) : le changement de jour arrive 10 minutes plus tard.
const T0 = new Date("2026-10-28T22:50:00.000Z");
const KEY = "client-notification:invoice-reminder:r1";
const ENV = { EMAIL_DELIVERY_MODE: "live", RESEND_API_KEY: "test-key", MAIL_FROM: "TutelLiv <no-reply@example.test>" };
const SETTINGS = async () => ({ emailNotifications: true, smsNotifications: false, deliveryAlerts: true, invoiceAlerts: true });

type Scripted = { status: number; name?: string; accepted: boolean } | { timeout: true; accepted: boolean };

function fakeResend() {
  const accepted = new Map<string, { body: string; at: number }>();
  const calls: Array<{ key: string; body: string }> = [];
  const script: Scripted[] = [];
  let received = 0;
  let clock = T0.getTime();
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    const key = (init?.headers as Record<string, string>)["Idempotency-Key"]!;
    const body = String(init?.body);
    calls.push({ key, body });
    const known = accepted.get(key);
    if (known && clock - known.at < 24 * HOUR) {
      if (known.body !== body) return { ok: false, status: 409, text: async () => JSON.stringify({ statusCode: 409, message: "x", name: "invalid_idempotent_request" }) };
      return { ok: true, status: 200 };
    }
    const next = script.shift() ?? { status: 200, accepted: true };
    if (next.accepted) {
      accepted.set(key, { body, at: clock });
      received += 1;
    }
    if ("timeout" in next) throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    if (next.status === 200) return { ok: true, status: 200 };
    return { ok: false, status: next.status, text: async () => JSON.stringify({ statusCode: next.status, message: "x", name: next.name }) };
  };
  return {
    script, calls, fetcher,
    get received() { return received; },
    /** Le fournisseur a mémorisé sous cette clé une requête refusée, d'un autre contenu (rien n'est parti). */
    preRemember(key: string, body: string) { accepted.set(key, { body, at: clock }); },
    setClock(at: Date) { clock = at.getTime(); },
  };
}

function setup(r1: Partial<FakeReminder> = {}) {
  const db = createInvoiceFakeDb({
    invoices: [invoice({ id: "inv", status: "OVERDUE", dueDate: new Date("2026-10-20T10:00:00.000Z") })],
    users: [{ id: "client_a", companyId: "company_a", email: "client.a@example.test", firstName: "Studio", lastName: "Oberkampf" }],
    companies: [{ id: "company_a", name: "Coursiers A", settings: {} }],
    reminders: [{
      id: "r1", invoiceId: "inv", companyId: "company_a", sentById: "admin_a", channel: "EMAIL",
      result: "QUEUED", operationJobId: "job_1", completedAt: null, createdAt: T0, ...r1,
    }],
  });
  const resend = fakeResend();
  const deliver = (at: Date) => {
    resend.setClock(at);
    return deliverInvoiceReminderJob({ kind: "INVOICE_REMINDER", reminderId: "r1", companyId: "company_a" } as never, KEY, {
      db: db as never, now: at, appUrl: "https://app.example.test", getClientSettings: SETTINGS,
      send: (input) => sendTransactionalEmail(input, { env: ENV, now: at, fetcher: resend.fetcher }),
    });
  };
  const remind = (at: Date) =>
    remindInvoice({ companyId: "company_a", invoiceId: "inv", userId: "admin_a", emailConfigured: true, now: at }, { db: db as never, kick: () => undefined });
  const r1Row = () => db.reminders.find((row) => row.id === "r1")!;
  return { db, resend, deliver, remind, r1Row };
}

const settle = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as Error & { permanent?: boolean });

type Row = { label: string; script: Scripted; expect: "SENT" | "QUEUED" | "SENDING" | "FAILED" };
const TABLE: Row[] = [
  { label: "200", script: { status: 200, accepted: true }, expect: "SENT" },
  { label: "400 validation_error", script: { status: 400, name: "validation_error", accepted: false }, expect: "QUEUED" },
  { label: "409 concurrent_idempotent_requests", script: { status: 409, name: "concurrent_idempotent_requests", accepted: true }, expect: "SENDING" },
  // Sur une première tentative (invariant QUEUED : seules des requêtes refusées ont porté la clé) :
  // clé brûlée sans envoi → FAILED, nouvelle relance permise. Sur une reprise : voir plus bas.
  { label: "409 invalid_idempotent_request (1re tentative)", script: { status: 409, name: "invalid_idempotent_request", accepted: false }, expect: "FAILED" },
  { label: "422 missing_required_field", script: { status: 422, name: "missing_required_field", accepted: false }, expect: "QUEUED" },
  { label: "429 rate_limit_exceeded", script: { status: 429, name: "rate_limit_exceeded", accepted: false }, expect: "QUEUED" },
  // Pire cas pour une issue ambiguë : le fournisseur a accepté l'e-mail, la réponse ne le dit pas.
  { label: "500 application_error", script: { status: 500, name: "application_error", accepted: true }, expect: "SENDING" },
  { label: "expiration (réponse perdue)", script: { timeout: true, accepted: true }, expect: "SENDING" },
];

for (const row of TABLE) {
  test(`C5 : ${row.label} — issue de la relance, clic « Relancer », reprise à 6 min, au plus un e-mail`, async () => {
    const { db, resend, deliver, remind, r1Row } = setup();
    if (row.label.startsWith("409 invalid")) resend.preRemember(KEY, "contenu antérieur différent");
    resend.script.push(row.script);

    const first = await settle(deliver(T0));
    assert.equal(r1Row().result, row.expect, "résultat après la première tentative");
    if (row.expect === "SENT") assert.equal(first, null);
    else assert.ok(first, "la tâche échoue et sera rejouée (ou non) selon l'issue");
    if (row.expect === "QUEUED") assert.equal(r1Row().completedAt, null, "réservation rendue : rien n'est parti");
    if (row.expect === "SENDING") assert.equal(r1Row().completedAt?.getTime(), T0.getTime(), "réservation conservée");
    // Seule l'issue non confirmée est permanente (tâche FAILED, aucun nouvel essai).
    assert.equal(first?.permanent === true, row.expect === "FAILED");
    if (row.expect === "FAILED") {
      assert.equal(resend.received, 0, "rien n'est parti");
      assert.equal(await settle(deliver(new Date(T0.getTime() + 6 * MIN))), null, "terminal : rejeu sans effet");
      assert.equal(resend.calls.length, 1);
      // Double clic : une seule nouvelle relance R2 (nouvelle clé), la seconde est refusée.
      const clicks = await Promise.all([remind(new Date(T0.getTime() + 7 * MIN)), remind(new Date(T0.getTime() + 7 * MIN))]);
      assert.equal(clicks.filter((click) => click && !click.duplicate).length, 1);
      assert.equal(db.reminders.length, 2);
      return;
    }

    // Double clic administrateur juste après : jamais de seconde relance.
    const clicks = await Promise.all([remind(new Date(T0.getTime() + MIN)), remind(new Date(T0.getTime() + MIN))]);
    assert.ok(clicks.every((click) => click?.duplicate === true && click.reminder.id === "r1"), "aucune R2");
    assert.equal(db.reminders.length, 1);

    // Rejeu de la tâche à 1 min : la réservation SENDING est encore active, rien ne part, et la tâche
    // est replanifiée à l'expiration de la réservation sans consommer d'essai.
    if (row.expect === "SENDING") {
      const early = await settle(deliver(new Date(T0.getTime() + MIN))) as (Error & { deferUntil?: Date }) | null;
      assert.match(early!.message, /INVOICE_REMINDER_SEND_IN_PROGRESS/);
      assert.ok(early!.deferUntil && early!.deferUntil.getTime() > T0.getTime() + 5 * MIN);
    }

    // Reprise à 6 min (après le changement de jour à Paris) : même clé, même contenu.
    const resumed = await settle(deliver(new Date(T0.getTime() + 6 * MIN)));
    assert.equal(r1Row().result, "SENT", "après la reprise");
    assert.equal(resumed, null);
    assert.ok(resend.calls.every((call) => call.key === KEY), "une seule clé fournisseur");
    assert.equal(new Set(resend.calls.map((call) => call.body)).size, 1, "contenu identique à chaque tentative");
    assert.equal(resend.received, 1, "le client reçoit au plus un e-mail");
  });
}

test("C5 : 409 invalid_idempotent_request sur une REPRISE — SEND_UNCONFIRMED terminal, aucun renvoi, aucune R2", async () => {
  const { db, resend, deliver, remind, r1Row } = setup();
  resend.script.push({ timeout: true, accepted: true });
  await settle(deliver(T0));
  // Le contenu a changé entre-temps sous la même clé (ex. montant corrigé) : 409 invalid.
  db.invoices[0]!.amount = 99 as never;
  const error = await settle(deliver(new Date(T0.getTime() + 6 * MIN)));
  assert.match(error!.message, /EMAIL_PROVIDER_HTTP_409:invalid_idempotent_request/);
  assert.equal(error!.permanent, true);
  assert.equal(r1Row().result, "SEND_UNCONFIRMED");
  assert.equal(await settle(deliver(new Date(T0.getTime() + 20 * MIN))), null, "terminal");
  assert.equal(resend.calls.length, 2);
  assert.equal((await remind(new Date(T0.getTime() + 21 * MIN)))?.duplicate, true);
  assert.equal(db.reminders.length, 1);
  assert.equal(resend.received, 1);
});

test("C5 : reprise le lendemain (jour de Paris changé, +20 h) — contenu identique, toujours dédupliqué", async () => {
  const { resend, deliver, r1Row } = setup();
  resend.script.push({ timeout: true, accepted: true });
  await settle(deliver(T0));
  assert.equal(r1Row().result, "SENDING");
  // Retards à T0 (28 oct., échue le 20) : 8 jours ; le lendemain, un calcul à l'heure d'envoi dirait 9.
  assert.match(resend.calls[0]!.body, /en retard de 8 jours/);
  await deliver(new Date(T0.getTime() + 20 * HOUR));
  assert.equal(r1Row().result, "SENT");
  assert.equal(resend.calls.length, 2);
  assert.equal(resend.calls[1]!.body, resend.calls[0]!.body, "même contenu sous la même clé");
  assert.equal(resend.received, 1);
});

test("C5 : refus certain d'une REPRISE (429) — la réservation n'est pas rendue (la 1re tentative a pu partir)", async () => {
  // R1 SENDING : une première tentative à l'issue inconnue a eu lieu à T0.
  const { db, resend, deliver, remind, r1Row } = setup({ result: "SENDING", completedAt: T0 });
  resend.script.push({ status: 429, name: "rate_limit_exceeded", accepted: false });
  const error = await settle(deliver(new Date(T0.getTime() + 6 * MIN)));
  assert.match(error!.message, /EMAIL_PROVIDER_HTTP_429/);
  assert.notEqual(error!.permanent, true, "la tâche réessaiera, même clé");
  assert.equal(r1Row().result, "SENDING", "jamais QUEUED après une issue inconnue");
  assert.equal((await remind(new Date(T0.getTime() + 7 * MIN)))?.duplicate, true);
  assert.equal(db.reminders.length, 1);
  await deliver(new Date(T0.getTime() + 13 * MIN));
  assert.equal(r1Row().result, "SENT");
});

test("C5 : au-delà de 23 h après la création, une reprise ne rappelle jamais le fournisseur — SEND_UNCONFIRMED", async () => {
  const { db, resend, deliver, remind, r1Row } = setup();
  resend.script.push({ timeout: true, accepted: true });
  await settle(deliver(T0));
  const late = new Date(T0.getTime() + 23 * HOUR);
  const error = await settle(deliver(late));
  assert.equal(error!.message, "INVOICE_REMINDER_SEND_UNCONFIRMED:SEND_UNCONFIRMED");
  assert.equal(error!.permanent, true, "tâche FAILED avec lastError explicite, sans nouvel essai");
  assert.equal(r1Row().result, "SEND_UNCONFIRMED");
  assert.equal(resend.calls.length, 1, "aucun appel après la fenêtre");
  // Rejeu manuel de la tâche (« relancer les tâches en échec ») : état terminal, rien ne part.
  assert.equal(await settle(deliver(new Date(late.getTime() + HOUR))), null);
  assert.equal(resend.calls.length, 1);
  // Bouton : bloqué 24 h après le constat (T0 + 23 h), puis décision humaine (l'état reste affiché).
  assert.equal((await remind(new Date(T0.getTime() + 46 * HOUR)))?.duplicate, true);
  const after = await remind(new Date(T0.getTime() + 47 * HOUR + MIN));
  assert.equal(after?.duplicate, false, "après 24 h, l'administrateur peut décider d'une nouvelle relance");
  assert.equal(db.reminders.length, 2);
});

test("C5 : affichage — SENDING abandonnée (tâche épuisée ou réservation > 24 h) = « envoi non confirmé »", () => {
  const now = new Date(T0.getTime() + 2 * HOUR);
  const sending = { result: "SENDING", createdAt: T0, completedAt: new Date(T0.getTime() + 6 * MIN) };
  assert.equal(effectiveReminderResult({ ...sending, operationJob: { status: "PENDING" } }, now), "SENDING");
  assert.equal(effectiveReminderResult({ ...sending, operationJob: { status: "FAILED" } }, now), "SEND_UNCONFIRMED");
  assert.equal(reminderBlocksNewOne({ ...sending, operationJob: { status: "FAILED" } }, now), true, "toujours bloquante pendant 24 h");
  const dayLater = new Date(T0.getTime() + 25 * HOUR);
  assert.equal(effectiveReminderResult({ ...sending, operationJob: { status: "PENDING" } }, dayLater), "SEND_UNCONFIRMED");
  assert.equal(reminderBlocksNewOne(sending, dayLater), false);
  assert.equal(effectiveReminderResult({ result: "QUEUED", createdAt: T0, operationJob: { status: "FAILED" } }, now), "FAILED");
  assert.equal(reminderBlocksNewOne({ result: "SEND_UNCONFIRMED", createdAt: T0, completedAt: now }, now), true);
});
