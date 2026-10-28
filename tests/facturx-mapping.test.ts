import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { generateFacturXXml } from "../src/domains/invoice/facturx/cii-generator";
import { buildFacturXPdf, facturXHttpResult } from "../src/domains/invoice/facturx/facturx-document";
import { mapInvoiceToFacturX, type FacturXSource } from "../src/domains/invoice/facturx/facturx-mapping";
import { companyClientWhere, facturXInvoiceWhere } from "../src/domains/invoice/facturx/facturx-scope";
import { generateInvoicePdf } from "../src/lib/pdf/invoice-pdf";
import {
  clientInvoiceIdentitySchema,
  companyEinvoicingUpdateSchema,
  einvoicingSettingsSchema,
  frenchVatNumberForSiren,
  isValidIban,
} from "../src/lib/validations/einvoicing";
import { xmlTexts, xmlWellFormednessErrors } from "./helpers/xml-wellformed";

// Entreprise et client fictifs.
function source(overrides: { invoice?: Partial<FacturXSource["invoice"]>; seller?: Partial<FacturXSource["seller"]>; einvoicing?: Partial<FacturXSource["einvoicing"]>; buyer?: Partial<FacturXSource["buyer"]> } = {}): FacturXSource {
  return {
    invoice: {
      reference: "FAC-2026-0042",
      status: "PENDING",
      createdAt: new Date("2026-10-27T09:00:00Z"),
      dueDate: new Date("2026-11-26T09:00:00Z"),
      amount: 30,
      lineItems: [
        { label: "Course Paris intra-muros", amount: 25, quantity: 1, sourceType: "ZONE", sourceId: "z1" },
        { label: "TVA (20%)", amount: 5, quantity: 1, sourceType: "VAT" },
      ],
      notes: null,
      orderReference: "CMD-72011242",
      ...overrides.invoice,
    },
    seller: {
      name: "Coursiers Fictifs",
      legalName: "Coursiers Fictifs SAS",
      siren: "732829320",
      siret: "73282932000074",
      email: "facturation@coursiers.test",
      billingAddress: "12 rue de l'Exemple",
      billingPostalCode: "75011",
      billingCity: "Paris",
      country: "FR",
      ...overrides.seller,
    },
    einvoicing: {
      vatNumber: "FR44732829320",
      legalForm: "SAS",
      shareCapital: "10 000 €",
      rcs: "RCS Paris 732 829 320",
      iban: "FR7630006000011234567890189",
      bic: "AGRIFRPP",
      paymentTermsText: undefined,
      latePenaltyText: "Pénalités de retard : trois fois le taux d'intérêt légal.",
      earlyPaymentDiscountText: "Pas d'escompte pour paiement anticipé.",
      vatExemptionReason: undefined,
      ...overrides.einvoicing,
    },
    buyer: {
      firstName: "Marie",
      lastName: "Client",
      email: "marie@client.test",
      identity: { companyName: "Client Démo SARL", siren: "552100554", vatNumber: "FR96552100554", address: "3 avenue Fictive", postalCode: "69002", city: "Lyon", countryCode: "FR" },
      defaultAddress: null,
      ...overrides.buyer,
    },
  };
}

const rules = (result: ReturnType<typeof mapInvoiceToFacturX>) => (result.ok ? [] : result.errors.map((e) => e.rule));

test("facture simple à 20 % : mapping complet, mentions PMD/PMT/AAB et totaux identiques au stockage", () => {
  const result = mapInvoiceToFacturX(source());
  assert.ok(result.ok, JSON.stringify(!result.ok && result.errors));
  assert.deepEqual(result.warnings, []);
  const xml = generateFacturXXml(result.invoice);
  assert.deepEqual(xmlWellFormednessErrors(xml), []);
  assert.deepEqual(xmlTexts(xml, "ram:GrandTotalAmount"), ["30.00"]);
  assert.deepEqual(xmlTexts(xml, "ram:SubjectCode"), ["PMD", "PMT", "AAB"]);
  assert.ok(xmlTexts(xml, "ram:Content").includes("Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €."));
  assert.deepEqual(xmlTexts(xml, "ram:Description"), ["SAS au capital de 10 000 € — RCS Paris 732 829 320", "Paiement au plus tard le 26/11/2026."]);
  assert.deepEqual(xmlTexts(xml, "ram:IssuerAssignedID"), ["CMD-72011242"]);
  assert.ok(xmlTexts(xml, "ram:Name").includes("Client Démo SARL"));
  assert.equal(result.invoice.lines.length, 1, "la ligne de TVA devient une ventilation, pas une ligne");
});

