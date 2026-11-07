/**
 * FACT-1 (CLI-10) — relevé de factures d'un commerçant pour une période : une ligne par facture
 * (numéro, période, échéance, TTC, réglé, reste, statut de règlement) et les totaux. Même identité
 * visuelle que la facture (invoice-pdf.ts), polices standard, pagination.
 */
import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { ANNONA_LOGO_PNG_BASE64 } from "@/lib/pdf/annona-logo";

export interface StatementPdfData {
  companyName: string;
  companyEmail?: string | null;
  companyLogoPng?: Uint8Array | null;
  merchantName: string;
  periodLabel: string;
  issuedAt: Date;
  invoices: Array<{
    reference: string;
    period: string;
    issuedAt: string;
    dueDate: string | null;
    total: number;
    paid: number;
    remaining: number;
    status: string;
  }>;
  totals: { total: number; paid: number; remaining: number };
}

const INK = rgb(0.055, 0.075, 0.063);
const MINT = rgb(0, 0.831, 0.416);
const MUTED = rgb(0.408, 0.447, 0.42);
const SOFT = rgb(0.58, 0.612, 0.592);
const PALE = rgb(0.957, 0.98, 0.965);
const HAIRLINE = rgb(0.902, 0.918, 0.906);
const RULE = rgb(0.78, 0.8, 0.788);

const PAGE: [number, number] = [595, 842];
const MARGIN = 56;
const RIGHT = PAGE[0] - MARGIN;
const BOTTOM = 96;
const COL_PERIOD = MARGIN + 92;
const COL_DUE = MARGIN + 200;
const COL_TOTAL = MARGIN + 340;
const COL_PAID = MARGIN + 412;

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const money = (value: number) => (Number.isFinite(value) ? currency.format(value) : "—");
const day = (value: Date | string | null) =>
  value ? new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" }) : "—";

