import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { TUTELLIV_LOGO_PNG_BASE64 } from "@/lib/pdf/tutelliv-logo";

export interface ProofPdfData {
  deliveryId: string;
  reference: string;
  outcome: "DELIVERED" | "FAILED";
  companyName: string;
  /** PNG du logo de l'entreprise (déjà normalisé) ; à défaut, son nom en tête. */
  companyLogoPng?: Uint8Array | null;
  orderReference?: string | null;
  /** Donneur d'ordre. */
  customerName?: string | null;
  customerEmail?: string | null;
  pickupAddress?: string | null;
  deliveryAddress: string;
  driverName?: string | null;
  /** Prise en charge : démarrage de la mission par le livreur. */
  pickedUpAt?: Date | null;
  /** Livraison (ou tentative) : instant de saisie de la preuve. */
  completedAt: Date | null;
  /** Dernière position connue du livreur au moment de la livraison. */
  position?: { latitude: number; longitude: number; at: Date | null } | null;
  recipientName?: string | null;
  signaturePng?: Uint8Array | null;
  signatureRefusedReason?: string | null;
  failureLabel?: string | null;
  note?: string | null;
  photo?: Uint8Array | null;
  generatedAt: Date;
}

const INK = rgb(0.055, 0.075, 0.063);
const BRAND = rgb(0.031, 0.471, 0.247);
const MUTED = rgb(0.408, 0.447, 0.42);
const HAIRLINE = rgb(0.902, 0.918, 0.906);
const FAIL = rgb(0.702, 0.208, 0.165);

const PAGE: [number, number] = [595, 842];
const MARGIN = 56;
const RIGHT = PAGE[0] - MARGIN;
const WIDTH = RIGHT - MARGIN;
const BOTTOM = 70;

const REPLACEMENTS: Record<string, string> = {
  "’": "'", "‘": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", " ": " ", " ": " ", "œ": "oe", "Œ": "OE",
};