test("plusieurs lignes et quantités : arrondi au centime identique à buildInvoiceLineItems", () => {
  const result = mapInvoiceToFacturX(
    source({
      invoice: {
        amount: 47.6,
        lineItems: [
          { label: "Course express", amount: 12.35, quantity: 2, sourceType: "ZONE" },
          { label: "Attente", amount: 4.99, quantity: 3, sourceType: "FEE" },
          { label: "TVA (20%)", amount: 7.93, quantity: 1, sourceType: "VAT" },
        ],
      },
    })
  );
  assert.ok(result.ok);
  const xml = generateFacturXXml(result.invoice);
  assert.deepEqual(xmlTexts(xml, "ram:CalculatedAmount"), ["7.93"]);
  assert.deepEqual(xmlTexts(xml, "ram:GrandTotalAmount"), ["47.60"]);
});

test("taux réduit décimal (5,5 %) lu depuis le libellé de la ligne TVA", () => {
  const result = mapInvoiceToFacturX(
    source({ invoice: { amount: 13.19, lineItems: [{ label: "Repas", amount: 12.5, quantity: 1, sourceType: "CUSTOM" }, { label: "TVA (5.5%)", amount: 0.69, quantity: 1, sourceType: "VAT" }] } })
  );
  assert.ok(result.ok);
  assert.equal(result.invoice.lines[0]!.vatRate, 5.5);
});

test("incohérences refusées : TVA différente du taux, total différent des lignes, lignes illisibles", () => {
  const badVat = mapInvoiceToFacturX(source({ invoice: { amount: 30.01, lineItems: [{ label: "Course", amount: 25, quantity: 1, sourceType: "ZONE" }, { label: "TVA (20%)", amount: 5.01, quantity: 1, sourceType: "VAT" }] } }));
  assert.deepEqual(rules(badVat), ["TL-TVA"]);
  assert.deepEqual(rules(mapInvoiceToFacturX(source({ invoice: { amount: 31 } }))), ["TL-TOTAL"]);
  assert.ok(rules(mapInvoiceToFacturX(source({ invoice: { lineItems: "oops" } }))).includes("TL-LIGNES"));
  assert.ok(rules(mapInvoiceToFacturX(source({ invoice: { lineItems: [{ label: "x", amount: "10", quantity: 1 }] } }))).includes("TL-LIGNES"));
});

test("facture sans ligne de TVA : exonération avec motif (293 B → VATEX-FR-FRANCHISE), refusée sans motif", () => {
  const lineItems = [{ label: "Course", amount: 18, quantity: 1, sourceType: "ZONE" }];
  const exempt = mapInvoiceToFacturX(source({ invoice: { amount: 18, lineItems }, einvoicing: { vatExemptionReason: "TVA non applicable, art. 293 B du CGI" } }));
  assert.ok(exempt.ok);
  assert.deepEqual(exempt.invoice.vatExemptions.E, { reason: "TVA non applicable, art. 293 B du CGI", code: "VATEX-FR-FRANCHISE" });
  assert.match(generateFacturXXml(exempt.invoice), /<ram:CategoryCode>E<\/ram:CategoryCode>/);

  const missing = mapInvoiceToFacturX(source({ invoice: { amount: 18, lineItems } }));
  assert.ok(!missing.ok);
  const issue = missing.errors.find((e) => e.rule === "BR-E-10");
  assert.match(issue!.message, /Réglages › Facturation/);
});

