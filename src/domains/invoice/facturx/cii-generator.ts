/**
 * Générateur XML UN/CEFACT CII D16B pour Factur-X, profil EN 16931 (« Comfort »).
 * Fonction pure : aucune lecture de base, aucune horloge. Montants calculés en centimes entiers.
 *
 * Contrôles intégrés : sous-ensemble implémentable des règles EN 16931 (BR-, BR-CO-, BR-S/E/AE-).
 * Ce n'est pas un validateur XSD/Schematron officiel : voir docs/FACTURX.md.
 */
import type {
  FacturXInvoice,
  FacturXIssue,
  FacturXLine,
  FacturXParty,
  FacturXTotals,
  FacturXVatBreakdown,
  FacturXVatCategory,
} from "@/domains/invoice/facturx/facturx.types";

export const FACTURX_GUIDELINE_EN16931 = "urn:cen.eu:en16931:2017";
export const FACTURX_CONFORMANCE_LEVEL = "EN 16931";

const NS = {
  rsm: "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
  qdt: "urn:un:unece:uncefact:data:standard:QualifiedDataType:100",
  ram: "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
  udt: "urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100",
};

export class FacturXValidationError extends Error {
  constructor(public readonly issues: FacturXIssue[]) {
    super(`FACTURX_INVALID: ${issues.map((issue) => issue.rule).join(", ")}`);
    this.name = "FacturXValidationError";
  }
}

// ---------------------------------------------------------------------------
// Montants
// ---------------------------------------------------------------------------

/** Arrondi au centime, demi supérieur (HALF_UP), insensible aux erreurs binaires des flottants. */
function toCents(euros: number): number {
  const scaled = Number((euros * 100).toFixed(6));
  return scaled >= 0 ? Math.floor(scaled + 0.5) : -Math.floor(-scaled + 0.5);
}

/** TVA d'une base (centimes) à un taux en %, arrondie HALF_UP au centime, en arithmétique entière. */
function taxCents(basisCents: number, rate: number): number {
  const rateMilli = Math.round(rate * 1000); // 5,5 % → 5500
  const product = Math.abs(basisCents) * rateMilli;
  const rounded = Math.floor((product + 50_000) / 100_000);
  return basisCents < 0 ? -rounded : rounded;
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

function formatPrice(price: number): string {
  const cents = price * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-9 ? formatCents(Math.round(cents)) : String(Number(price.toFixed(4)));
}

function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(4)));
}

function formatRate(rate: number): string {
  return rate.toFixed(2);
}

export function computeFacturXTotals(invoice: FacturXInvoice): FacturXTotals {
  const lineNetCents = invoice.lines.map((line) => toCents(line.quantity * line.unitPrice));
  const groups = new Map<string, FacturXVatBreakdown>();
  invoice.lines.forEach((line, index) => {
    const key = `${line.vatCategory}|${line.vatRate}`;
    const group = groups.get(key) ?? { category: line.vatCategory, rate: line.vatRate, basisCents: 0, taxCents: 0 };
    group.basisCents += lineNetCents[index] ?? 0;
    groups.set(key, group);
  });
  const breakdown = [...groups.values()].map((group) => ({
    ...group,
    taxCents: group.category === "S" ? taxCents(group.basisCents, group.rate) : 0,
  }));
  const lineTotalCents = lineNetCents.reduce((sum, value) => sum + value, 0);
  const taxTotalCents = breakdown.reduce((sum, group) => sum + group.taxCents, 0);
  // Ni remise ni frais de pied de facture dans ce périmètre : BR-CO-13 → base = total des lignes.
  const taxBasisTotalCents = lineTotalCents;
  const grandTotalCents = taxBasisTotalCents + taxTotalCents;
  return {
    lineNetCents,
    breakdown,
    lineTotalCents,
    taxBasisTotalCents,
    taxTotalCents,
    grandTotalCents,
    // Pas d'acompte ni d'arrondi (BT-113/BT-114) : BR-CO-16 → montant dû = TTC.
    duePayableCents: grandTotalCents,
  };
}

// ---------------------------------------------------------------------------
// Contrôles EN 16931
// ---------------------------------------------------------------------------

const blank = (value: string | undefined | null) => !value || !value.trim();
const VAT_ID = /^[A-Z]{2}[0-9A-Za-z+*.]{2,13}$/;
const COUNTRY = /^[A-Z]{2}$/;

