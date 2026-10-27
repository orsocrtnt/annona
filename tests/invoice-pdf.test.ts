import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import test from "node:test";
import sharp from "sharp";
import { generateInvoicePdf, type InvoicePdfData } from "../src/lib/pdf/invoice-pdf";

// WinAnsi diffère du Latin-1 sur 0x80-0x9F (€, ’, —…).
const WIN_ANSI: Record<number, string> = { 0x80: "€", 0x92: "’", 0x96: "–", 0x97: "—", 0x9c: "œ" };
const decodeWinAnsi = (bytes: Buffer) => [...bytes].map((byte) => WIN_ANSI[byte] ?? String.fromCharCode(byte)).join("");

/** Texte des opérateurs Tj (chaînes hexadécimales WinAnsi de pdf-lib), flux décompressés. */
function pdfText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const parts: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let body = Buffer.from(match[1]!, "latin1");
    try { body = inflateSync(body); } catch { /* flux non compressé */ }
    for (const hex of body.toString("latin1").matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      parts.push(decodeWinAnsi(Buffer.from(hex[1]!, "hex")));
    }
  }
  return parts.join(" | ");
}
/** Images affichées : une image transparente compte aussi un masque (/SMask), qu'on retire. */
const imageCount = (bytes: Uint8Array) => {
  const raw = Buffer.from(bytes).toString("latin1");
  return (raw.match(/\/Subtype\s*\/Image/g) ?? []).length - (raw.match(/\/SMask\s+\d+\s+0\s+R/g) ?? []).length;
};

const base: InvoicePdfData = {
  reference: "FAC-DEMO-15276458",
  status: "PAID",
  createdAt: new Date("2026-10-27T09:00:00Z"),
  paidAt: new Date("2026-10-25T09:00:00Z"),
  amount: 89.9,
  lineItems: [
    { label: "Colis documents", amount: 29.95, quantity: 2 },
    { label: "Emballage fragile", amount: 30, quantity: 1 },
  ],
  orderReference: "CMD-72011242",
  company: { name: "LogiExpress", email: "contact@logiexpress.test", address: "1 rue de Paris", city: "Paris" },
  customerName: "Marie Client",
  customerEmail: "marie@example.test",
};

test("le relevé porte la marque TutelLiv en pied de page et des montants en euros", async () => {
  const pdf = await generateInvoicePdf(base);
  const content = pdfText(pdf);
  for (const expected of ["FAC-DEMO-15276458", "Relevé édité avec TutelLiv", "RELEVÉ DE PRESTATION", "Payée", "Colis documents", "59,90", "89,90", "CMD-72011242"]) {
    assert.ok(content.includes(expected), `absent : ${expected}`);
  }
  assert.doesNotMatch(content, /NaN/);
  assert.equal(imageCount(pdf), 1, "sans logo d'entreprise : seul le logo TutelLiv");
});

test("avec un logo d'entreprise, il est intégré en tête ; illisible, le relevé se génère quand même", async () => {
  const logo = await sharp({ create: { width: 480, height: 120, channels: 4, background: "#0e1310" } }).png().toBuffer();
  assert.equal(imageCount(await generateInvoicePdf({ ...base, companyLogoPng: logo })), 2);
  const broken = await generateInvoicePdf({ ...base, companyLogoPng: Buffer.from("pas un png") });
  assert.equal(imageCount(broken), 1);
  assert.ok(pdfText(broken).includes("LogiExpress"));
});

test("une ligne sans montant lisible affiche « — », jamais « NaN »", async () => {
  const pdf = await generateInvoicePdf({ ...base, lineItems: [{ label: "Ancienne ligne", amount: undefined as unknown as number, quantity: 2 }] });
  const content = pdfText(pdf);
  assert.doesNotMatch(content, /NaN/);
  assert.ok(content.includes("—"));
});
