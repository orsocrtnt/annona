import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface InvoicePdfData {
  reference: string;
  status: string;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  amount: number;
  lineItems: { label: string; amount: number; quantity: number }[];
  notes?: string | null;
  orderReference?: string | null;
  company: { name?: string | null; email?: string | null; address?: string | null; city?: string | null };
  customerName?: string | null;
  customerEmail?: string | null;
  footerNote?: string | null;
}

/** Rend le texte compatible avec la police standard (Latin-1) — évite tout crash d'encodage. */
function sanitize(text: string): string {
  return text
    .replace(/€/g, " EUR")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}

function money(value: number): string {
  return `${value.toFixed(2)} EUR`;
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  let page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  const right = 545;
  const muted = rgb(0.45, 0.45, 0.45);
  const dark = rgb(0.1, 0.1, 0.1);
  let y = 792;

  const text = (
    value: string,
    x: number,
    yPos: number,
    opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }
  ) => {
    page.drawText(sanitize(value), {
      x,
      y: yPos,
      size: opts?.size ?? 10,
      font: opts?.bold ? bold : font,
      color: opts?.color ?? dark,
    });
  };

  const textRight = (
    value: string,
    xRight: number,
    yPos: number,
    opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb> }
  ) => {
    const clean = sanitize(value);
    const size = opts?.size ?? 10;
    const f = opts?.bold ? bold : font;
    const width = f.widthOfTextAtSize(clean, size);
    page.drawText(clean, { x: xRight - width, y: yPos, size, font: f, color: opts?.color ?? dark });
  };

  // En-tête
  text(data.company.name ?? "Entreprise", margin, y, { size: 18, bold: true });
  textRight("RELEVE DE PRESTATION", right, y, { size: 12, bold: true });
  y -= 22;
  if (data.company.address) {
    text(`${data.company.address}${data.company.city ? `, ${data.company.city}` : ""}`, margin, y, { color: muted });
    y -= 14;
  }
  if (data.company.email) {
    text(data.company.email, margin, y, { color: muted });
  }
  textRight(data.reference, right, y + (data.company.address ? 14 : 0), { size: 11, color: muted });

  y -= 40;

  // Méta
  text("Créé le", margin, y, { color: muted });
  text(formatDate(data.createdAt), margin + 90, y);
  if (data.dueDate) {
    text("Échéance", margin + 220, y, { color: muted });
    text(formatDate(data.dueDate), margin + 300, y);
  }
  y -= 16;
  text("Statut", margin, y, { color: muted });
  text(data.status, margin + 90, y);
  if (data.orderReference) {
    text("Commande", margin + 220, y, { color: muted });
    text(data.orderReference, margin + 300, y);
  }
  y -= 30;

  // Client du relevé opérationnel.
  if (data.customerName || data.customerEmail) {
    text("Client", margin, y, { bold: true });
    y -= 16;
    if (data.customerName) {
      text(data.customerName, margin, y);
      y -= 14;
    }
    if (data.customerEmail) {
      text(data.customerEmail, margin, y, { color: muted });
      y -= 14;
    }
    y -= 14;
  }

  // En-tête tableau
  page.drawRectangle({ x: margin, y: y - 4, width: right - margin, height: 22, color: rgb(0.96, 0.96, 0.97) });
  text("Désignation", margin + 8, y + 4, { bold: true });
  textRight("Qté", margin + 360, y + 4, { bold: true });
  textRight("Montant", right - 8, y + 4, { bold: true });
  y -= 24;

  const ensureRoom = (height: number, table = false) => {
    if (y - height >= 90) return;
    page = doc.addPage([595, 842]);
    y = 792;
    text(`Relevé de prestation - ${data.reference}`, margin, y, { bold: true });
    y -= 28;
    if (table) {
      text("Désignation (suite)", margin + 8, y, { bold: true });
      textRight("Qté", margin + 360, y, { bold: true });
      textRight("Montant", right - 8, y, { bold: true });
      y -= 24;
    }
  };
  const wrap = (value: string, width: number): string[] => {
    const result: string[] = [];
    for (const paragraph of sanitize(value).split(/\r?\n/)) {
      let current = "";
      for (const character of paragraph) {
        if (font.widthOfTextAtSize(current + character, 9) > width && current) {
          result.push(current); current = "";
        }
        current += character;
      }
      result.push(current);
    }
    return result;
  };

  // Long labels and notes continue on further pages, without silently dropping rows.
  for (const line of data.lineItems) {
    const parts = wrap(line.label, 300);
    for (let index = 0; index < parts.length; index++) {
      ensureRoom(14, true);
      text(parts[index]!, margin + 8, y, { size: 9 });
      if (index === 0) {
        textRight(String(line.quantity), margin + 360, y, { size: 9 });
        textRight(money(line.amount * line.quantity), right - 8, y, { size: 9 });
      }
      y -= 14;
    }
    y -= 4;
  }

  ensureRoom(50);
  y -= 6;
  page.drawLine({ start: { x: margin, y }, end: { x: right, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 22;
  textRight("Total", margin + 360, y, { bold: true, size: 12 });
  textRight(money(data.amount), right - 8, y, { bold: true, size: 12 });

  // Notes + pied de page
  if (data.notes) {
    ensureRoom(68);
    y -= 40;
    text("Note", margin, y, { color: muted });
    y -= 14;
    for (const part of wrap(data.notes, right - margin)) {
      ensureRoom(14); text(part, margin, y, { size: 9 }); y -= 14;
    }
  }
  if (data.footerNote) {
    y -= 20;
    for (const part of wrap(data.footerNote, right - margin)) {
      ensureRoom(14); text(part, margin, y, { size: 9, color: muted }); y -= 14;
    }
  }
  for (const [index, currentPage] of doc.getPages().entries()) {
    page = currentPage;
    text("Document de suivi operationnel - ne constitue pas une facture electronique reglementaire.", margin, 50, { size: 8, color: muted });
    text(`Page ${index + 1}/${doc.getPageCount()}`, margin, 36, { size: 8, color: muted });
  }

  return doc.save();
}