function checkParty(party: FacturXParty, role: "vendeur" | "acheteur", issues: FacturXIssue[]) {
  const seller = role === "vendeur";
  if (blank(party.name)) issues.push({ rule: seller ? "BR-06" : "BR-07", message: `Nom du ${role} manquant.` });
  const address = party.address;
  if (blank(address?.line1) || blank(address?.postalCode) || blank(address?.city)) {
    issues.push({ rule: seller ? "BR-08" : "BR-10", message: `Adresse postale du ${role} incomplète (rue, code postal, ville).` });
  }
  if (!COUNTRY.test(address?.countryCode ?? "")) {
    issues.push({ rule: seller ? "BR-09" : "BR-11", message: `Code pays du ${role} manquant ou invalide (2 lettres, ex. FR).` });
  }
  if (party.vatNumber && !VAT_ID.test(party.vatNumber)) {
    issues.push({ rule: "BR-CO-09", message: `N° de TVA du ${role} invalide : il doit commencer par le code pays (ex. FR…).` });
  }
}

function checkLine(line: FacturXLine, index: number, issues: FacturXIssue[]) {
  const label = `Ligne ${index + 1}`;
  if (blank(line.id)) issues.push({ rule: "BR-21", message: `${label} : identifiant manquant.` });
  if (!Number.isFinite(line.quantity) || line.quantity === 0) issues.push({ rule: "BR-22", message: `${label} : quantité manquante.` });
  if (blank(line.name)) issues.push({ rule: "BR-25", message: `${label} : libellé manquant.` });
  if (!Number.isFinite(line.unitPrice)) issues.push({ rule: "BR-26", message: `${label} : prix unitaire manquant.` });
  else if (line.unitPrice < 0) issues.push({ rule: "BR-27", message: `${label} : le prix unitaire net ne peut pas être négatif.` });
  if (line.vatCategory === "S" && !(line.vatRate > 0)) issues.push({ rule: "BR-S-05", message: `${label} : taux de TVA normal attendu supérieur à 0.` });
  if (line.vatCategory === "E" && line.vatRate !== 0) issues.push({ rule: "BR-E-05", message: `${label} : une ligne exonérée a un taux de 0.` });
  if (line.vatCategory === "AE" && line.vatRate !== 0) issues.push({ rule: "BR-AE-05", message: `${label} : une ligne autoliquidée a un taux de 0.` });
}

