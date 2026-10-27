import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
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
const PALE = rgb(0.937, 0.984, 0.957); // #effbf4
const BORDER = rgb(0.894, 0.91, 0.898); // #e4e8e5

const STATUS_TONE: Record<string, { fill: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> }> = {
  PAID: { fill: rgb(0.835, 0.961, 0.89), text: BRAND },
  PENDING: { fill: rgb(0.992, 0.957, 0.894), text: rgb(0.478, 0.329, 0.063) },
  OVERDUE: { fill: rgb(0.992, 0.89, 0.878), text: rgb(0.702, 0.208, 0.165) },
};

const PAGE: [number, number] = [595, 842];
const MARGIN = 48;
const RIGHT = 547;
const CONTENT_BOTTOM = 96;

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
}

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
/** « 59,90 € » ; « — » si le montant n'est pas lisible (jamais « NaN »). */
function money(value: number): string {
  return Number.isFinite(value) ? currency.format(value) : "—";
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
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
    [...value.replace(/[   ]/g, " ")]
      .map((character) => (character === "\n" || supported.has(character.codePointAt(0)!) ? character : "?"))
      .join("");

  let page: PDFPage = doc.addPage(PAGE);
  type TextOptions = { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> };
  const fontOf = (opts?: TextOptions): PDFFont => (opts?.bold ? bold : font);
  const text = (value: string, x: number, y: number, opts?: TextOptions) => {
    page.drawText(sanitize(value), { x, y, size: opts?.size ?? 10, font: fontOf(opts), color: opts?.color ?? INK });
  };
  const textRight = (value: string, xRight: number, y: number, opts?: TextOptions) => {
    const clean = sanitize(value);
    const size = opts?.size ?? 10;
    const width = fontOf(opts).widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: xRight - width, y, size, font: fontOf(opts), color: opts?.color ?? INK });
  };
  const wrap = (value: string, width: number, size = 9): string[] => {
    const lines: string[] = [];
    for (const paragraph of sanitize(value).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/(\s+)/)) {
        if (font.widthOfTextAtSize(current + word, size) <= width) { current += word; continue; }
        if (current.trim()) lines.push(current.trimEnd());
        current = "";
        // Mot plus long que la colonne : coupé au caractère.
        for (const character of word.trimStart()) {
          if (font.widthOfTextAtSize(current + character, size) > width && current) { lines.push(current); current = ""; }
          current += character;
        }
      }
      lines.push(current.trimEnd());
    }
    return lines;
  };
  const wrapBold = (value: string, width: number, size: number): string[] => {
    const lines: string[] = [];
    let current = "";
    for (const word of value.split(" ")) {
      const next = current ? `${current} ${word}` : word;
      if (bold.widthOfTextAtSize(next, size) > width && current) { lines.push(current); current = word; } else current = next;
    }
    if (current) lines.push(current);
    return lines;
  };
  const band = () => page.drawRectangle({ x: 0, y: PAGE[1] - 6, width: PAGE[0], height: 6, color: MINT });

  // ── En-tête : logo (ou nom) de l'entreprise à gauche, relevé à droite ──
  band();
  const top = 800;
  let left = top;
  const companyName = data.company.name?.trim() || "Entreprise";
  if (companyLogo) {
    const scale = Math.min(170 / companyLogo.width, 56 / companyLogo.height, 1);
    const width = companyLogo.width * scale;
    const height = companyLogo.height * scale;
    page.drawImage(companyLogo, { x: MARGIN, y: top + 6 - height, width, height });
    left = top + 6 - height - 18;
    text(companyName, MARGIN, left, { bold: true, size: 11 });
  } else {
    // Le nom ne doit jamais toucher la référence à droite : taille réduite jusqu'à 11 pt, puis retour à la ligne.
    const rightWidth = Math.max(
      bold.widthOfTextAtSize(sanitize(data.reference), 14),
      bold.widthOfTextAtSize("RELEVÉ DE PRESTATION", 8.5)
    );
    const available = RIGHT - MARGIN - rightWidth - 48;
    const clean = sanitize(companyName);
    let size = 18;
    while (size > 11 && bold.widthOfTextAtSize(clean, size) > available) size -= 1;
    const lines = bold.widthOfTextAtSize(clean, size) > available ? wrapBold(clean, available, size) : [clean];
    left = top - 12;
    for (const [index, line] of lines.slice(0, 2).entries()) {
      if (index > 0) left -= size + 3;
      text(line, MARGIN, left, { bold: true, size });
    }
  }
  const contact = [
    data.company.address ? `${data.company.address}${data.company.city ? `, ${data.company.city}` : ""}` : null,
    data.company.email ?? null,
  ].filter((line): line is string => Boolean(line));
  for (const line of contact) {
    left -= 14;
    text(line, MARGIN, left, { size: 9, color: MUTED });
  }
  textRight("RELEVÉ DE PRESTATION", RIGHT, top, { bold: true, size: 8.5, color: BRAND });
  textRight(data.reference, RIGHT, top - 18, { bold: true, size: 14 });
  textRight(`Émis le ${formatDate(data.createdAt)}`, RIGHT, top - 33, { size: 9, color: MUTED });

  // ── Récapitulatif : montant, statut, échéance ──
  let y = Math.min(left, top - 33) - 30;
  const cardHeight = 62;
  page.drawRectangle({ x: MARGIN, y: y - cardHeight, width: RIGHT - MARGIN, height: cardHeight, color: PALE });
  page.drawRectangle({ x: MARGIN, y: y - cardHeight, width: 3, height: cardHeight, color: MINT });
  text("Montant total", MARGIN + 18, y - 20, { size: 8.5, color: MUTED });
  text(money(data.amount), MARGIN + 18, y - 44, { bold: true, size: 20 });

  const statusLabel = INVOICE_STATUS_LABELS[data.status as InvoiceStatus] ?? data.status;
  const tone = STATUS_TONE[data.status] ?? { fill: rgb(0.933, 0.945, 0.937), text: MUTED };
  text("Statut", MARGIN + 210, y - 20, { size: 8.5, color: MUTED });
  const pillWidth = bold.widthOfTextAtSize(sanitize(statusLabel), 9) + 18;
  page.drawRectangle({ x: MARGIN + 210, y: y - 47, width: pillWidth, height: 18, color: tone.fill });
  text(statusLabel, MARGIN + 219, y - 41.5, { bold: true, size: 9, color: tone.text });

  const dateLabel = data.paidAt ? "Payée le" : "Échéance";
  text(dateLabel, MARGIN + 350, y - 20, { size: 8.5, color: MUTED });
  text(formatDate(data.paidAt ?? data.dueDate), MARGIN + 350, y - 41, { bold: true, size: 11 });
  y -= cardHeight + 26;

  // ── Client et commande ──
  if (data.customerName || data.customerEmail) {
    text("Client", MARGIN, y, { size: 8.5, color: MUTED });
    if (data.customerName) text(data.customerName, MARGIN, y - 15, { bold: true, size: 10.5 });
    if (data.customerEmail) text(data.customerEmail, MARGIN, y - (data.customerName ? 29 : 15), { size: 9, color: MUTED });
  }
  if (data.orderReference) {
    text("Commande", MARGIN + 350, y, { size: 8.5, color: MUTED });
    text(data.orderReference, MARGIN + 350, y - 15, { bold: true, size: 10.5 });
  }
  if (data.customerName || data.customerEmail || data.orderReference) y -= 52;

  // ── Tableau des prestations ──
  const tableHeader = (label: string) => {
    page.drawRectangle({ x: MARGIN, y: y - 7, width: RIGHT - MARGIN, height: 22, color: PALE });
    text(label, MARGIN + 10, y, { bold: true, size: 8.5 });
    textRight("Qté", MARGIN + 300, y, { bold: true, size: 8.5 });
    textRight("Prix unitaire", MARGIN + 390, y, { bold: true, size: 8.5 });
    textRight("Montant", RIGHT - 10, y, { bold: true, size: 8.5 });
    y -= 24;
  };
  const ensureRoom = (height: number, table = false) => {
    if (y - height >= CONTENT_BOTTOM) return;
    page = doc.addPage(PAGE);
    band();
    y = 800;
    text(`Relevé de prestation · ${data.reference}`, MARGIN, y, { bold: true, size: 10 });
    y -= 30;
    if (table) tableHeader("Désignation (suite)");
  };

  tableHeader("Désignation");
  for (const line of data.lineItems) {
    const parts = wrap(line.label, 230);
    for (let index = 0; index < parts.length; index++) {
      ensureRoom(14, true);
      text(parts[index]!, MARGIN + 10, y, { size: 9 });
      if (index === 0) {
        textRight(String(line.quantity), MARGIN + 300, y, { size: 9 });
        textRight(money(line.amount), MARGIN + 390, y, { size: 9 });
        textRight(money(line.amount * line.quantity), RIGHT - 10, y, { size: 9 });
      }
      y -= 14;
    }
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: RIGHT, y: y + 6 }, thickness: 0.5, color: BORDER });
    y -= 4;
  }

  ensureRoom(50);
  y -= 8;
  page.drawLine({ start: { x: MARGIN + 260, y }, end: { x: RIGHT, y }, thickness: 1, color: INK });
  y -= 22;
  textRight("Total", MARGIN + 390, y, { bold: true, size: 11 });
  textRight(money(data.amount), RIGHT - 10, y, { bold: true, size: 13 });

  // ── Notes ──
  if (data.notes) {
    ensureRoom(68);
    y -= 40;
    text("Note", MARGIN, y, { size: 8.5, color: MUTED });
    y -= 14;
    for (const part of wrap(data.notes, RIGHT - MARGIN)) {
      ensureRoom(14); text(part, MARGIN, y, { size: 9 }); y -= 14;
    }
  }
  if (data.footerNote) {
    y -= 20;
    for (const part of wrap(data.footerNote, RIGHT - MARGIN)) {
      ensureRoom(14); text(part, MARGIN, y, { size: 9, color: MUTED }); y -= 14;
    }
  }

  // ── Pied de page : édité avec TutelLiv, mention légale, pagination ──
  const logoWidth = 52;
  const logoHeight = (tutelliv.height / tutelliv.width) * logoWidth;
  for (const [index, current] of doc.getPages().entries()) {
    page = current;
    page.drawLine({ start: { x: MARGIN, y: 70 }, end: { x: RIGHT, y: 70 }, thickness: 0.5, color: BORDER });
    page.drawImage(tutelliv, { x: MARGIN, y: 44, width: logoWidth, height: logoHeight });
    text("Relevé édité avec TutelLiv", MARGIN + logoWidth + 10, 49, { size: 8, color: MUTED });
    textRight(`Page ${index + 1}/${doc.getPageCount()}`, RIGHT, 49, { size: 8, color: MUTED });
    text("Document de suivi opérationnel — ne constitue pas une facture électronique réglementaire.", MARGIN, 30, { size: 7, color: MUTED });
  }

  return doc.save();
}
