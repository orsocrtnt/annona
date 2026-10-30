import assert from "node:assert/strict";
import test from "node:test";
import {
  checkFacturXInvoice,
  computeFacturXTotals,
  FacturXValidationError,
  generateFacturXXml,
} from "../src/domains/invoice/facturx/cii-generator";
import type { FacturXInvoice } from "../src/domains/invoice/facturx/facturx.types";
import { xmlElementOrder, xmlTexts, xmlWellFormednessErrors } from "./helpers/xml-wellformed";

// Données entièrement fictives (SIREN au format valide, sans correspondance réelle visée).
const seller: FacturXInvoice["seller"] = {
  name: "Coursiers Fictifs SAS",
  siren: "732829320",
  siret: "73282932000074",
  vatNumber: "FR44732829320",
  email: "facturation@coursiers.test",
  legalInfo: "SAS au capital de 10 000 € — RCS Paris 732 829 320",
  address: { line1: "12 rue de l'Exemple", postalCode: "75011", city: "Paris", countryCode: "FR" },
};
const buyer: FacturXInvoice["buyer"] = {
  name: "Client Démo SARL",
  siren: "552100554",
  email: "compta@client.test",
  address: { line1: "3 avenue Fictive", postalCode: "69002", city: "Lyon", countryCode: "FR" },
};

function invoice(overrides: Partial<FacturXInvoice> = {}): FacturXInvoice {
  return {
    number: "FAC-2026-0001",
    typeCode: "380",
    issueDate: new Date("2026-10-27T09:00:00Z"),
    dueDate: new Date("2026-11-26T09:00:00Z"),
    currency: "EUR",
    paymentTerms: "Paiement à 30 jours, au plus tard le 26/11/2026.",
    notes: [
      { subjectCode: "PMD", content: "Pénalités de retard : trois fois le taux d'intérêt légal." },
      { subjectCode: "PMT", content: "Indemnité forfaitaire pour frais de recouvrement : 40 €." },
      { subjectCode: "AAB", content: "Pas d'escompte pour paiement anticipé." },
    ],
    seller,
    buyer,
    sellerOrderReference: "CMD-72011242",
    lines: [{ id: "1", name: "Course Paris intra-muros", quantity: 1, unitPrice: 25, vatCategory: "S", vatRate: 20 }],
    vatExemptions: {},
    payment: { typeCode: "58", iban: "FR7630006000011234567890189", bic: "AGRIFRPP" },
    paymentReference: "FAC-2026-0001",
    ...overrides,
  };
}

const amount = (xml: string, element: string) => xmlTexts(xml, `ram:${element}`);

