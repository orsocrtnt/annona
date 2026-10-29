import assert from "node:assert/strict";
import test from "node:test";
import { mapInvoiceToFacturX, type FacturXSource } from "../src/domains/invoice/facturx/facturx-mapping";
import { checkSellerReadiness, type ReadinessInput } from "../src/domains/invoice/facturx/facturx-readiness";

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

/** Facture sans TVA (catégorie E) : le cas franchise en base, le plus exigeant côté vendeur. */
function exportWith(input: ReadinessInput) {
  const source: FacturXSource = {
    invoice: {
      reference: "FAC-1", status: "PENDING", createdAt: new Date("2026-10-27T09:00:00Z"), dueDate: new Date("2026-11-26T09:00:00Z"),
      amount: 25, lineItems: [{ label: "Course", amount: 25, quantity: 1, sourceType: "ZONE" }], notes: null, orderReference: null,
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
  return mapInvoiceToFacturX(source);
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
  ["motif d'exonération", (i) => { i.einvoicing.vatExemptionReason = ""; }, "vatExemptionReason"],
  ["BIC avec IBAN", (i) => { i.einvoicing.bic = ""; }, "bic"],
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

test("entreprise avec n° de TVA : le motif d'exonération n'est pas exigé à l'enregistrement", () => {
  const input = complete();
  input.einvoicing.vatNumber = "FR44732829320";
  input.einvoicing.vatExemptionReason = "";
  assert.deepEqual(checkSellerReadiness(input), []);
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
  assert.deepEqual(issues.map((i) => i.field).sort(), ["billingAddress", "billingCity", "billingPostalCode", "country", "earlyPaymentDiscountText", "latePenaltyText", "siren", "vatExemptionReason"]);
});