export async function generateStatementPdf(data: StatementPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Relevé de factures — ${data.periodLabel}`);
  doc.setCreator("Annona");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const supported = new Set(font.getCharacterSet());
  const annona = await doc.embedPng(Buffer.from(ANNONA_LOGO_PNG_BASE64, "base64"));
  let logo: PDFImage | null = null;
  if (data.companyLogoPng?.length) logo = await doc.embedPng(data.companyLogoPng).catch(() => null);

  const sanitize = (value: string) =>
    [...value.replace(/[   ]/g, " ")].map((c) => (supported.has(c.codePointAt(0)!) ? c : "?")).join("");
  let page: PDFPage = doc.addPage(PAGE);
  type Opts = { size?: number; bold?: boolean; color?: Color };
  const f = (opts?: Opts): PDFFont => (opts?.bold ? bold : font);
  const width = (value: string, opts?: Opts) => f(opts).widthOfTextAtSize(sanitize(value), opts?.size ?? 9);
  const text = (value: string, x: number, y: number, opts?: Opts) =>
    page.drawText(sanitize(value), { x, y, size: opts?.size ?? 9, font: f(opts), color: opts?.color ?? INK });
  const textRight = (value: string, xRight: number, y: number, opts?: Opts) => text(value, xRight - width(value, opts), y, opts);
  const label = (value: string, x: number, y: number) => text(value.toUpperCase(), x, y, { size: 7, bold: true, color: SOFT });
  const labelRight = (value: string, xRight: number, y: number) => textRight(value.toUpperCase(), xRight, y, { size: 7, bold: true, color: SOFT });
  const hairline = (y: number, color = HAIRLINE) => page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.6, color });
  const accent = () => page.drawRectangle({ x: 0, y: PAGE[1] - 4, width: PAGE[0], height: 4, color: MINT });

  // ── En-tête ──
  accent();
  const top = 790;
  if (logo) {
    const scale = Math.min(150 / logo.width, 46 / logo.height, 1);
    page.drawImage(logo, { x: MARGIN, y: top + 8 - logo.height * scale, width: logo.width * scale, height: logo.height * scale });
  } else {
    text(data.companyName || "Entreprise", MARGIN, top - 10, { size: 16, bold: true });
  }
  labelRight("Relevé de factures", RIGHT, top);
  textRight(data.periodLabel, RIGHT, top - 18, { size: 12, bold: true });

  let y = top - 78;
  label("Client", MARGIN, y);
  label("Émis par", MARGIN + 200, y);
  label("Édité le", MARGIN + 380, y);
  y -= 16;
  text(data.merchantName, MARGIN, y, { size: 10, bold: true });
  text(data.companyName, MARGIN + 200, y, { size: 10, bold: true });
  text(day(data.issuedAt), MARGIN + 380, y, { size: 10 });
  if (data.companyEmail) text(data.companyEmail, MARGIN + 200, y - 13, { size: 8.5, color: MUTED });
  y -= 44;

  // ── Tableau ──
  const header = () => {
    label("Facture", MARGIN, y);
    label("Période", COL_PERIOD, y);
    label("Échéance", COL_DUE, y);
    labelRight("TTC", COL_TOTAL, y);
    labelRight("Réglé", COL_PAID, y);
    labelRight("Reste", RIGHT, y);
    y -= 9;
    hairline(y, RULE);
    y -= 18;
  };
  const newPage = () => {
    page = doc.addPage(PAGE);
    accent();
    y = top;
    label(`Relevé de factures — ${data.periodLabel}`, MARGIN, y);
    y -= 36;
    header();
  };
  header();
  if (data.invoices.length === 0) {
    text("Aucune facture sur cette période.", MARGIN, y, { size: 9.5, color: MUTED });
    y -= 22;
  }
  for (const invoice of data.invoices) {
    if (y - 28 < BOTTOM) newPage();
    text(invoice.reference, MARGIN, y, { size: 9, bold: true });
    text(invoice.period, COL_PERIOD, y, { size: 9 });
    text(day(invoice.dueDate), COL_DUE, y, { size: 9, color: MUTED });
    textRight(money(invoice.total), COL_TOTAL, y, { size: 9 });
    textRight(money(invoice.paid), COL_PAID, y, { size: 9, color: MUTED });
    textRight(money(invoice.remaining), RIGHT, y, { size: 9, bold: invoice.remaining > 0 });
    text(`${invoice.status} · émise le ${day(invoice.issuedAt)}`, MARGIN, y - 11, { size: 7.5, color: MUTED });
    y -= 22;
    hairline(y + 8);
    y -= 4;
  }

  // ── Totaux ──
  if (y - 60 < BOTTOM) newPage();
  y -= 8;
  const left = COL_DUE + 40;
  const box = 46;
  page.drawRectangle({ x: left, y: y - box, width: RIGHT - left, height: box, color: PALE });
  text("Total TTC", left + 12, y - 16, { size: 9, color: MUTED });
  textRight(money(data.totals.total), RIGHT - 12, y - 16, { size: 9 });
  text("Reste à régler", left + 12, y - 34, { size: 10, bold: true });
  textRight(money(data.totals.remaining), RIGHT - 12, y - 35, { size: 13, bold: true });
  y -= box + 18;
  text(`Déjà réglé sur la période : ${money(data.totals.paid)}`, left, y, { size: 8.5, color: MUTED });

  // ── Pied de page ──
  const logoWidth = 50;
  const logoHeight = (annona.height / annona.width) * logoWidth;
  for (const [index, current] of doc.getPages().entries()) {
    page = current;
    hairline(68);
    page.drawImage(annona, { x: MARGIN, y: 42, width: logoWidth, height: logoHeight });
    text("Relevé édité avec Annona", MARGIN + logoWidth + 10, 48, { size: 7.5, color: MUTED });
    textRight(`Page ${index + 1}/${doc.getPageCount()}`, RIGHT, 48, { size: 7.5, color: MUTED });
    text("Récapitulatif sans valeur de facture : chaque facture porte son détail et ses mentions légales.", MARGIN, 28, { size: 6.5, color: SOFT });
  }
  return doc.save();
}
