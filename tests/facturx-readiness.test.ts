import assert from "node:assert/strict";
import test from "node:test";
import { mapInvoiceToFacturX, type FacturXSource } from "../src/domains/invoice/facturx/facturx-mapping";
import { checkSellerAdvisories, checkSellerReadiness, RULE_FIELD, type ReadinessInput } from "../src/domains/invoice/facturx/facturx-readiness";

const complete = (): ReadinessInput => ({
  identity: { siren: "732829320", billingAddress: "12 rue de l'Exemple", billingPostalCode: "75011", billingCity: "Paris", country: "FR" },
  einvoicing: {
    vatNumber: "",
    latePenaltyText: "Pénalités : trois fois le taux légal.",
    earlyPaymentDiscountText: "Pas d'escompte.",
    vatExemptionReason: "TVA non applicable, art. 293 B du CGI",
    iban: "FR7630006000011234567890189",
    bic: "AGRIFRPP",
  },
});

function exportWithVat(input: ReadinessInput) {
  const base = exportWithSource(input);
  return mapInvoiceToFacturX({
    ...base,
    invoice: { ...base.invoice, lines: [{ label: "Course", quantity: 1, unitPriceCents: 2500, vatRateBasisPoints: 2000 }], subtotalCents: 2500, vatCents: 500, totalCents: 3000 },
  });
}

/** Facture sans TVA (catégorie E) : le cas franchise en base, le plus exigeant côté vendeur. */
function exportWithSource(input: ReadinessInput): FacturXSource {
  return {
    invoice: {
      reference: "FAC-1", status: "PENDING", createdAt: new Date("2026-10-27T09:00:00Z"), dueDate: new Date("2026-11-26T09:00:00Z"),
      lines: [{ label: "Course", quantity: 1, unitPriceCents: 2500, vatRateBasisPoints: 0 }], subtotalCents: 2500, vatCents: 0, totalCents: 2500,
      notes: null, orderReference: null,
    },
    seller: {
      name: "Coursiers", legalName: null, siren: input.identity.siren ?? null, siret: null, email: null,
      billingAddress: input.identity.billingAddress ?? null, billingPostalCode: input.identity.billingPostalCode ?? null,
      billingCity: input.identity.billingCity ?? null, country: input.identity.country ?? null,
    },
    einvoicing: {
      taxRegistrationId: undefined, legalForm: undefined, shareCapital: undefined, rcs: undefined, paymentTermsText: undefined,
      latePenaltyText: input.einvoicing.latePenaltyText || undefined,
      earlyPaymentDiscountText: input.einvoicing.earlyPaymentDiscountText || undefined,
      vatExemptionReason: input.einvoicing.vatExemptionReason || undefined,
      vatNumber: input.einvoicing.vatNumber || undefined,
      iban: input.einvoicing.iban || undefined,
      bic: input.einvoicing.bic || undefined,
    },
    buyer: { firstName: "M", lastName: "C", email: null, identity: null, defaultAddress: { address: "1 rue X", postalCode: "69001", city: "Lyon" } },
  };
}

function exportWith(input: ReadinessInput) {
  return mapInvoiceToFacturX(exportWithSource(input));
}

test("mentions complètes : aucun manque et l'export aboutit", () => {
  assert.deepEqual(checkSellerReadiness(complete()), []);
  const result = exportWith(complete());
  assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
});

const CASES: Array<[string, (i: ReadinessInput) => void, string]> = [
  ["SIREN", (i) => { i.identity.siren = ""; }, "siren"],
  ["rue", (i) => { i.identity.billingAddress = "  "; }, "billingAddress"],
  ["code postal", (i) => { i.identity.billingPostalCode = null; }, "billingPostalCode"],
  ["ville", (i) => { i.identity.billingCity = ""; }, "billingCity"],
  ["pénalités", (i) => { i.einvoicing.latePenaltyText = ""; }, "latePenaltyText"],
  ["escompte", (i) => { i.einvoicing.earlyPaymentDiscountText = " "; }, "earlyPaymentDiscountText"],
];

for (const [name, mutate, field] of CASES) {
  test(`champ manquant (${name}) : signalé par champ et refusé par l'export avec la même règle`, () => {
    const input = complete();
    mutate(input);
    const issues = checkSellerReadiness(input);
    assert.deepEqual(issues.map((i) => i.field), [field]);
    const exported = exportWith(input);
    assert.ok(!exported.ok);
    if (!exported.ok) assert.ok(exported.errors.some((e) => e.rule === issues[0]!.rule), `${issues[0]!.rule} attendu dans ${exported.errors.map((e) => e.rule)}`);
  });
}