/** Liste les règles violées ; vide si la facture peut être générée. */
export function checkFacturXInvoice(invoice: FacturXInvoice): FacturXIssue[] {
  const issues: FacturXIssue[] = [];
  if (blank(invoice.number)) issues.push({ rule: "BR-02", message: "Numéro de facture manquant." });
  if (!(invoice.issueDate instanceof Date) || Number.isNaN(invoice.issueDate.getTime())) {
    issues.push({ rule: "BR-03", message: "Date d'émission manquante." });
  }
  if (invoice.typeCode !== "380" && invoice.typeCode !== "381") issues.push({ rule: "BR-04", message: "Type de document non géré." });
  if (invoice.currency !== "EUR") issues.push({ rule: "BR-05", message: "Devise non gérée (EUR uniquement)." });

  checkParty(invoice.seller, "vendeur", issues);
  checkParty(invoice.buyer, "acheteur", issues);
  if (blank(invoice.seller.siren) && blank(invoice.seller.vatNumber)) {
    issues.push({ rule: "BR-CO-26", message: "Le vendeur doit être identifié par son SIREN ou son n° de TVA." });
  }

  if (invoice.lines.length === 0) issues.push({ rule: "BR-16", message: "La facture doit comporter au moins une ligne." });
  invoice.lines.forEach((line, index) => checkLine(line, index, issues));

  const categories = new Set<FacturXVatCategory>(invoice.lines.map((line) => line.vatCategory));
  if (categories.has("S") && blank(invoice.seller.vatNumber)) {
    issues.push({ rule: "BR-S-02", message: "N° de TVA intracommunautaire du vendeur requis pour facturer de la TVA." });
  }
  if (categories.has("E")) {
    if (blank(invoice.seller.vatNumber)) issues.push({ rule: "BR-E-02", message: "N° de TVA du vendeur requis pour une facture exonérée." });
    if (blank(invoice.vatExemptions.E?.reason) && blank(invoice.vatExemptions.E?.code)) {
      issues.push({ rule: "BR-E-10", message: "Motif d'exonération de TVA manquant (ex. « TVA non applicable, art. 293 B du CGI »)." });
    }
  }
  if (categories.has("AE")) {
    if (blank(invoice.seller.vatNumber) || blank(invoice.buyer.vatNumber)) {
      issues.push({ rule: "BR-AE-02", message: "Autoliquidation : n° de TVA du vendeur et de l'acheteur requis." });
    }
    if (blank(invoice.vatExemptions.AE?.reason) && blank(invoice.vatExemptions.AE?.code)) {
      issues.push({ rule: "BR-AE-10", message: "Autoliquidation : mention d'exonération manquante." });
    }
  }

  if (invoice.payment && blank(invoice.payment.iban)) {
    issues.push({ rule: "BR-61", message: "Virement : IBAN du bénéficiaire manquant." });
  }

  if (issues.length === 0) {
    const totals = computeFacturXTotals(invoice);
    if (totals.duePayableCents > 0 && !invoice.dueDate && blank(invoice.paymentTerms)) {
      issues.push({ rule: "BR-CO-25", message: "Montant dû positif : date d'échéance ou conditions de paiement requises." });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// XML
// ---------------------------------------------------------------------------

type XmlChild = XmlNode | string | false | null | undefined;
interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text?: string;
}

function el(name: string, children: XmlChild[] = [], attrs: Record<string, string> = {}): XmlNode {
  return { name, attrs, children: children.filter((child): child is XmlNode => typeof child === "object" && child !== null) };
}

function leaf(name: string, text: string, attrs: Record<string, string> = {}): XmlNode {
  return { name, attrs, children: [], text };
}

/** Échappe le texte et retire les caractères interdits en XML 1.0. */
function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function serialize(node: XmlNode, depth = 0): string {
  const pad = "  ".repeat(depth);
  const attrs = Object.entries(node.attrs).map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join("");
  if (node.text !== undefined) return `${pad}<${node.name}${attrs}>${escapeXml(node.text)}</${node.name}>`;
  if (node.children.length === 0) return `${pad}<${node.name}${attrs}/>`;
  return [`${pad}<${node.name}${attrs}>`, ...node.children.map((child) => serialize(child, depth + 1)), `${pad}</${node.name}>`].join("\n");
}

const PARIS_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/** Date au format UNTDID 2379 « 102 » (AAAAMMJJ), jour civil à Paris. */
export function formatFacturXDate(date: Date): string {
  return PARIS_DATE.format(date).replace(/-/g, "");
}

const dateTime = (name: string, date: Date) => el(name, [leaf("udt:DateTimeString", formatFacturXDate(date), { format: "102" })]);
const clean = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

function partyNode(name: string, party: FacturXParty, withLegalInfo: boolean): XmlNode {
  const siren = clean(party.siren);
  const vat = clean(party.vatNumber);
  const email = clean(party.email);
  const legalInfo = withLegalInfo ? clean(party.legalInfo) : undefined;
  return el(name, [
    leaf("ram:Name", party.name.trim()),
    legalInfo && leaf("ram:Description", legalInfo),
    siren && el("ram:SpecifiedLegalOrganization", [leaf("ram:ID", siren, { schemeID: "0002" })]),
    el("ram:PostalTradeAddress", [
      leaf("ram:PostcodeCode", party.address.postalCode.trim()),
      leaf("ram:LineOne", party.address.line1.trim()),
      clean(party.address.line2) && leaf("ram:LineTwo", party.address.line2!.trim()),
      leaf("ram:CityName", party.address.city.trim()),
      leaf("ram:CountryID", party.address.countryCode),
    ]),
    email && el("ram:URIUniversalCommunication", [leaf("ram:URIID", email, { schemeID: "EM" })]),
    vat && el("ram:SpecifiedTaxRegistration", [leaf("ram:ID", vat, { schemeID: "VA" })]),
  ]);
}

function tradeTaxNode(invoice: FacturXInvoice, category: FacturXVatCategory, rate: number, amounts?: { basisCents: number; taxCents: number }): XmlNode {
  const exemption = category === "S" ? undefined : invoice.vatExemptions[category];
  return el("ram:ApplicableTradeTax", [
    amounts && leaf("ram:CalculatedAmount", formatCents(amounts.taxCents)),
    leaf("ram:TypeCode", "VAT"),
    amounts && clean(exemption?.reason) && leaf("ram:ExemptionReason", exemption!.reason.trim()),
    amounts && leaf("ram:BasisAmount", formatCents(amounts.basisCents)),
    leaf("ram:CategoryCode", category),
    amounts && clean(exemption?.code) && leaf("ram:ExemptionReasonCode", exemption!.code!.trim()),
    leaf("ram:RateApplicablePercent", formatRate(rate)),
  ]);
}

/**
 * Produit le XML `factur-x.xml` (UTF-8). Lève FacturXValidationError si une règle est violée,
 * pour ne jamais émettre un XML incohérent.
 */
export function generateFacturXXml(invoice: FacturXInvoice): string {
  const issues = checkFacturXInvoice(invoice);
  if (issues.length) throw new FacturXValidationError(issues);
  const totals = computeFacturXTotals(invoice);
  const currency = invoice.currency;

  const lines = invoice.lines.map((line, index) =>
    el("ram:IncludedSupplyChainTradeLineItem", [
      el("ram:AssociatedDocumentLineDocument", [leaf("ram:LineID", line.id)]),
      el("ram:SpecifiedTradeProduct", [leaf("ram:Name", line.name.trim())]),
      el("ram:SpecifiedLineTradeAgreement", [el("ram:NetPriceProductTradePrice", [leaf("ram:ChargeAmount", formatPrice(line.unitPrice))])]),
      el("ram:SpecifiedLineTradeDelivery", [leaf("ram:BilledQuantity", formatQuantity(line.quantity), { unitCode: "C62" })]),
      el("ram:SpecifiedLineTradeSettlement", [
        tradeTaxNode(invoice, line.vatCategory, line.vatRate),
        el("ram:SpecifiedTradeSettlementLineMonetarySummation", [leaf("ram:LineTotalAmount", formatCents(totals.lineNetCents[index] ?? 0))]),
      ]),
    ])
  );

  const payment = invoice.payment;
  const root = el(
    "rsm:CrossIndustryInvoice",
    [
      el("rsm:ExchangedDocumentContext", [el("ram:GuidelineSpecifiedDocumentContextParameter", [leaf("ram:ID", FACTURX_GUIDELINE_EN16931)])]),
      el("rsm:ExchangedDocument", [
        leaf("ram:ID", invoice.number.trim()),
        leaf("ram:TypeCode", invoice.typeCode),
        dateTime("ram:IssueDateTime", invoice.issueDate),
        ...invoice.notes
          .filter((note) => clean(note.content))
          .map((note) => el("ram:IncludedNote", [leaf("ram:Content", note.content.trim()), clean(note.subjectCode) && leaf("ram:SubjectCode", note.subjectCode!.trim())])),
      ]),
      el("rsm:SupplyChainTradeTransaction", [
        ...lines,
        el("ram:ApplicableHeaderTradeAgreement", [
          partyNode("ram:SellerTradeParty", invoice.seller, true),
          partyNode("ram:BuyerTradeParty", invoice.buyer, false),
          clean(invoice.sellerOrderReference) && el("ram:SellerOrderReferencedDocument", [leaf("ram:IssuerAssignedID", invoice.sellerOrderReference!.trim())]),
        ]),
        el("ram:ApplicableHeaderTradeDelivery"),
        el("ram:ApplicableHeaderTradeSettlement", [
          clean(invoice.paymentReference) && leaf("ram:PaymentReference", invoice.paymentReference!.trim()),
          leaf("ram:InvoiceCurrencyCode", currency),
          payment &&
            el("ram:SpecifiedTradeSettlementPaymentMeans", [
              leaf("ram:TypeCode", payment.typeCode),
              el("ram:PayeePartyCreditorFinancialAccount", [leaf("ram:IBANID", payment.iban.replace(/\s+/g, ""))]),
              clean(payment.bic) && el("ram:PayeeSpecifiedCreditorFinancialInstitution", [leaf("ram:BICID", payment.bic!.trim())]),
            ]),
          ...totals.breakdown.map((group) => tradeTaxNode(invoice, group.category, group.rate, group)),
          (clean(invoice.paymentTerms) || invoice.dueDate) &&
            el("ram:SpecifiedTradePaymentTerms", [
              clean(invoice.paymentTerms) && leaf("ram:Description", invoice.paymentTerms!.trim()),
              invoice.dueDate && dateTime("ram:DueDateDateTime", invoice.dueDate),
            ]),
          el("ram:SpecifiedTradeSettlementHeaderMonetarySummation", [
            leaf("ram:LineTotalAmount", formatCents(totals.lineTotalCents)),
            leaf("ram:TaxBasisTotalAmount", formatCents(totals.taxBasisTotalCents)),
            leaf("ram:TaxTotalAmount", formatCents(totals.taxTotalCents), { currencyID: currency }),
            leaf("ram:GrandTotalAmount", formatCents(totals.grandTotalCents)),
            leaf("ram:DuePayableAmount", formatCents(totals.duePayableCents)),
          ]),
          invoice.precedingInvoice &&
            el("ram:InvoiceReferencedDocument", [
              leaf("ram:IssuerAssignedID", invoice.precedingInvoice.number),
              el("ram:FormattedIssueDateTime", [leaf("qdt:DateTimeString", formatFacturXDate(invoice.precedingInvoice.issueDate), { format: "102" })]),
            ]),
        ]),
      ]),
    ],
    { "xmlns:rsm": NS.rsm, "xmlns:qdt": NS.qdt, "xmlns:ram": NS.ram, "xmlns:udt": NS.udt }
  );

  return `<?xml version="1.0" encoding="UTF-8"?>\n${serialize(root)}\n`;
}
