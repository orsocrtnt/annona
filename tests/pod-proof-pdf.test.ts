import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildProofPdf, pdfSafeText, type ProofPdfData } from "../src/lib/pdf/proof-pdf";
import * as proofPdfModule from "../src/lib/pdf/proof-pdf";
import * as codes from "../src/lib/pod/codes";
import * as pdfLib from "pdf-lib";
import * as logo from "../src/lib/pdf/tutelliv-logo";

/** Texte lisible d'un PDF : décompresse les flux de contenu et lit les chaînes hexadécimales des Tj. */
async function pdfText(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image") continue;
    const decoded = Buffer.from(decodePDFRawStream(object).decode()).toString("latin1");
    for (const match of decoded.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(match[1]!, "hex").toString("latin1") + "\n";
  }
  return { text: out, doc };
}
function imageCount(doc: PDFDocument) {
  let count = 0;
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image") count += 1;
  }
  return count;
}

const base: ProofPdfData = {
  deliveryId: "d1", reference: "LIV-2026-0042", outcome: "DELIVERED", companyName: "Express Test",
  orderReference: "CMD-42", customerName: "Alice Donneur", customerEmail: "alice@example.test",
  pickupAddress: "1 rue A, 75001 Paris", deliveryAddress: "2 rue B, 69001 Lyon", driverName: "Luc Livreur",
  pickedUpAt: new Date("2026-10-28T08:00:00Z"), completedAt: new Date("2026-10-28T09:30:00Z"),
  position: { latitude: 45.76, longitude: 4.83, at: new Date("2026-10-28T09:29:00Z") },
  recipientName: "Mme Martin", generatedAt: new Date("2026-10-28T10:00:00Z"),
};

test("PDF livré : référence, donneur d'ordre, adresses, horodatages, position et réceptionnaire", async () => {
  const { text, doc } = await pdfText(await buildProofPdf(base));
  for (const expected of ["LIV-2026-0042", "Alice Donneur", "1 rue A", "2 rue B", "Prise en charge", "Mme Martin", "45.76000, 4.83000", "Express Test", "Non recueillie"]) {
    assert.ok(text.includes(expected), `absent du PDF : ${expected}`);
  }
  assert.ok(doc.getPageCount() >= 1);
});

test("PDF avec signature, photo et logo : trois images intégrées en plus du logo TutelLiv", async () => {
  const png = await sharp({ create: { width: 200, height: 80, channels: 3, background: "#ffffff" } }).png().toBuffer();
  const jpg = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#336699" } }).jpeg().toBuffer();
  const { doc, text } = await pdfText(await buildProofPdf({ ...base, signaturePng: png, photo: jpg, companyLogoPng: png }));
  const baseline = imageCount((await pdfText(await buildProofPdf(base))).doc);
  assert.equal(imageCount(doc), baseline + 3, "logo entreprise + signature + photo");
  assert.ok(!text.includes("Non recueillie"));
});

test("PDF refus de signer : motif présent ; échec : motif d'échec et pas de bloc de réception", async () => {
  const refused = await pdfText(await buildProofPdf({ ...base, signatureRefusedReason: "Refus du destinataire" }));
  assert.ok(refused.text.includes("Refus du destinataire"));
  const failed = await pdfText(await buildProofPdf({ ...base, outcome: "FAILED", failureLabel: "Destinataire absent", recipientName: null, note: "Voisin absent aussi" }));
  assert.ok(failed.text.includes("Destinataire absent"));
  assert.ok(failed.text.includes("Voisin absent aussi"));
  assert.ok(failed.text.includes("NON EFFECTU"));
  assert.ok(!failed.text.includes("Réceptionnaire"));
});

test("PDF : image illisible ou texte hors latin n'empêche pas le document", async () => {
  const { text } = await pdfText(await buildProofPdf({ ...base, customerName: "田中 太郎 ’X’", photo: Buffer.from("pas une image"), signaturePng: Buffer.from("non") }));
  assert.ok(text.includes("?"));
  assert.equal(pdfSafeText("l’été – ok…"), "l'été - ok...");
});

