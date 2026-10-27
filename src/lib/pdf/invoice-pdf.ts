import {
  PDFDocument,
  StandardFonts,
  rgb,
  setCharacterSpacing,
  type Color,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type { InvoiceStatus } from "@prisma/client";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-status";
import { TUTELLIV_LOGO_PNG_BASE64 } from "@/lib/pdf/tutelliv-logo";

export interface InvoicePdfData {
  reference: string;
  status: string;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
  amount: number;
  lineItems: { label: string; amount: number; quantity: number }[];
  notes?: string | null;
  orderReference?: string | null;
  company: { name?: string | null; email?: string | null; address?: string | null; city?: string | null };
  /** PNG du logo de l'entreprise (déjà normalisé) ; à défaut, son nom en tête. */
  companyLogoPng?: Uint8Array | null;
  customerName?: string | null;
  customerEmail?: string | null;
  footerNote?: string | null;
}

/* Couleurs TutelLiv (DA Menthe). */
const INK = rgb(0.055, 0.075, 0.063); // #0e1310
const MINT = rgb(0, 0.831, 0.416); // #00d46a
const BRAND = rgb(0.031, 0.471, 0.247); // #08783f
const MUTED = rgb(0.408, 0.447, 0.42); // #68726b
const SOFT = rgb(0.58, 0.612, 0.592); // #949c97
const PALE = rgb(0.957, 0.98, 0.965); // #f4faf6
const HAIRLINE = rgb(0.902, 0.918, 0.906); // #e6eae7
const RULE = rgb(0.78, 0.8, 0.788); // #c7ccc9, filet de structure (tableau, total)

const STATUS_TONE: Record<string, { fill: Color; dot: Color; text: Color }> = {
  PAID: { fill: rgb(0.886, 0.973, 0.922), dot: MINT, text: BRAND },
  PENDING: { fill: rgb(0.996, 0.957, 0.886), dot: rgb(0.906, 0.6, 0.075), text: rgb(0.478, 0.329, 0.063) },
  OVERDUE: { fill: rgb(0.996, 0.906, 0.894), dot: rgb(0.851, 0.231, 0.18), text: rgb(0.702, 0.208, 0.165) },
};
const NEUTRAL_TONE = { fill: rgb(0.937, 0.945, 0.941), dot: SOFT, text: MUTED };

const PAGE: [number, number] = [595, 842];
const MARGIN = 56;
const RIGHT = PAGE[0] - MARGIN;
const CONTENT_BOTTOM = 100;
/* Colonnes du tableau (bords droits pour les nombres). */
const COL_QTY = MARGIN + 300;
const COL_UNIT = MARGIN + 395;
const LABEL_WIDTH = 250;

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }) : "—";
}
/** « 26 novembre 2026 », pour les phrases. */
function formatLongDate(value: Date | string | null | undefined): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "—";
}

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** « 59,90 € » ; « — » si le montant n'est pas lisible (jamais « NaN »). */
function money(value: number): string {
  return Number.isFinite(value) ? currency.format(value) : "—";
}

/** Phrase sous le montant : ce que le client doit savoir du paiement. */
function paymentSentence(data: InvoicePdfData): string | null {
  if (data.paidAt) return `Paiement reçu le ${formatLongDate(data.paidAt)}, merci`;
  if (data.status === "CANCELLED") return "Relevé annulé, aucun paiement attendu";
  if (!toDate(data.dueDate)) return null;
  return data.status === "OVERDUE"
    ? `Échéance dépassée depuis le ${formatLongDate(data.dueDate)}`
    : `À régler avant le ${formatLongDate(data.dueDate)}`;
}

