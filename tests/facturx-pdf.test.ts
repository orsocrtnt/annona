import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFRef, PDFStream, PDFString } from "pdf-lib";
import sharp from "sharp";
import { embedFacturXInPdf, FACTURX_FILENAME } from "../src/lib/pdf/facturx-pdf";
import { buildSrgbIccProfile } from "../src/lib/pdf/srgb-icc";
import { generateInvoicePdf, type InvoicePdfData } from "../src/lib/pdf/invoice-pdf";

const classic: InvoicePdfData = {
  reference: "FAC-2026-0001",
  status: "PENDING",
  createdAt: new Date("2026-10-27T09:00:00Z"),
  dueDate: new Date("2026-11-26T09:00:00Z"),
  paidAt: null,
  amount: 30,
  lineItems: [
    { label: "Course Paris intra-muros", amount: 25, quantity: 1 },
    { label: "TVA (20%)", amount: 5, quantity: 1 },
  ],
  orderReference: "CMD-72011242",
  company: { name: "Coursiers Fictifs", email: "facturation@coursiers.test", address: "12 rue de l'Exemple", city: "Paris" },
  customerName: "Client Démo",
  customerEmail: "compta@client.test",
};
const XML = `<?xml version="1.0" encoding="UTF-8"?>\n<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"><!-- é & « » --></rsm:CrossIndustryInvoice>\n`;
const NOW = new Date("2026-10-28T10:00:00Z");

const streamBytes = (stream: PDFStream) => {
  const raw = (stream as PDFRawStream).getContents();
  return stream.dict.get(PDFName.of("Filter")) ? inflateSync(raw) : Buffer.from(raw);
};

async function build() {
  const original = await generateInvoicePdf(classic);
  const facturx = await embedFacturXInPdf(original, { xml: XML, documentDate: NOW });
  return { original, facturx, doc: await PDFDocument.load(facturx, { updateMetadata: false }) };
}

test("le rendu visuel est inchangé : mêmes pages, mêmes flux de contenu, mêmes ressources", async () => {
  const { original, doc } = await build();
  const before = await PDFDocument.load(original, { updateMetadata: false });
  assert.equal(doc.getPageCount(), before.getPageCount());
  doc.getPages().forEach((page, index) => {
    const prev = before.getPages()[index]!;
    assert.deepEqual(page.getMediaBox(), prev.getMediaBox());
    const contents = (p: typeof page) => {
      const value = p.node.Contents();
      const streams = value instanceof PDFArray ? value.asArray().map((ref) => p.doc.context.lookup(ref, PDFStream)) : [value as PDFStream];
      return Buffer.concat(streams.map((s) => streamBytes(s)));
    };
    assert.ok(contents(page).equals(contents(prev)), `page ${index + 1} : flux de contenu modifié`);
    const fonts = (p: typeof page) => p.node.Resources()?.lookup(PDFName.of("Font"), PDFDict).keys().map(String).sort();
    assert.deepEqual(fonts(page), fonts(prev));
  });
});

test("factur-x.xml est embarqué, référencé par /AF et marqué AFRelationship /Data", async () => {
  const { doc } = await build();
  const catalog = doc.catalog;
  const af = catalog.lookup(PDFName.of("AF"), PDFArray);
  assert.equal(af.size(), 1);
  const filespec = doc.context.lookup(af.get(0), PDFDict);
  assert.equal(String(filespec.get(PDFName.of("Type"))), "/Filespec");
  assert.equal(String(filespec.get(PDFName.of("AFRelationship"))), "/Data");
  assert.equal(filespec.lookup(PDFName.of("F"), PDFString).decodeText(), FACTURX_FILENAME);
  assert.equal(filespec.lookup(PDFName.of("UF"), PDFHexString).decodeText(), "factur-x.xml");

  const names = catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray);
  assert.equal(names.lookup(0, PDFString).decodeText(), "factur-x.xml");
  assert.equal(names.get(1).toString(), af.get(0).toString(), "le même Filespec est référencé par /AF et /EmbeddedFiles");

  const embedded = filespec.lookup(PDFName.of("EF"), PDFDict).lookup(PDFName.of("F"), PDFStream);
  assert.equal(String(embedded.dict.get(PDFName.of("Type"))), "/EmbeddedFile");
  assert.equal(embedded.dict.get(PDFName.of("Subtype"))?.toString(), "/text#2Fxml");
  const params = embedded.dict.lookup(PDFName.of("Params"), PDFDict);
  assert.equal(params.get(PDFName.of("Size"))?.toString(), String(Buffer.byteLength(XML)));
  assert.ok(params.get(PDFName.of("ModDate")), "ModDate du fichier embarqué");
  assert.equal(streamBytes(embedded).toString("utf8"), XML);
});

