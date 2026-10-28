import assert from "node:assert/strict";
import test from "node:test";
import {
  invoiceRowStatusLabel,
  reminderOutcomeMessage,
  reminderResultLabel,
} from "../src/features/back-office/company-payments-labels";
import { isInvoiceOutstanding } from "../src/domains/invoice/invoice-due";

test("DEMO-3 écran : statut affiché avec le nombre de jours de retard, comme la démo", () => {
  assert.equal(invoiceRowStatusLabel({ status: "OVERDUE", daysOverdue: 12 }), "En retard · 12 j");
  assert.equal(invoiceRowStatusLabel({ status: "OVERDUE", daysOverdue: 0 }), "En retard");
  assert.equal(invoiceRowStatusLabel({ status: "PENDING", daysOverdue: 0 }), "En attente");
  assert.equal(invoiceRowStatusLabel({ status: "PAID", daysOverdue: 0 }), "Payée");
});

test("DEMO-3 écran : chaque résultat de relance a un libellé et un ton", () => {
  const cases = {
    QUEUED: ["Relance en cours d'envoi", "success"],
    SENT: ["Relance envoyée", "success"],
    FAILED: ["Échec d'envoi de la relance", "error"],
    NOT_SENT_EMAIL_NOT_CONFIGURED: ["Relance non envoyée : e-mail non configuré", "warning"],
    NOT_SENT_NO_RECIPIENT: ["Relance non envoyée : client sans adresse e-mail", "warning"],
    NOT_SENT_CLIENT_PREFERENCES: ["Relance non envoyée : le client a désactivé ces e-mails", "warning"],
    NOT_SENT_INVOICE_SETTLED: ["Relance annulée : facture réglée entre-temps", "warning"],
    SKIPPED_SUPERSEDED: ["Relance non envoyée : remplacée par une relance plus récente", "warning"],
  } as const;
  for (const [result, [label, tone]] of Object.entries(cases)) {
    assert.deepEqual(reminderResultLabel(result), { label, tone }, result);
  }
  assert.deepEqual(reminderResultLabel("INCONNU"), { label: "Relance tracée", tone: "warning" });
});

test("DEMO-3 écran : message après clic, y compris doublon et e-mail non configuré", () => {
  assert.deepEqual(reminderOutcomeMessage({ duplicate: true, reminder: { result: "SENT" } }), {
    kind: "info",
    text: "Déjà relancée dans les dernières 24 h : aucune nouvelle relance envoyée.",
  });
  assert.deepEqual(reminderOutcomeMessage({ duplicate: false, reminder: { result: "QUEUED" } }), {
    kind: "success",
    text: "Relance envoyée au client.",
  });
  assert.deepEqual(reminderOutcomeMessage({ duplicate: false, reminder: { result: "NOT_SENT_EMAIL_NOT_CONFIGURED" } }), {
    kind: "warning",
    text: "Relance tracée, non envoyée : l'envoi d'e-mails n'est pas configuré.",
  });
  assert.deepEqual(reminderOutcomeMessage({ duplicate: false, reminder: { result: "NOT_SENT_NO_RECIPIENT" } }), {
    kind: "warning",
    text: "Relance tracée, non envoyée : le client n'a pas d'adresse e-mail.",
  });
});

test("DEMO-3 fiche commande : une facture en retard s'affiche comme émise (pas de nouveau formulaire)", () => {
  assert.equal(isInvoiceOutstanding("OVERDUE"), true);
});

test("DEMO-3 écran : une relance non envoyée rejouée n'est pas présentée comme « déjà relancée »", () => {
  assert.deepEqual(reminderOutcomeMessage({ duplicate: true, reminder: { result: "NOT_SENT_EMAIL_NOT_CONFIGURED" } }), {
    kind: "warning",
    text: "Relance déjà tracée, toujours non envoyée : e-mail non configuré.",
  });
  assert.deepEqual(reminderOutcomeMessage({ duplicate: true, reminder: { result: "NOT_SENT_NO_RECIPIENT" } }), {
    kind: "warning",
    text: "Relance déjà tracée, toujours non envoyée : client sans e-mail.",
  });
});

test("C1 écran : relance réservée (SENDING) affichée « en cours d'envoi », clic refusé avec un message clair", () => {
  assert.deepEqual(reminderResultLabel("SENDING"), { label: "Relance en cours d'envoi", tone: "success" });
  assert.deepEqual(reminderOutcomeMessage({ duplicate: true, reminder: { result: "SENDING" } }), {
    kind: "info",
    text: "Une relance est en cours d'envoi : aucune nouvelle relance envoyée.",
  });
});