test("TVA 20 % sans n° de TVA : manque bloquant (BR-S-02) et l'export de la facture avec TVA est refusé sur le même champ", () => {
  const input = { ...complete(), vatRate: 20 };
  input.einvoicing.vatNumber = "";
  const issues = checkSellerReadiness(input);
  assert.deepEqual(issues.map((i) => i.field), ["vatNumber"]);
  assert.equal(issues[0]!.rule, "BR-S-02");
  const withVat = exportWithVat(input);
  assert.ok(!withVat.ok);
  if (!withVat.ok) assert.ok(withVat.errors.some((e) => e.rule === issues[0]!.rule));
  assert.equal(RULE_FIELD["BR-S-02"], "vatNumber");
});

test("identifiant fiscal seul avec TVA : ni accepté ni avertissement levé, l'export le refuse", () => {
  const input = { ...complete(), vatRate: 20 };
  input.einvoicing.vatNumber = "";
  input.einvoicing.taxRegistrationId = "12345678901";
  assert.deepEqual(checkSellerReadiness(input).map((i) => i.field), ["vatNumber"]);
  assert.deepEqual(checkSellerAdvisories(input).map((a) => a.field), ["vatNumber"]);
  assert.deepEqual(checkSellerAdvisories({ einvoicing: input.einvoicing }).map((a) => a.field), ["vatNumber"]);
  const source = exportWithSource(input);
  const withVat = mapInvoiceToFacturX({
    ...source,
    einvoicing: { ...source.einvoicing, taxRegistrationId: "12345678901" },
    invoice: { ...source.invoice, lines: [{ label: "Course", quantity: 1, unitPriceCents: 2500, vatRateBasisPoints: 2000 }], subtotalCents: 2500, vatCents: 500, totalCents: 3000 },
  });
  assert.ok(!withVat.ok && withVat.errors.some((e) => e.rule === "BR-S-02"));
});

test("TVA 0 % sans motif d'exonération : manque bloquant (BR-E-10) ; avec le motif, plus rien ; le n° de TVA n'est pas exigé à 0 %", () => {
  const input = { ...complete(), vatRate: 0 };
  input.einvoicing.vatExemptionReason = "";
  const issues = checkSellerReadiness(input);
  assert.deepEqual(issues.map((i) => i.field), ["vatExemptionReason"]);
  const exported = exportWith(input);
  assert.ok(!exported.ok && exported.errors.some((e) => e.rule === issues[0]!.rule));
  assert.deepEqual(checkSellerAdvisories(input).map((a) => a.field), ["vatExemptionReason"]);
  input.einvoicing.vatExemptionReason = "TVA non applicable, art. 293 B du CGI";
  assert.deepEqual(checkSellerReadiness(input), []);
  assert.deepEqual(checkSellerAdvisories(input), []);
});

test("taux inconnu (export) : aucune règle de TVA ajoutée à la liste, les deux avertissements restent", () => {
  const input = complete();
  input.einvoicing.vatNumber = "";
  input.einvoicing.vatExemptionReason = "";
  assert.deepEqual(checkSellerReadiness(input), []);
  assert.deepEqual(checkSellerAdvisories(input).map((a) => a.field).sort(), ["vatExemptionReason", "vatNumber"]);
});

test("aucun avertissement quand tout est renseigné", () => {
  const input = complete();
  input.einvoicing.vatNumber = "FR44732829320";
  assert.deepEqual(checkSellerAdvisories({ ...input, vatRate: 20 }), []);
  assert.deepEqual(checkSellerAdvisories(input), []);
});

test("IBAN sans BIC : non bloquant (simple avertissement à l'export)", () => {
  const input = complete();
  input.einvoicing.bic = "";
  assert.deepEqual(checkSellerReadiness(input), []);
  const exported = exportWith(input);
  assert.ok(exported.ok && exported.warnings.some((w) => w.rule === "TL-W-BIC"));
});

test("sans IBAN : pas de virement, ni IBAN ni BIC exigés", () => {
  const input = complete();
  input.einvoicing.iban = "";
  input.einvoicing.bic = "";
  assert.deepEqual(checkSellerReadiness(input), []);
  assert.ok(exportWith(input).ok);
});

test("réglages hérités entièrement vides : tous les manques listés, sans exception", () => {
  const issues = checkSellerReadiness({ identity: {}, einvoicing: {} });
  assert.deepEqual(issues.map((i) => i.field).sort(), ["billingAddress", "billingCity", "billingPostalCode", "country", "earlyPaymentDiscountText", "latePenaltyText", "siren"]);
});