test("facture simple : XML CII bien formé, profil EN 16931 et totaux cohérents", () => {
  const xml = generateFacturXXml(invoice());
  assert.deepEqual(xmlWellFormednessErrors(xml), []);
  assert.match(xml, /<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"/);
  assert.deepEqual(amount(xml, "ID").slice(0, 2), ["urn:cen.eu:en16931:2017", "FAC-2026-0001"]);
  assert.deepEqual(amount(xml, "TypeCode").slice(0, 1), ["380"]);
  assert.match(xml, /<udt:DateTimeString format="102">20261027<\/udt:DateTimeString>/);
  assert.deepEqual(amount(xml, "LineTotalAmount"), ["25.00", "25.00"]);
  assert.deepEqual(amount(xml, "TaxBasisTotalAmount"), ["25.00"]);
  assert.match(xml, /<ram:TaxTotalAmount currencyID="EUR">5.00<\/ram:TaxTotalAmount>/);
  assert.deepEqual(amount(xml, "GrandTotalAmount"), ["30.00"]);
  assert.deepEqual(amount(xml, "DuePayableAmount"), ["30.00"]);
  assert.match(xml, /<ram:SpecifiedLegalOrganization>\s*<ram:ID schemeID="0002">732829320<\/ram:ID>/);
  assert.match(xml, /<ram:ID schemeID="VA">FR44732829320<\/ram:ID>/);
  assert.match(xml, /<ram:IBANID>FR7630006000011234567890189<\/ram:IBANID>/);
  assert.match(xml, /<ram:BilledQuantity unitCode="C62">1<\/ram:BilledQuantity>/);
});

test("l'ordre des blocs respecte la séquence du schéma CII D16B", () => {
  const xml = generateFacturXXml(invoice());
  const top = xmlElementOrder(xml, [
    "rsm:ExchangedDocumentContext",
    "rsm:ExchangedDocument",
    "rsm:SupplyChainTradeTransaction",
    "ram:IncludedSupplyChainTradeLineItem",
    "ram:ApplicableHeaderTradeAgreement",
    "ram:ApplicableHeaderTradeDelivery",
    "ram:ApplicableHeaderTradeSettlement",
  ]);
  assert.deepEqual(top, [
    "rsm:ExchangedDocumentContext",
    "rsm:ExchangedDocument",
    "rsm:SupplyChainTradeTransaction",
    "ram:IncludedSupplyChainTradeLineItem",
    "ram:ApplicableHeaderTradeAgreement",
    "ram:ApplicableHeaderTradeDelivery",
    "ram:ApplicableHeaderTradeSettlement",
  ]);
  const settlement = xml.slice(xml.indexOf("<ram:ApplicableHeaderTradeSettlement>"));
  assert.deepEqual(
    xmlElementOrder(settlement, [
      "ram:PaymentReference",
      "ram:InvoiceCurrencyCode",
      "ram:SpecifiedTradeSettlementPaymentMeans",
      "ram:ApplicableTradeTax",
      "ram:SpecifiedTradePaymentTerms",
      "ram:SpecifiedTradeSettlementHeaderMonetarySummation",
    ]),
    [
      "ram:PaymentReference",
      "ram:InvoiceCurrencyCode",
      "ram:SpecifiedTradeSettlementPaymentMeans",
      "ram:ApplicableTradeTax",
      "ram:SpecifiedTradePaymentTerms",
      "ram:SpecifiedTradeSettlementHeaderMonetarySummation",
    ]
  );
  const seller = xml.slice(xml.indexOf("<ram:SellerTradeParty>"), xml.indexOf("</ram:SellerTradeParty>"));
  assert.deepEqual(
    xmlElementOrder(seller, ["ram:Name", "ram:Description", "ram:SpecifiedLegalOrganization", "ram:PostalTradeAddress", "ram:URIUniversalCommunication", "ram:SpecifiedTaxRegistration"]),
    ["ram:Name", "ram:Description", "ram:SpecifiedLegalOrganization", "ram:PostalTradeAddress", "ram:URIUniversalCommunication", "ram:SpecifiedTaxRegistration"]
  );
  const tax = settlement.slice(settlement.indexOf("<ram:ApplicableTradeTax>"), settlement.indexOf("</ram:ApplicableTradeTax>"));
  assert.deepEqual(
    xmlElementOrder(tax, ["ram:CalculatedAmount", "ram:TypeCode", "ram:BasisAmount", "ram:CategoryCode", "ram:RateApplicablePercent"]),
    ["ram:CalculatedAmount", "ram:TypeCode", "ram:BasisAmount", "ram:CategoryCode", "ram:RateApplicablePercent"]
  );
});

test("plusieurs lignes et plusieurs taux (20 % et 5,5 %) : une ventilation par taux, BR-CO-10/13/14/15/16", () => {
  const inv = invoice({
    lines: [
      { id: "1", name: "Course express", quantity: 2, unitPrice: 12.35, vatCategory: "S", vatRate: 20 },
      { id: "2", name: "Attente", quantity: 3, unitPrice: 4.99, vatCategory: "S", vatRate: 20 },
      { id: "3", name: "Livraison repas", quantity: 1, unitPrice: 12.5, vatCategory: "S", vatRate: 5.5 },
    ],
  });
  const totals = computeFacturXTotals(inv);
  // 24.70 + 14.97 = 39.67 → TVA 7.934 → 7.93 ; 12.50 × 5,5 % = 0.6875 → 0.69
  assert.deepEqual(totals.breakdown.map((b) => [b.category, b.rate, b.basisCents, b.taxCents]), [
    ["S", 20, 3967, 793],
    ["S", 5.5, 1250, 69],
  ]);
  assert.equal(totals.lineTotalCents, 5217);
  assert.equal(totals.taxTotalCents, 862);
  assert.equal(totals.grandTotalCents, 6079);
  const xml = generateFacturXXml(inv);
  assert.deepEqual(xmlWellFormednessErrors(xml), []);
  assert.deepEqual(amount(xml, "LineTotalAmount"), ["24.70", "14.97", "12.50", "52.17"]);
  assert.deepEqual(amount(xml, "BasisAmount"), ["39.67", "12.50"]);
  assert.deepEqual(amount(xml, "CalculatedAmount"), ["7.93", "0.69"]);
  assert.deepEqual(amount(xml, "RateApplicablePercent"), ["20.00", "20.00", "5.50", "20.00", "5.50"]);
  assert.deepEqual(amount(xml, "GrandTotalAmount"), ["60.79"]);
});

test("arrondi au centime : la TVA est arrondie par taux sur la base, pas par ligne", () => {
  const inv = invoice({
    lines: [1, 2, 3].map((n) => ({ id: String(n), name: `Course ${n}`, quantity: 1, unitPrice: 0.05, vatCategory: "S" as const, vatRate: 20 })),
  });
  // 3 × 0,01 par ligne donnerait 0,03 ; la base 0,15 × 20 % = 0,03 → ici identique, on vérifie aussi un demi-centime :
  assert.equal(computeFacturXTotals(inv).taxTotalCents, 3);
  const half = invoice({ lines: [{ id: "1", name: "Course", quantity: 1, unitPrice: 0.125 * 2, vatCategory: "S", vatRate: 10 }] });
  // 0,25 × 10 % = 0,025 → arrondi au demi supérieur : 0,03
  assert.equal(computeFacturXTotals(half).taxTotalCents, 3);
});

test("exonération (franchise en base) : catégorie E, taux 0, motif obligatoire BR-E-10", () => {
  const inv = invoice({
    lines: [{ id: "1", name: "Course", quantity: 1, unitPrice: 18, vatCategory: "E", vatRate: 0 }],
    vatExemptions: { E: { reason: "TVA non applicable, art. 293 B du CGI", code: "VATEX-FR-FRANCHISE" } },
  });
  const xml = generateFacturXXml(inv);
  assert.deepEqual(xmlWellFormednessErrors(xml), []);
  assert.match(xml, /<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI<\/ram:ExemptionReason>/);
  assert.match(xml, /<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE<\/ram:ExemptionReasonCode>/);
  assert.match(xml, /<ram:TaxTotalAmount currencyID="EUR">0.00<\/ram:TaxTotalAmount>/);
  assert.deepEqual(amount(xml, "GrandTotalAmount"), ["18.00"]);
  assert.deepEqual(checkFacturXInvoice(inv), []);

  const missing = checkFacturXInvoice({ ...inv, vatExemptions: {} });
  assert.ok(missing.some((issue) => issue.rule === "BR-E-10"));
  // BR-E-02 : même exonéré, le vendeur doit porter un n° de TVA (ou un représentant fiscal, non géré ici).
  const noSellerVat = checkFacturXInvoice({ ...inv, seller: { ...seller, vatNumber: undefined } });
  assert.ok(noSellerVat.some((issue) => issue.rule === "BR-E-02"));
});

test("autoliquidation : catégorie AE, n° de TVA vendeur et acheteur exigés (BR-AE-02)", () => {
  const inv = invoice({
    lines: [{ id: "1", name: "Course", quantity: 1, unitPrice: 40, vatCategory: "AE", vatRate: 0 }],
    vatExemptions: { AE: { reason: "Autoliquidation", code: "VATEX-EU-AE" } },
  });
  assert.ok(checkFacturXInvoice(inv).some((issue) => issue.rule === "BR-AE-02"));
  const ok = { ...inv, buyer: { ...buyer, vatNumber: "FR40552100554" } };
  assert.deepEqual(checkFacturXInvoice(ok), []);
  assert.match(generateFacturXXml(ok), /<ram:CategoryCode>AE<\/ram:CategoryCode>/);
});

test("avoir (type 381) : référence à la facture d'origine BT-25", () => {
  const xml = generateFacturXXml(
    invoice({ typeCode: "381", number: "AV-2026-0001", precedingInvoice: { number: "FAC-2026-0001", issueDate: new Date("2026-10-27T09:00:00Z") } })
  );
  assert.deepEqual(amount(xml, "TypeCode").slice(0, 1), ["381"]);
  assert.match(xml, /<ram:InvoiceReferencedDocument>\s*<ram:IssuerAssignedID>FAC-2026-0001<\/ram:IssuerAssignedID>/);
  assert.match(xml, /<qdt:DateTimeString format="102">20261027<\/qdt:DateTimeString>/);
});

test("caractères spéciaux et accents : échappement XML correct et texte restitué à l'identique", () => {
  const name = `Livraison « urgente » <fragile> & "sec" l'été — Ærø ½`;
  const xml = generateFacturXXml(
    invoice({
      buyer: { ...buyer, name: "Société Étoile & Fils <test>" },
      lines: [{ id: "1", name, quantity: 1, unitPrice: 10, vatCategory: "S", vatRate: 20 }],
    })
  );
  assert.deepEqual(xmlWellFormednessErrors(xml), []);
  assert.ok(xmlTexts(xml, "ram:Name").includes(name));
  assert.ok(xmlTexts(xml, "ram:Name").includes("Société Étoile & Fils <test>"));
  // eslint-disable-next-line no-control-regex
  const withControl = generateFacturXXml(invoice({ lines: [{ id: "1", name: "Ligne\u0007 cachée", quantity: 1, unitPrice: 1, vatCategory: "S", vatRate: 20 }] }));
  assert.deepEqual(xmlWellFormednessErrors(withControl), []);
});

test("règles EN 16931 : génération refusée avec la liste des règles violées", () => {
  const bad = invoice({
    number: "",
    seller: { ...seller, vatNumber: undefined, address: { ...seller.address, countryCode: "" } },
    buyer: { ...buyer, name: " " },
    lines: [],
  });
  const rules = checkFacturXInvoice(bad).map((issue) => issue.rule);
  for (const rule of ["BR-02", "BR-07", "BR-09", "BR-16"]) assert.ok(rules.includes(rule), rule);
  assert.throws(() => generateFacturXXml(bad), (error: unknown) => error instanceof FacturXValidationError && error.issues.length >= 4);

  const negative = invoice({ lines: [{ id: "1", name: "x", quantity: 1, unitPrice: -1, vatCategory: "S", vatRate: 20 }] });
  assert.ok(checkFacturXInvoice(negative).some((issue) => issue.rule === "BR-27"));
  const noVat = invoice({ seller: { ...seller, vatNumber: undefined } });
  assert.ok(checkFacturXInvoice(noVat).some((issue) => issue.rule === "BR-S-02"));
  const noTerms = invoice({ dueDate: null, paymentTerms: undefined });
  assert.ok(checkFacturXInvoice(noTerms).some((issue) => issue.rule === "BR-CO-25"));
  const badIban = invoice({ payment: { typeCode: "58", iban: "" } });
  assert.ok(checkFacturXInvoice(badIban).some((issue) => issue.rule === "BR-61"));
});

test("le générateur est déterministe : même facture, même XML", () => {
  assert.equal(generateFacturXXml(invoice()), generateFacturXXml(invoice()));
});

test("facture payée : TotalPrepaidAmount = TTC et DuePayableAmount = 0 (BR-CO-16), sans conditions requises", () => {
  const inv = invoice({ prepaidAmount: 30 });
  const totals = computeFacturXTotals(inv);
  assert.equal(totals.prepaidCents, 3000);
  assert.equal(totals.duePayableCents, 0);
  const xml = generateFacturXXml(inv);
  assert.deepEqual(amount(xml, "TotalPrepaidAmount"), ["30.00"]);
  assert.deepEqual(amount(xml, "DuePayableAmount"), ["0.00"]);
  const summary = xml.slice(xml.indexOf("<ram:SpecifiedTradeSettlementHeaderMonetarySummation>"));
  assert.ok(summary.indexOf("<ram:GrandTotalAmount>") < summary.indexOf("<ram:TotalPrepaidAmount>"));
  assert.ok(summary.indexOf("<ram:TotalPrepaidAmount>") < summary.indexOf("<ram:DuePayableAmount>"));
  assert.deepEqual(checkFacturXInvoice({ ...inv, dueDate: null, paymentTerms: undefined }), [], "BR-CO-25 ne s'applique pas à un montant dû nul");
  // Acompte partiel (le générateur le gère ; le modèle TutelLiv n'enregistre pas de paiement partiel).
  const partial = generateFacturXXml(invoice({ prepaidAmount: 10 }));
  assert.deepEqual(amount(partial, "DuePayableAmount"), ["20.00"]);
  assert.ok(checkFacturXInvoice(invoice({ prepaidAmount: 31 })).some((issue) => issue.rule === "TL-ACOMPTE"));
});

test("facture non payée : pas de TotalPrepaidAmount, montant dû = TTC", () => {
  const xml = generateFacturXXml(invoice());
  assert.deepEqual(amount(xml, "TotalPrepaidAmount"), []);
  assert.deepEqual(amount(xml, "DuePayableAmount"), ["30.00"]);
});

test("franchise en base sans n° de TVA : BR-E-02 satisfaite par l'identifiant fiscal BT-32 (schéma FC)", () => {
  const franchise = invoice({
    seller: { ...seller, vatNumber: undefined, taxRegistrationId: "732829320" },
    lines: [{ id: "1", name: "Course", quantity: 1, unitPrice: 18, vatCategory: "E", vatRate: 0 }],
    vatExemptions: { E: { reason: "TVA non applicable, art. 293 B du CGI", code: "VATEX-FR-FRANCHISE" } },
  });
  assert.deepEqual(checkFacturXInvoice(franchise), []);
  const xml = generateFacturXXml(franchise);
  assert.match(xml, /<ram:SpecifiedTaxRegistration>\s*<ram:ID schemeID="FC">732829320<\/ram:ID>/);
  assert.doesNotMatch(xml, /schemeID="VA">FR44/);
  assert.ok(checkFacturXInvoice({ ...franchise, seller: { ...seller, vatNumber: undefined } }).some((issue) => issue.rule === "BR-E-02"));
});

test("BT-72 : la date de livraison remplit le bloc de livraison, sinon il reste vide", () => {
  // Livrée le 27 octobre à 23 h 30 UTC, soit le 28 octobre à Paris.
  const delivered = generateFacturXXml(invoice({ deliveryDate: new Date("2026-10-27T23:30:00Z") }));
  assert.deepEqual(xmlWellFormednessErrors(delivered), []);
  assert.match(
    delivered,
    /<ram:ApplicableHeaderTradeDelivery>\s*<ram:ActualDeliverySupplyChainEvent>\s*<ram:OccurrenceDateTime>\s*<udt:DateTimeString format="102">20261028<\/udt:DateTimeString>\s*<\/ram:OccurrenceDateTime>\s*<\/ram:ActualDeliverySupplyChainEvent>\s*<\/ram:ApplicableHeaderTradeDelivery>/
  );
  const undated = generateFacturXXml(invoice());
  assert.doesNotMatch(undated, /ActualDeliverySupplyChainEvent/);
  assert.match(undated, /<ram:ApplicableHeaderTradeDelivery\s*\/>|<ram:ApplicableHeaderTradeDelivery>\s*<\/ram:ApplicableHeaderTradeDelivery>/);
});