/** Les polices standard PDF n'encodent que le latin : tout autre caractère devient « ? » plutôt que de faire échouer le document. */
export function pdfSafeText(value: string): string {
  return [...value.replace(/[\r\n\t]+/g, " ")]
    .map((char) => {
      if (REPLACEMENTS[char]) return REPLACEMENTS[char]!;
      const code = char.codePointAt(0)!;
      return (code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || char === "€" ? char : "?";
    })
    .join("");
}

function dateTime(value: Date | null | undefined): string {
  if (!value || Number.isNaN(value.getTime())) return "Non renseigné";
  return `${value.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Paris" })} (heure de Paris)`;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of pdfSafeText(text).split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  try {
    return isJpeg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
  } catch {
    return null;
  }
}

/** PDF de preuve de livraison : référence, adresses, horodatages, position, réceptionnaire, signature et photo. */
export async function buildProofPdf(data: ProofPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafeText(`Preuve de livraison ${data.reference}`));
  doc.setProducer("TutelLiv");
  doc.setCreationDate(data.generatedAt);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const tutelliv = await doc.embedPng(Buffer.from(TUTELLIV_LOGO_PNG_BASE64, "base64"));
  const companyLogo = data.companyLogoPng ? await doc.embedPng(data.companyLogoPng).catch(() => null) : null;

  let page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
  };
  const text = (value: string, x: number, size: number, options: { bold?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(pdfSafeText(value), { x, y, size, font: options.bold ? bold : regular, color: options.color ?? INK });
  };
  const paragraph = (value: string, size = 10, options: { bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const x = options.x ?? MARGIN;
    for (const line of wrap(value, options.bold ? bold : regular, size, RIGHT - x)) {
      ensure(size + 4);
      y -= size + 4;
      text(line, x, size, options);
    }
  };
  const section = (title: string) => {
    ensure(40);
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.6, color: HAIRLINE });
    y -= 6;
    paragraph(title.toUpperCase(), 8.5, { bold: true, color: MUTED });
  };
  const field = (label: string, value: string) => {
    paragraph(label, 8.5, { color: MUTED });
    paragraph(value, 10.5);
  };

  // En-tête : logo de l'entreprise (ou son nom) à gauche, résultat à droite.
  if (companyLogo) {
    const scale = Math.min(1, 150 / companyLogo.width, 44 / companyLogo.height);
    const height = companyLogo.height * scale;
    page.drawImage(companyLogo, { x: MARGIN, y: y - height, width: companyLogo.width * scale, height });
    y -= height;
  } else {
    y -= 18;
    text(data.companyName, MARGIN, 16, { bold: true });
  }
  const delivered = data.outcome === "DELIVERED";
  const badge = delivered ? "LIVRAISON EFFECTUÉE" : "LIVRAISON NON EFFECTUÉE";
  const badgeWidth = bold.widthOfTextAtSize(pdfSafeText(badge), 9) + 16;
  page.drawRectangle({ x: RIGHT - badgeWidth, y: y - 4, width: badgeWidth, height: 20, color: delivered ? rgb(0.886, 0.973, 0.922) : rgb(0.996, 0.906, 0.894) });
  page.drawText(pdfSafeText(badge), { x: RIGHT - badgeWidth + 8, y: y + 2, size: 9, font: bold, color: delivered ? BRAND : FAIL });
  y -= 34;
  text("Preuve de livraison", MARGIN, 22, { bold: true });
  y -= 6;
  paragraph(`Référence ${data.reference}${data.orderReference ? ` - commande ${data.orderReference}` : ""}`, 11, { color: MUTED });

  section("Donneur d'ordre");
  field("Nom", data.customerName || "Non renseigné");
  if (data.customerEmail) field("E-mail", data.customerEmail);

  section("Adresses");
  if (data.pickupAddress) field("Enlèvement", data.pickupAddress);
  field("Livraison", data.deliveryAddress);
  if (data.driverName) field("Livreur", data.driverName);

  section("Horodatage");
  field("Prise en charge", dateTime(data.pickedUpAt));
  field(delivered ? "Livraison" : "Tentative de livraison", dateTime(data.completedAt));
  if (data.position) {
    const { latitude, longitude, at } = data.position;
    field(
      "Dernière position connue du livreur",
      `${latitude.toFixed(5)}, ${longitude.toFixed(5)}${at ? ` - relevée le ${dateTime(at)}` : ""}`
    );
  }

  if (!delivered) {
    section("Motif de l'échec");
    paragraph(data.failureLabel || "Non précisé", 11, { bold: true, color: FAIL });
    if (data.note) paragraph(data.note, 10);
  } else {
    section("Réception");
    field("Réceptionnaire", data.recipientName || "Non renseigné");
    const signature = data.signaturePng ? await embedImage(doc, data.signaturePng) : null;
    if (signature) {
      const scale = Math.min(1, 220 / signature.width, 90 / signature.height);
      const width = signature.width * scale;
      const height = signature.height * scale;
      ensure(height + 24);
      paragraph("Signature", 8.5, { color: MUTED });
      y -= height + 4;
      page.drawRectangle({ x: MARGIN, y, width: width + 8, height: height + 8, borderColor: HAIRLINE, borderWidth: 0.8 });
      page.drawImage(signature, { x: MARGIN + 4, y: y + 4, width, height });
    } else if (data.signatureRefusedReason) {
      field("Signature", `Refusée par le destinataire - motif : ${data.signatureRefusedReason}`);
    } else {
      field("Signature", "Non recueillie");
    }
    if (data.note) field("Note du livreur", data.note);
  }

  const photo = data.photo ? await embedImage(doc, data.photo) : null;
  if (photo) {
    section("Photo");
    const scale = Math.min(1, WIDTH / photo.width, 300 / photo.height);
    const width = photo.width * scale;
    const height = photo.height * scale;
    ensure(height + 12);
    y -= height + 6;
    page.drawImage(photo, { x: MARGIN, y, width, height });
  }

  // Pied de page sur chaque page.
  const logoWidth = 50;
  const logoHeight = (tutelliv.height / tutelliv.width) * logoWidth;
  const pages = doc.getPages();
  pages.forEach((target, index) => {
    target.drawLine({ start: { x: MARGIN, y: 60 }, end: { x: RIGHT, y: 60 }, thickness: 0.5, color: HAIRLINE });
    target.drawImage(tutelliv, { x: MARGIN, y: 30, width: logoWidth, height: logoHeight });
    target.drawText(pdfSafeText(`Document généré le ${dateTime(data.generatedAt)} - livraison ${data.deliveryId} - page ${index + 1}/${pages.length}`), {
      x: MARGIN + logoWidth + 10, y: 36, size: 7.5, font: regular, color: MUTED,
    });
  });

  return doc.save();
}