test("les métadonnées XMP portent PDF/A-3B et l'extension Factur-X (DocumentType, ConformanceLevel, Version)", async () => {
  const { doc } = await build();
  const metadata = doc.catalog.lookup(PDFName.of("Metadata"), PDFStream);
  assert.equal(String(metadata.dict.get(PDFName.of("Subtype"))), "/XML");
  assert.equal(metadata.dict.get(PDFName.of("Filter")), undefined, "XMP non compressé");
  const xmp = streamBytes(metadata).toString("utf8");
  for (const expected of [
    "<pdfaid:part>3</pdfaid:part>",
    "<pdfaid:conformance>B</pdfaid:conformance>",
    "<fx:DocumentType>INVOICE</fx:DocumentType>",
    "<fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>",
    "<fx:Version>1.0</fx:Version>",
    "<fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>",
    "<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>",
    "<pdfaSchema:prefix>fx</pdfaSchema:prefix>",
  ]) {
    assert.ok(xmp.includes(expected), `XMP sans ${expected}`);
  }
  // Le dictionnaire Info et le XMP doivent concorder (PDF/A).
  assert.ok(xmp.includes(`<rdf:li xml:lang="x-default">${doc.getTitle()}</rdf:li>`));
  assert.ok(xmp.includes(`<pdf:Producer>${doc.getProducer()}</pdf:Producer>`));
  assert.ok(xmp.includes("<xmp:ModifyDate>2026-10-28T10:00:00Z</xmp:ModifyDate>"));
  assert.equal(doc.getModificationDate()?.toISOString(), NOW.toISOString());
  assert.equal(doc.getTitle(), "Relevé de prestation FAC-2026-0001", "titre d'origine conservé");
});

