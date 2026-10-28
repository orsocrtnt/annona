/**
 * Transforme un PDF existant en PDF Factur-X : XML CII embarqué (fichier associé /AF),
 * métadonnées XMP PDF/A-3 + extension Factur-X, OutputIntent sRGB et identifiant /ID.
 * Les pages et leurs flux de contenu ne sont pas modifiés : le rendu visuel reste identique.
 *
 * Limite connue : le relevé utilise les polices standard non embarquées (Helvetica) de pdf-lib.
 * PDF/A-3b exige des polices embarquées : le fichier produit s'en approche mais n'est PAS
 * PDF/A-3b strict. Voir docs/FACTURX.md, « Limites ».
 */
import { createHash } from "node:crypto";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { buildSrgbIccProfile } from "@/lib/pdf/srgb-icc";

export const FACTURX_FILENAME = "factur-x.xml";
const PRODUCER = "TutelLiv (pdf-lib)";
const FX_NAMESPACE = "urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#";

export interface FacturXPdfOptions {
  xml: string;
  /** Date de production du fichier (Info, XMP, fichier embarqué). Injectée pour des sorties reproductibles. */
  documentDate: Date;
  /** Niveau Factur-X déclaré dans le XMP. */
  conformanceLevel?: "EN 16931";
}

const escapeXmp = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const isoSeconds = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

function fxProperty(name: string, description: string) {
  return `<rdf:li rdf:parseType="Resource">
            <pdfaProperty:name>${name}</pdfaProperty:name>
            <pdfaProperty:valueType>Text</pdfaProperty:valueType>
            <pdfaProperty:category>external</pdfaProperty:category>
            <pdfaProperty:description>${description}</pdfaProperty:description>
          </rdf:li>`;
}

export function buildFacturXXmp(input: { title: string; producer: string; creator: string; date: Date; conformanceLevel: string }): string {
  const date = isoSeconds(input.date);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXmp(input.title)}</rdf:li></rdf:Alt></dc:title>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>${escapeXmp(input.producer)}</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>${escapeXmp(input.creator)}</xmp:CreatorTool>
      <xmp:CreateDate>${date}</xmp:CreateDate>
      <xmp:ModifyDate>${date}</xmp:ModifyDate>
      <xmp:MetadataDate>${date}</xmp:MetadataDate>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>${FX_NAMESPACE}</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
          ${fxProperty("DocumentFileName", "The name of the embedded XML document")}
          ${fxProperty("DocumentType", "The type of the hybrid document in capital letters, e.g. INVOICE or ORDER")}
          ${fxProperty("Version", "The actual version of the standard applying to the embedded XML document")}
          ${fxProperty("ConformanceLevel", "The conformance level of the embedded XML document")}
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:fx="${FX_NAMESPACE}">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${input.conformanceLevel}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function embedFacturXInPdf(pdfBytes: Uint8Array, options: FacturXPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const { context, catalog } = doc;
  if (catalog.get(PDFName.of("AF"))) throw new Error("FACTURX_ALREADY_EMBEDDED");

  const xmlBytes = new TextEncoder().encode(options.xml);
  const date = options.documentDate;
  const title = doc.getTitle() ?? FACTURX_FILENAME;
  const creator = doc.getCreator() ?? "TutelLiv";

  // Dictionnaire Info aligné sur le XMP.
  doc.setTitle(title);
  doc.setCreator(creator);
  doc.setProducer(PRODUCER);
  doc.setCreationDate(date);
  doc.setModificationDate(date);

  // Fichier associé factur-x.xml.
  const embeddedRef = context.register(
    context.flateStream(xmlBytes, {
      Type: "EmbeddedFile",
      Subtype: "text/xml",
      Params: { Size: xmlBytes.length, ModDate: PDFString.fromDate(date) },
    })
  );
  const fileSpecRef = context.register(
    context.obj({
      Type: "Filespec",
      F: PDFString.of(FACTURX_FILENAME),
      UF: PDFHexString.fromText(FACTURX_FILENAME),
      EF: { F: embeddedRef, UF: embeddedRef },
      Desc: PDFString.of("Factur-X"),
      AFRelationship: "Data",
    })
  );
  const names = catalog.lookupMaybe(PDFName.of("Names"), PDFDict) ?? context.obj({});
  names.set(PDFName.of("EmbeddedFiles"), context.obj({ Names: [PDFString.of(FACTURX_FILENAME), fileSpecRef] }));
  catalog.set(PDFName.of("Names"), names);
  catalog.set(PDFName.of("AF"), context.obj([fileSpecRef]));

  // OutputIntent sRGB.
  const iccRef = context.register(context.flateStream(buildSrgbIccProfile(), { N: 3 }));
  const intentRef = context.register(
    context.obj({
      Type: "OutputIntent",
      S: "GTS_PDFA1",
      OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
      Info: PDFString.of("sRGB IEC61966-2.1"),
      RegistryName: PDFString.of("http://www.color.org"),
      DestOutputProfile: iccRef,
    })
  );
  catalog.set(PDFName.of("OutputIntents"), context.obj([intentRef]));

  // XMP non compressé.
  const xmp = buildFacturXXmp({ title, producer: PRODUCER, creator, date, conformanceLevel: options.conformanceLevel ?? "EN 16931" });
  const metadataRef = context.register(context.stream(new TextEncoder().encode(xmp), { Type: "Metadata", Subtype: "XML" }));
  catalog.set(PDFName.of("Metadata"), metadataRef);

  // Identifiant de fichier stable, dérivé du contenu XML.
  const id = createHash("sha256").update(xmlBytes).digest("hex").slice(0, 32);
  context.trailerInfo.ID = context.obj([PDFHexString.of(id), PDFHexString.of(id)]) as PDFArray;

  return doc.save({ useObjectStreams: false });
}