// --- Contrôle d'accès du service (entreprise et client) ---
function loadService(deps: Record<string, unknown>) {
  const module = { exports: {} as typeof import("../src/domains/delivery/proof.service") };
  const js = ts.transpileModule(readFileSync(resolve("src/domains/delivery/proof.service.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, {
    Buffer, Promise, Date, Error, Response, Uint8Array, Object, JSON, String, Array, exports: module.exports, module,
    require: (id: string) => { assert.ok(id in deps, `Unexpected dependency ${id}`); return deps[id]; },
  });
  return module.exports;
}

function serviceFixture(row: Record<string, unknown> | null) {
  const wheres: Record<string, unknown>[] = [];
  const service = loadService({
    "next/server": { NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init), redirect: (url: string, init?: ResponseInit) => new Response(null, { ...init, headers: { ...(init?.headers as object), Location: url } }) } },
    "@/services/prisma/client": { prisma: { delivery: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      wheres.push(where);
      if (!row) return null;
      if (where.companyId !== row.companyId) return null;
      if (where.customerId && where.customerId !== row.customerId) return null;
      return row;
    } } } },
    "@/domains/company/company-logo.service": { readCompanyLogo: async () => null },
    "@/lib/pdf/proof-pdf": proofPdfModule,
    "@/lib/pod/codes": codes,
    "@/lib/storage/pod": { downloadPodPhoto: async () => null, getPodPhotoSignedUrl: async (path: string) => (path ? "https://storage.invalid/photo?token=1" : null) },
    "@/lib/storage/pod-signature": { downloadPodSignature: async () => null, getPodSignatureSignedUrl: async (path: string) => (path ? "https://storage.invalid/sig?token=1" : null) },
    "pdf-lib": pdfLib, "@/lib/pdf/tutelliv-logo": logo,
  });
  return { service, wheres };
}

const deliveryRow = {
  id: "d1", reference: "LIV-1", companyId: "company-a", customerId: "client-a", address: "2 rue B", city: "Lyon", postalCode: "69001",
  pickupAddress: null, pickupCity: null, pickupPostalCode: null, driverName: "Luc", missionStartedAt: new Date(), completedAt: new Date(),
  podOutcome: "SUCCESS", podPhotoPath: "company-a/d1-1.jpg", podFailureCode: null, podNote: null, podCapturedAt: new Date(),
  podSignaturePath: "company-a/d1-sig-1-x.png", podRecipientName: "Mme Martin", podSignatureRefusedReason: null,
  podLatitude: null, podLongitude: null, podPositionAt: null,
  customer: { firstName: "Alice", lastName: "D", email: "a@x.test" }, order: { reference: "CMD-1", customerEmail: null },
  company: { name: "Express" }, driver: null,
};

test("preuve : le back-office de l'entreprise obtient PDF, photo et signature (URL signée en redirection)", async () => {
  const { service } = serviceFixture(deliveryRow);
  const pdf = await service.serveProofFile("pdf", { companyId: "company-a", deliveryId: "d1" });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.match(pdf.headers.get("content-disposition") ?? "", /preuve-LIV-1\.pdf/);
  assert.equal(pdf.headers.get("cache-control"), "private, no-store");
  assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString(), "%PDF-");
  for (const kind of ["photo", "signature"]) {
    const redirect = await service.serveProofFile(kind, { companyId: "company-a", deliveryId: "d1" });
    assert.equal(redirect.status, 307);
    assert.match(redirect.headers.get("location") ?? "", /^https:\/\/storage\.invalid\//);
  }
});

test("preuve : une autre entreprise est refusée (404 identique), aussi pour le PDF", async () => {
  const { service } = serviceFixture(deliveryRow);
  for (const kind of ["pdf", "photo", "signature"]) {
    assert.equal((await service.serveProofFile(kind, { companyId: "company-b", deliveryId: "d1" })).status, 404);
  }
});

test("preuve portail : seul le client propriétaire obtient le document, y compris un client de la même entreprise", async () => {
  const { service, wheres } = serviceFixture(deliveryRow);
  assert.equal((await service.serveProofFile("pdf", { companyId: "company-a", deliveryId: "d1", customerId: "client-a" })).status, 200);
  assert.equal(wheres.at(-1)?.customerId, "client-a");
  for (const kind of ["pdf", "photo", "signature"]) {
    assert.equal((await service.serveProofFile(kind, { companyId: "company-a", deliveryId: "d1", customerId: "client-b" })).status, 404);
    assert.equal((await service.serveProofFile(kind, { companyId: "company-b", deliveryId: "d1", customerId: "client-a" })).status, 404);
  }
});

test("preuve : type inconnu, livraison sans preuve ou inexistante → 404", async () => {
  const { service } = serviceFixture(deliveryRow);
  assert.equal((await service.serveProofFile("../etc/passwd", { companyId: "company-a", deliveryId: "d1" })).status, 404);
  const empty = serviceFixture({ ...deliveryRow, podOutcome: null, podPhotoPath: null, podSignaturePath: null });
  assert.equal((await empty.service.serveProofFile("pdf", { companyId: "company-a", deliveryId: "d1" })).status, 404);
  assert.equal((await empty.service.serveProofFile("photo", { companyId: "company-a", deliveryId: "d1" })).status, 404);
  assert.equal((await serviceFixture(null).service.serveProofFile("pdf", { companyId: "company-a", deliveryId: "nope" })).status, 404);
});