test("un OutputIntent sRGB est présent, avec un profil ICC accepté par LittleCMS", async () => {
  const { doc } = await build();
  const intents = doc.catalog.lookup(PDFName.of("OutputIntents"), PDFArray);
  const intent = intents.lookup(0, PDFDict);
  assert.equal(String(intent.get(PDFName.of("S"))), "/GTS_PDFA1");
  assert.equal(intent.lookup(PDFName.of("OutputConditionIdentifier"), PDFString).decodeText(), "sRGB IEC61966-2.1");
  const profile = intent.lookup(PDFName.of("DestOutputProfile"), PDFStream);
  assert.equal(profile.dict.get(PDFName.of("N"))?.toString(), "3");
  const icc = streamBytes(profile);
  assert.equal(icc.readUInt32BE(0), icc.length);
  assert.equal(icc.toString("latin1", 36, 40), "acsp");
  assert.equal(icc.toString("latin1", 12, 20), "mntrRGB ");

  const dir = mkdtempSync(join(tmpdir(), "facturx-icc-"));
  try {
    const path = join(dir, "srgb.icc");
    writeFileSync(path, buildSrgbIccProfile());
    const out = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#3c8c64" } }).withIccProfile(path).png().toBuffer();
    const meta = await sharp(out).metadata();
    assert.ok(meta.icc && meta.icc.length === icc.length, "profil ICC chargé et ré-embarqué par libvips/LittleCMS");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("en-tête binaire, identifiant de fichier et génération déterministe", async () => {
  const { facturx, doc } = await build();
  const head = Buffer.from(facturx.subarray(0, 16));
  assert.equal(head.toString("latin1", 0, 8), "%PDF-1.7");
  const comment = head.subarray(head.indexOf(0x0a) + 1);
  assert.equal(comment[0], 0x25);
  assert.ok([...comment.subarray(1, 5)].every((byte) => byte > 127), "commentaire binaire PDF/A");
  const id = doc.context.trailerInfo.ID;
  assert.ok(id instanceof PDFArray && id.size() === 2, "identifiant de fichier /ID");
  const again = await embedFacturXInPdf(await generateInvoicePdf(classic), { xml: XML, documentDate: NOW });
  assert.ok(Buffer.from(again).equals(Buffer.from(facturx)));
});

/** Empreinte des flux de contenu décompressés de toutes les pages (rendu visuel). */
async function contentFingerprint(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const hash = createHash("sha256");
  for (const page of doc.getPages()) {
    const value = page.node.Contents();
    const streams = value instanceof PDFArray ? value.asArray().map((ref) => doc.context.lookup(ref, PDFStream)) : [value as PDFStream];
    for (const stream of streams) hash.update(streamBytes(stream));
  }
  return hash.digest("hex");
}

test("le PDF classique (sans variante Factur-X) garde exactement le rendu d'avant la tranche Factur-X", async () => {
  // Empreintes relevées le 6 novembre 2026, après le passage au nom et au logo Annona (rendu inchangé sinon).
  assert.equal(await contentFingerprint(await generateInvoicePdf(classic)), "90d13f5e3a2b512693146cc81e0ed14dc643a9f71900395fca995afa80d0cba0");
  const rich = { ...classic, status: "PAID", paidAt: new Date("2026-10-28T09:00:00Z"), notes: "Livré à l'accueil", footerNote: "Merci pour votre confiance." };
  assert.equal(await contentFingerprint(await generateInvoicePdf(rich)), "dfaacdbac8faf00e65dfccb5127d15dacb8870f4603524252176248e391ed01e");
});

test("un PDF qui contient déjà un factur-x.xml est refusé plutôt que doublé", async () => {
  const { facturx } = await build();
  await assert.rejects(() => embedFacturXInPdf(facturx, { xml: XML, documentDate: NOW }), /FACTURX_ALREADY_EMBEDDED/);
});

test("FACTURX-1 PDF/A-3b : la variante Factur-X embarque toutes ses polices, le relevé classique garde les polices standard", async () => {
  const legal = {
    documentLabel: "Facture",
    seller: { name: "Coursiers Fictifs SAS", lines: ["SIREN 000 000 000", "12 rue de l'Exemple, 75001 Paris"] },
    buyer: { name: "Client Démo SARL", lines: ["1 rue des Tests, 75002 Paris"] },
    mentions: ["Pénalités de retard : trois fois le taux d'intérêt légal.", "Indemnité forfaitaire de recouvrement : 40 €."],
    footer: "Coursiers Fictifs SAS — œuvre « test » …",
  };
  const fontsOf = async (bytes: Uint8Array) => {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const fonts: Array<{ base: string; embedded: boolean }> = [];
    for (const [, object] of doc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFDict) || object.get(PDFName.of("Type")) !== PDFName.of("Font")) continue;
      const subtype = object.get(PDFName.of("Subtype"));
      if (subtype === PDFName.of("CIDFontType2") || subtype === PDFName.of("Type1") || subtype === PDFName.of("TrueType")) {
        const descriptor = object.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
        const embedded = Boolean(descriptor && (descriptor.get(PDFName.of("FontFile2")) || descriptor.get(PDFName.of("FontFile")) || descriptor.get(PDFName.of("FontFile3"))));
        fonts.push({ base: String(object.get(PDFName.of("BaseFont"))), embedded });
      }
    }
    return fonts;
  };
  const facturx = await fontsOf(await generateInvoicePdf({ ...classic, legal }));
  assert.ok(facturx.length >= 2, "au moins une police normale et une grasse");
  assert.ok(facturx.every((font) => font.embedded), JSON.stringify(facturx));
  assert.ok(facturx.every((font) => /LiberationSans/.test(font.base)), JSON.stringify(facturx));
  const standard = await fontsOf(await generateInvoicePdf(classic));
  assert.ok(standard.length >= 2 && standard.every((font) => !font.embedded && /Helvetica/.test(font.base)), JSON.stringify(standard));
});
