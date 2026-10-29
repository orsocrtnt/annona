import assert from "node:assert/strict";
import test from "node:test";
import { buildEinvoicingBody, evaluateEinvoicingForm } from "../src/features/back-office/einvoicing-form";
import { SUGGESTED_VAT_EXEMPTION_REASON } from "../src/domains/invoice/facturx/facturx-readiness";

const full = (): Record<string, string> => ({
  legalName: "Coursiers SAS", siren: "732829320", siret: "", billingAddress: "12 rue X", billingPostalCode: "75011", billingCity: "Paris", country: "FR",
  vatNumber: "", taxRegistrationId: "", legalForm: "", shareCapital: "", rcs: "", iban: "", bic: "", paymentTermsText: "",
  latePenaltyText: "Trois fois le taux légal.", earlyPaymentDiscountText: "Pas d'escompte.", vatExemptionReason: "TVA non applicable, art. 293 B du CGI",
});

test("formulaire complet : aucune erreur, même activé", () => {
  const e = evaluateEinvoicingForm(full(), true, true);
  assert.deepEqual(e.errors, {});
  assert.deepEqual(e.missing, []);
});

for (const [field, label] of [["siren", "SIREN"], ["billingAddress", "rue"], ["billingPostalCode", "code postal"], ["billingCity", "ville"], ["latePenaltyText", "pénalités"], ["earlyPaymentDiscountText", "escompte"]] as const) {
  test(`champ manquant (${label}) : message sur ${field} si bloquant, simple signalement sinon`, () => {
    const values = { ...full(), [field]: "  " };
    const blocking = evaluateEinvoicingForm(values, true, true);
    assert.ok(blocking.errors[field], "message par champ");
    assert.deepEqual(blocking.missing.map((m) => m.field), [field]);
    const idle = evaluateEinvoicingForm(values, false, false);
    assert.equal(idle.errors[field], undefined, "non bloqué");
    assert.deepEqual(idle.missing.map((m) => m.field), [field], "mais le manque est listé");
  });
}

test("IBAN sans BIC : non bloquant ; format invalide signalé même sans blocage", () => {
  const values = { ...full(), iban: "FR7630006000011234567890189" };
  assert.equal(evaluateEinvoicingForm(values, true, true).errors.bic, undefined);
  const badIban = evaluateEinvoicingForm({ ...full(), iban: "FR7630006000011234567890188", bic: "AGRIFRPP" }, false, false);
  assert.ok(badIban.errors.iban);
  assert.ok(evaluateEinvoicingForm({ ...full(), bic: "XX" }, false, false).errors.bic);
});

test("la mention 293 B est une proposition : jamais ajoutée au corps envoyé", () => {
  const values = { ...full(), vatExemptionReason: "" };
  assert.equal(buildEinvoicingBody(values, false).einvoicing.vatExemptionReason, "");
  assert.match(SUGGESTED_VAT_EXEMPTION_REASON, /293 B/);
});

test("corps envoyé : activation transmise seulement si cochée, pays FR par défaut", () => {
  assert.equal(buildEinvoicingBody(full(), false).einvoicing.enabled, false, "la case décochée est envoyée : le serveur ne la devine pas");
  assert.equal(buildEinvoicingBody({ ...full(), country: "" }, true).einvoicing.enabled, true);
  assert.equal(buildEinvoicingBody({ ...full(), country: "" }, true).identity.country, "FR");
});

test("exonération / n° de TVA : avertissements non bloquants dans le formulaire, même activé", () => {
  const noReason = evaluateEinvoicingForm({ ...full(), vatNumber: "FR44732829320", vatExemptionReason: "" }, true, true);
  assert.deepEqual(noReason.errors, {});
  assert.deepEqual(noReason.advisories.map((a) => a.field), ["vatExemptionReason"]);
  const noVat = evaluateEinvoicingForm(full(), true, true);
  assert.deepEqual(noVat.errors, {});
  assert.deepEqual(noVat.advisories.map((a) => a.field), ["vatNumber"]);
});
