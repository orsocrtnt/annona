import assert from "node:assert/strict";
import test from "node:test";
import { billingFailureMessage, CONFIG_MESSAGES, firstFieldMessage } from "../src/lib/config-messages";
import { facturXHttpResult } from "../src/domains/invoice/facturx/facturx-document";
import { POD_EVIDENCE_MESSAGES } from "../src/domains/delivery/pod-evidence";

test("paiement : service non configuré, fournisseur injoignable, autre cause", () => {
  assert.equal(billingFailureMessage(new Error("BILLING_SANDBOX_REQUIRED"), "x"), CONFIG_MESSAGES.PAYMENT_NOT_CONFIGURED);
  assert.equal(billingFailureMessage(new Error("BILLING_WEBHOOK_SECRET_REQUIRED"), "x"), CONFIG_MESSAGES.PAYMENT_NOT_CONFIGURED);
  assert.equal(billingFailureMessage(new Error("BILLING_PROVIDER_UNAVAILABLE"), "x"), CONFIG_MESSAGES.PAYMENT_PROVIDER_UNAVAILABLE);
  assert.equal(billingFailureMessage(new Error("autre"), "repli"), "repli");
  assert.equal(billingFailureMessage("pas une erreur", "repli"), "repli");
});

test("chaque message de configuration dit la cause, l'action, et ne révèle aucun détail interne", () => {
  for (const [key, message] of Object.entries(CONFIG_MESSAGES)) {
    assert.ok(message.length > 60, `${key} trop court pour porter cause et action`);
    assert.doesNotMatch(message, /STRIPE|RESEND|SUPABASE|OPENAI|ANTHROPIC|_KEY|_SECRET|process\.env|sk_|whsec/i, key);
  }
  assert.match(CONFIG_MESSAGES.INTAKE_NOT_CONFIGURED, /à la main/);
  assert.match(CONFIG_MESSAGES.INTAKE_DISABLED, /Activez/);
  assert.match(CONFIG_MESSAGES.INVITATION_EMAIL_NOT_CONFIGURED, /recréez l'invitation/);
  assert.match(CONFIG_MESSAGES.DISPATCH_FEATURE_NOT_IN_PLAN, /Abonnement/);
  assert.match(POD_EVIDENCE_MESSAGES.POD_SIGNATURE_REQUIRED, /faites signer/);
});

test("règles dispatch / preuve : champ nommé dans le refus, repli sinon", () => {
  assert.equal(
    firstFieldMessage({ fieldErrors: { gpsMaxDistanceKm: ["Maximum 100 km"] }, formErrors: [] }, { gpsMaxDistanceKm: "Distance maximale au retrait" }, "repli"),
    "Distance maximale au retrait : Maximum 100 km"
  );
  assert.equal(firstFieldMessage({ fieldErrors: {}, formErrors: ["Aucun paramètre à modifier"] }, {}, "repli"), "Aucun paramètre à modifier");
  assert.equal(firstFieldMessage({ fieldErrors: {}, formErrors: [] }, {}, "repli"), "repli");
});

test("Factur-X refusé : le back-office reçoit la liste avec lien direct vers chaque champ, le client un message sobre", () => {
  const errors = [
    { rule: "TL-FR-PENALITES", message: "Mention des pénalités de retard manquante." },
    { rule: "BR-E-10", message: "Motif d'exonération de TVA manquant." },
  ];
  const staff = facturXHttpResult({ ok: false, errors, warnings: [] } as never, "FAC-1", "staff");
  assert.equal(staff.status, 422);
  assert.match(String(staff.body), /\/settings\/billing#einvoicing-latePenaltyText/);
  assert.match(String(staff.body), /\/settings\/billing#einvoicing-vatExemptionReason/);
  const client = facturXHttpResult({ ok: false, errors, warnings: [] } as never, "FAC-1", "client");
  assert.doesNotMatch(String(client.body), /BR-E-10|TL-FR|settings|pénalités|exonération/);
  assert.match(String(client.body), /Contactez-le/);
});