test("données légales manquantes : refus avec messages clairs qui disent où compléter", () => {
  const result = mapInvoiceToFacturX(
    source({
      seller: { siren: null, billingAddress: null, billingPostalCode: null, billingCity: null },
      einvoicing: { vatNumber: undefined, latePenaltyText: undefined, earlyPaymentDiscountText: undefined },
      buyer: { identity: null, defaultAddress: null },
    })
  );
  assert.ok(!result.ok);
  const found = rules(result);
  for (const rule of ["TL-FR-SIREN", "TL-FR-PENALITES", "TL-FR-ESCOMPTE", "BR-08", "BR-S-02", "BR-10"]) assert.ok(found.includes(rule), rule);
  assert.match(result.errors.find((e) => e.rule === "BR-10")!.message, /Identité de facturation/);
  assert.match(result.errors.find((e) => e.rule === "TL-FR-SIREN")!.message, /SIREN de l'entreprise manquant/);
});

test("client sans identité de facturation : adresse par défaut et avertissement SIREN, sans blocage", () => {
  const result = mapInvoiceToFacturX(
    source({ buyer: { identity: null, defaultAddress: { address: "8 quai Imaginaire", postalCode: "33000", city: "Bordeaux" } }, einvoicing: { iban: undefined, bic: undefined } })
  );
  assert.ok(result.ok);
  assert.equal(result.invoice.buyer.name, "Marie Client");
  assert.deepEqual(result.invoice.buyer.address, { line1: "8 quai Imaginaire", postalCode: "33000", city: "Bordeaux", countryCode: "FR" });
  assert.deepEqual(result.warnings.map((w) => w.rule), ["TL-W-SIREN-CLIENT", "TL-W-IBAN"]);
  assert.equal(result.invoice.payment, undefined);
});

test("brouillon et facture annulée : pas de Factur-X", () => {
  assert.deepEqual(rules(mapInvoiceToFacturX(source({ invoice: { status: "DRAFT" } }))), ["TL-STATUT"]);
  assert.deepEqual(rules(mapInvoiceToFacturX(source({ invoice: { status: "CANCELLED" } }))), ["TL-STATUT"]);
  assert.ok(mapInvoiceToFacturX(source({ invoice: { status: "PAID" } })).ok);
  assert.ok(mapInvoiceToFacturX(source({ invoice: { status: "OVERDUE" } })).ok);
});

test("caractères spéciaux et accents dans les libellés, raisons sociales et notes", () => {
  const result = mapInvoiceToFacturX(
    source({
      invoice: {
        notes: "Livré à l'accueil — « bât. B » & 2e étage <code 12>",
        amount: 12,
        lineItems: [{ label: "Pli « urgent » & fragile <A4>", amount: 10, quantity: 1, sourceType: "CUSTOM" }, { label: "TVA (20%)", amount: 2, quantity: 1, sourceType: "VAT" }],
      },
      seller: { legalName: "Établissements Ñandú & Cie" },
    })
  );
  assert.ok(result.ok);
  const xml = generateFacturXXml(result.invoice);
  assert.deepEqual(xmlWellFormednessErrors(xml), []);
  assert.ok(xmlTexts(xml, "ram:Name").includes("Pli « urgent » & fragile <A4>"));
  assert.ok(xmlTexts(xml, "ram:Name").includes("Établissements Ñandú & Cie"));
  assert.ok(xmlTexts(xml, "ram:Content").includes("Livré à l'accueil — « bât. B » & 2e étage <code 12>"));
});

test("isolation : l'entreprise de la session est toujours imposée, le client aussi côté portail", () => {
  assert.deepEqual(facturXInvoiceWhere({ invoiceId: "inv", companyId: "company_a" }), { id: "inv", companyId: "company_a" });
  assert.deepEqual(facturXInvoiceWhere({ invoiceId: "inv", companyId: "company_a", customerId: "u1" }), { id: "inv", companyId: "company_a", customerId: "u1" });
  assert.throws(() => facturXInvoiceWhere({ invoiceId: "inv", companyId: "" }), /FACTURX_SCOPE_REQUIRED/);
  assert.throws(() => facturXInvoiceWhere({ invoiceId: "inv", companyId: "company_a", customerId: "" }), /FACTURX_SCOPE_REQUIRED/);
  assert.deepEqual(companyClientWhere("company_a", "c1"), { id: "c1", companyId: "company_a", role: { systemRole: "CLIENT" } });
  assert.throws(() => companyClientWhere("", "c1"), /CLIENT_SCOPE_REQUIRED/);
});

test("assemblage : refus sans générer de PDF ; succès avec XML embarqué ; réponses HTTP lisibles", async () => {
  let rendered = 0;
  const render = async () => {
    rendered += 1;
    return generateInvoicePdf({ reference: "FAC-2026-0042", status: "PENDING", createdAt: new Date("2026-10-27T09:00:00Z"), amount: 30, lineItems: [], company: { name: "Coursiers Fictifs" } });
  };
  const now = new Date("2026-10-28T10:00:00Z");
  const refused = await buildFacturXPdf({ source: source({ seller: { siren: null } }), renderClassicPdf: render, now });
  assert.ok(!refused.ok);
  assert.equal(rendered, 0);
  const staff = facturXHttpResult(refused, "FAC-2026-0042", "staff");
  assert.equal(staff.status, 422);
  assert.equal(staff.headers["Content-Type"], "text/plain; charset=utf-8");
  assert.match(String(staff.body), /SIREN de l'entreprise manquant/);
  assert.match(String(staff.body), /Le PDF classique de la facture reste téléchargeable/);
  const client = facturXHttpResult(refused, "FAC-2026-0042", "client");
  assert.doesNotMatch(String(client.body), /SIREN|TL-/, "le client ne voit pas le détail interne");
  assert.match(String(client.body), /Votre prestataire doit compléter/);
  const cancelled = await buildFacturXPdf({ source: source({ invoice: { status: "CANCELLED" } }), renderClassicPdf: render, now });
  assert.match(String(facturXHttpResult(cancelled, "FAC-2026-0042", "client").body), /Facture annulée/, "statut expliqué au client");

  const ok = await buildFacturXPdf({ source: source(), renderClassicPdf: render, now });
  assert.ok(ok.ok);
  const raw = Buffer.from(ok.pdf).toString("latin1");
  assert.match(raw, /\/AFRelationship \/Data/);
  const embedded = [...raw.matchAll(/\/Type \/EmbeddedFile[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)][0]![1]!;
  assert.equal(inflateSync(Buffer.from(embedded, "latin1")).toString("utf8"), ok.xml);
  const http = facturXHttpResult(ok, "FAC/2026 0042", "client");
  assert.equal(http.status, 200);
  assert.equal(http.headers["Content-Disposition"], 'attachment; filename="FAC_2026_0042-facturx.pdf"');
});

test("validation des réglages : TVA cohérente avec le SIREN, IBAN à clé valide, SIRET préfixé par le SIREN", () => {
  assert.equal(frenchVatNumberForSiren("732829320"), "FR44732829320");
  assert.ok(isValidIban("FR76 3000 6000 0112 3456 7890 189"));
  assert.ok(!isValidIban("FR7630006000011234567890188"));
  const base = {
    identity: { siren: "732829320", siret: "73282932000074", billingAddress: "12 rue de l'Exemple", billingPostalCode: "75011", billingCity: "Paris", country: "fr" },
    einvoicing: { vatNumber: "fr 44 732829320", iban: "FR76 3000 6000 0112 3456 7890 189" },
  };
  const parsed = companyEinvoicingUpdateSchema.parse(base);
  assert.equal(parsed.einvoicing.vatNumber, "FR44732829320");
  assert.equal(parsed.einvoicing.iban, "FR7630006000011234567890189");
  assert.equal(parsed.identity.country, "FR");
  assert.ok(!companyEinvoicingUpdateSchema.safeParse({ ...base, einvoicing: { vatNumber: "FR45732829320" } }).success);
  assert.ok(!companyEinvoicingUpdateSchema.safeParse({ ...base, identity: { ...base.identity, siret: "55210055400017" } }).success);
  assert.ok(!einvoicingSettingsSchema.safeParse({ iban: "FR7630006000011234567890188" }).success);
  // Champs vides → absents du JSON stocké.
  assert.equal(JSON.stringify(einvoicingSettingsSchema.parse({ legalForm: "  ", rcs: "" })), "{}");
  assert.ok(!clientInvoiceIdentitySchema.safeParse({ address: "3 avenue", postalCode: "69002", city: "Lyon", siren: "12345" }).success);
});