/** Rectangle à coins arrondis, en coordonnées PDF (origine en bas à gauche). */
function roundedRect(page: PDFPage, x: number, y: number, width: number, height: number, radius: number, color: Color) {
  const r = Math.min(radius, width / 2, height / 2);
  const w = width;
  const h = height;
  const path =
    `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} ` +
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  // drawSvgPath place l'origine SVG (haut gauche) en (x, y) et inverse l'axe vertical.
  page.drawSvgPath(path, { x, y: y + h, color, borderWidth: 0 });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Relevé de prestation ${data.reference}`);
  doc.setCreator("TutelLiv");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  const tutelliv = await doc.embedPng(Buffer.from(TUTELLIV_LOGO_PNG_BASE64, "base64"));
  let companyLogo: PDFImage | null = null;
  if (data.companyLogoPng?.length) {
    // Un logo illisible ne doit jamais empêcher le relevé : on retombe sur le nom.
    companyLogo = await doc.embedPng(data.companyLogoPng).catch(() => null);
  }

  /** Police standard (WinAnsi) : on garde €, ’, œ… et on remplace seulement l'impossible. */
  const sanitize = (value: string) =>
    [...value.replace(/[\u202f\u2009\u2007]/g, "\u00a0")]
      .map((character) => (character === "\n" || supported.has(character.codePointAt(0)!) ? character : "?"))
      .join("");

  let page: PDFPage = doc.addPage(PAGE);
  type TextOptions = { size?: number; bold?: boolean; color?: Color; tracking?: number };
  const fontOf = (opts?: TextOptions): PDFFont => (opts?.bold ? bold : font);
  /** Approche optique : resserrée sur les grands corps, légèrement ouverte sur les petits. */
  const trackingOf = (opts?: TextOptions) => {
    if (opts?.tracking !== undefined) return opts.tracking;
    const size = opts?.size ?? 10;
    return size * (size >= 28 ? -0.022 : size >= 14 ? -0.014 : 0.01);
  };
  const widthOf = (value: string, opts?: TextOptions) => {
    const clean = sanitize(value);
    return fontOf(opts).widthOfTextAtSize(clean, opts?.size ?? 10) + trackingOf(opts) * clean.length;
  };
  const text = (value: string, x: number, y: number, opts?: TextOptions) => {
    page.pushOperators(setCharacterSpacing(trackingOf(opts)));
    page.drawText(sanitize(value), { x, y, size: opts?.size ?? 10, font: fontOf(opts), color: opts?.color ?? INK });
    page.pushOperators(setCharacterSpacing(0));
  };
  const textRight = (value: string, xRight: number, y: number, opts?: TextOptions) =>
    text(value, xRight - widthOf(value, opts), y, opts);
  /** Petit intitulé en capitales espacées, la signature typographique du relevé. */
  const LABEL: TextOptions = { size: 7, bold: true, color: SOFT, tracking: 0.55 };
  const label = (value: string, x: number, y: number) => text(value.toUpperCase(), x, y, LABEL);
  const labelRight = (value: string, xRight: number, y: number) => textRight(value.toUpperCase(), xRight, y, LABEL);
  const hairline = (y: number, from = MARGIN, to = RIGHT, color = HAIRLINE, thickness = 0.6) =>
    page.drawLine({ start: { x: from, y }, end: { x: to, y }, thickness, color });

  const wrap = (value: string, width: number, opts: TextOptions = { size: 9 }): string[] => {
    const f = fontOf(opts);
    const size = opts.size ?? 10;
    const lines: string[] = [];
    for (const paragraph of sanitize(value).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/(\s+)/)) {
        if (f.widthOfTextAtSize(current + word, size) <= width) { current += word; continue; }
        if (current.trim()) lines.push(current.trimEnd());
        current = "";
        // Mot plus long que la colonne : coupé au caractère.
        for (const character of word.trimStart()) {
          if (f.widthOfTextAtSize(current + character, size) > width && current) { lines.push(current); current = ""; }
          current += character;
        }
      }
      lines.push(current.trimEnd());
    }
    return lines;
  };
  /** Taille la plus grande (jusqu'à `min`) pour tenir dans `width` ; au-delà, retour à la ligne. */
  const fit = (value: string, width: number, max: number, min: number, isBold = true) => {
    let size = max;
    while (size > min && widthOf(value, { size, bold: isBold }) > width) size -= 0.5;
    return { size, lines: wrap(value, width, { size, bold: isBold }) };
  };
  const accent = () => page.drawRectangle({ x: 0, y: PAGE[1] - 4, width: PAGE[0], height: 4, color: MINT });

  const companyName = data.company.name?.trim() || "Entreprise";
  const statusLabel = INVOICE_STATUS_LABELS[data.status as InvoiceStatus] ?? data.status;
  const tone = STATUS_TONE[data.status] ?? NEUTRAL_TONE;

  // ── En-tête : identité de l'entreprise à gauche, nature et référence du document à droite ──
  accent();
  const top = 790;
  const referenceWidth = Math.max(widthOf(data.reference, { size: 12, bold: true }), widthOf("RELEVÉ DE PRESTATION", LABEL));
  let headerBottom: number;
  if (companyLogo) {
    const scale = Math.min(170 / companyLogo.width, 52 / companyLogo.height, 1);
    const height = companyLogo.height * scale;
    page.drawImage(companyLogo, { x: MARGIN, y: top + 8 - height, width: companyLogo.width * scale, height });
    headerBottom = top + 8 - height;
  } else {
    // Le nom ne doit jamais toucher la référence à droite : taille réduite, puis retour à la ligne.
    const { size, lines } = fit(companyName, RIGHT - MARGIN - referenceWidth - 48, 20, 12);
    let y = top - size + 8;
    for (const line of lines.slice(0, 2)) { text(line, MARGIN, y, { size, bold: true }); y -= size + 4; }
    headerBottom = y + size;
  }
  labelRight("Relevé de prestation", RIGHT, top);
  textRight(data.reference, RIGHT, top - 18, { size: 12, bold: true });

  // ── Montant, statut et phrase de paiement ──
  let y = Math.min(headerBottom, top - 18) - 52;
  label("Montant", MARGIN, y);
  y -= 38;
  text(money(data.amount), MARGIN, y, { size: 34, bold: true });
  y -= 30;
  const pillText = { size: 8.5, bold: true, color: tone.text };
  const pillWidth = widthOf(statusLabel, pillText) + 30;
  roundedRect(page, MARGIN, y - 6, pillWidth, 20, 10, tone.fill);
  page.drawCircle({ x: MARGIN + 11, y: y + 4, size: 2.8, color: tone.dot });
  text(statusLabel, MARGIN + 19, y + 0.8, pillText);
  const sentence = paymentSentence(data);
  if (sentence) text(sentence, MARGIN + pillWidth + 12, y + 0.8, { size: 9.5, color: MUTED });
  y -= 40;

  // ── Facturé à · Émis par · Détails ──
  hairline(y);
  y -= 26;
  const colTop = y;
  const COL_B = MARGIN + 165;
  const COL_C = MARGIN + 330;
  const block = (x: number, width: number, title: string, rows: { value: string; strong?: boolean }[]) => {
    label(title, x, colTop);
    let rowY = colTop - 18;
    for (const row of rows) {
      const opts: TextOptions = row.strong ? { size: 10, bold: true } : { size: 9, color: MUTED };
      for (const line of wrap(row.value, width, opts).slice(0, 2)) { text(line, x, rowY, opts); rowY -= row.strong ? 14 : 13; }
    }
    return rowY;
  };
  const billedTo = [
    data.customerName ? { value: data.customerName, strong: true } : null,
    data.customerEmail ? { value: data.customerEmail } : null,
  ].filter((row): row is { value: string; strong?: boolean } => Boolean(row));
  const issuedBy = [
    { value: companyName, strong: true },
    data.company.address ? { value: data.company.address } : null,
    data.company.city ? { value: data.company.city } : null,
    data.company.email ? { value: data.company.email } : null,
  ].filter((row): row is { value: string; strong?: boolean } => Boolean(row));
  let colBottom = block(MARGIN, 150, "Facturé à", billedTo.length ? billedTo : [{ value: "—" }]);
  colBottom = Math.min(colBottom, block(COL_B, 150, "Émis par", issuedBy));

  label("Détails", COL_C, colTop);
  let detailY = colTop - 18;
  const details: [string, string][] = [
    ["Référence", data.reference],
    ["Émis le", formatDate(data.createdAt)],
    ...(data.orderReference ? [["Commande", data.orderReference] as [string, string]] : []),
    [data.paidAt ? "Payée le" : "Échéance", formatDate(data.paidAt ?? data.dueDate)],
  ];
  for (const [name, value] of details) {
    text(name, COL_C, detailY, { size: 9, color: MUTED });
    const { size } = fit(value, RIGHT - COL_C - 62, 9, 7, false);
    textRight(value, RIGHT, detailY, { size });
    detailY -= 14;
  }
  y = Math.min(colBottom, detailY) - 22;
  hairline(y);
  y -= 34;

  // ── Tableau des prestations ──
  const tableHeader = () => {
    label("Désignation", MARGIN, y);
    labelRight("Qté", COL_QTY, y);
    labelRight("Prix unitaire", COL_UNIT, y);
    labelRight("Montant", RIGHT, y);
    y -= 10;
    hairline(y, MARGIN, RIGHT, RULE, 0.6);
    y -= 20;
  };
  const ensureRoom = (height: number, table = false) => {
    if (y - height >= CONTENT_BOTTOM) return;
    page = doc.addPage(PAGE);
    accent();
    y = top;
    label("Relevé de prestation", MARGIN, y);
    textRight(data.reference, RIGHT, y, { size: 9, bold: true });
    y -= 44;
    if (table) tableHeader();
  };

  tableHeader();
  if (!data.lineItems.length) {
    text("Aucune ligne détaillée pour ce relevé.", MARGIN, y, { size: 9.5, color: MUTED });
    y -= 22;
  }
  for (const [index, line] of data.lineItems.entries()) {
    const parts = wrap(line.label, LABEL_WIDTH, { size: 9.5 });
    ensureRoom(Math.min(parts.length, 3) * 14 + 10, true);
    for (const [partIndex, part] of parts.entries()) {
      ensureRoom(14, true);
      text(part, MARGIN, y, { size: 9.5 });
      if (partIndex === 0) {
        textRight(String(line.quantity), COL_QTY, y, { size: 9.5, color: MUTED });
        textRight(money(line.amount), COL_UNIT, y, { size: 9.5, color: MUTED });
        textRight(money(line.amount * line.quantity), RIGHT, y, { size: 9.5 });
      }
      y -= 14;
    }
    y -= 6;
    if (index < data.lineItems.length - 1) hairline(y + 8);
    y -= 8;
  }

  // ── Total ──
  ensureRoom(64);
  y -= 6;
  hairline(y + 8, MARGIN, RIGHT, RULE, 0.6);
  const totalLeft = COL_QTY - 40;
  roundedRect(page, totalLeft, y - 40, RIGHT - totalLeft, 40, 8, PALE);
  text(data.paidAt ? "Total réglé" : "Total à régler", totalLeft + 14, y - 24, { size: 10, bold: true });
  textRight(money(data.amount), RIGHT - 14, y - 25.5, { size: 15, bold: true });
  y -= 40;

  // ── Notes ──
  const note = (title: string, value: string, color: Color) => {
    const parts = wrap(value, RIGHT - MARGIN - 14, { size: 9 });
    ensureRoom(40);
    y -= 34;
    label(title, MARGIN, y);
    y -= 16;
    const start = y + 10;
    for (const part of parts) { ensureRoom(14); text(part, MARGIN + 14, y, { size: 9, color }); y -= 13; }
    page.drawRectangle({ x: MARGIN, y: y + 9, width: 2, height: Math.max(start - y - 9, 10), color: MINT });
  };
  if (data.notes) note("Note", data.notes, INK);
  if (data.footerNote) note("Message", data.footerNote, MUTED);

  // ── Pied de page : édité avec TutelLiv, mention légale, pagination ──
  const logoWidth = 50;
  const logoHeight = (tutelliv.height / tutelliv.width) * logoWidth;
  for (const [index, current] of doc.getPages().entries()) {
    page = current;
    hairline(68);
    page.drawImage(tutelliv, { x: MARGIN, y: 42, width: logoWidth, height: logoHeight });
    text("Relevé édité avec TutelLiv", MARGIN + logoWidth + 10, 48, { size: 7.5, color: MUTED });
    textRight(`Page ${index + 1}/${doc.getPageCount()}`, RIGHT, 48, { size: 7.5, color: MUTED });
    text("Document de suivi opérationnel — ne constitue pas une facture électronique réglementaire.", MARGIN, 28, { size: 6.5, color: SOFT });
  }

  return doc.save();
}
