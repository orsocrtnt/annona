import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, type PDFObject } from "pdf-lib";

// WinAnsi diffère du Latin-1 sur 0x80-0x9F (€, ’, —…).
const WIN_ANSI: Record<number, string> = { 0x80: "€", 0x92: "’", 0x96: "–", 0x97: "—", 0x9c: "œ" };
const decodeWinAnsi = (bytes: Buffer) => [...bytes].map((byte) => WIN_ANSI[byte] ?? String.fromCharCode(byte)).join("");

const streamText = (stream: PDFRawStream) => {
  const raw = Buffer.from(stream.getContents());
  try { return inflateSync(raw).toString("latin1"); } catch { return raw.toString("latin1"); }
};

const utf16 = (hex: string) => Buffer.from(hex, "hex").swap16().toString("utf16le");

/** Table ToUnicode (bfchar et bfrange) d'une police embarquée : code hexadécimal → texte. */
function parseToUnicode(cmap: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const [, code, text] of block[1]!.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(code!.toUpperCase(), utf16(text!));
  }
  for (const block of block_ranges(cmap)) {
    const [start, end, text] = block;
    const width = start.length;
    for (let code = parseInt(start, 16), i = 0; code <= parseInt(end, 16); code++, i++) {
      const first = parseInt(text.slice(-4), 16) + i;
      map.set(code.toString(16).toUpperCase().padStart(width, "0"), utf16(text.slice(0, -4) + first.toString(16).padStart(4, "0")));
    }
  }
  return map;
}

function block_ranges(cmap: string): Array<[string, string, string]> {
  const ranges: Array<[string, string, string]> = [];
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const [, start, end, text] of block[1]!.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) ranges.push([start!, end!, text!]);
  }
  return ranges;
}

type FontDecoder = (hex: string) => string;

function decoderFor(doc: PDFDocument, fontObject: PDFObject | undefined): FontDecoder {
  const font = fontObject instanceof PDFRef ? doc.context.lookup(fontObject) : fontObject;
  const toUnicode = font instanceof PDFDict ? font.get(PDFName.of("ToUnicode")) : undefined;
  const stream = toUnicode instanceof PDFRef ? doc.context.lookup(toUnicode) : undefined;
  if (stream instanceof PDFRawStream) {
    const map = parseToUnicode(streamText(stream));
    const width = Math.max(...[...map.keys()].map((key) => key.length), 4);
    return (hex) => (hex.toUpperCase().match(new RegExp(`.{1,${width}}`, "g")) ?? []).map((code) => map.get(code) ?? "?").join("");
  }
  // Police standard de pdf-lib : chaînes WinAnsi.
  return (hex) => decodeWinAnsi(Buffer.from(hex, "hex"));
}

/**
 * Texte affiché (opérateurs Tj hexadécimaux de pdf-lib), fragments séparés par « | ». Polices standard
 * (WinAnsi) et polices embarquées (CID, table ToUnicode, variante Factur-X PDF/A-3b) : la police active
 * est suivie par l'opérateur Tf de chaque page.
 */
export async function pdfText(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const parts: string[] = [];
  for (const page of doc.getPages()) {
    const fonts = page.node.Resources()?.lookupMaybe(PDFName.of("Font"), PDFDict);
    const decoders = new Map<string, FontDecoder>();
    const decoder = (name: string) => {
      if (!decoders.has(name)) decoders.set(name, decoderFor(doc, fonts?.get(PDFName.of(name))));
      return decoders.get(name)!;
    };
    const contents = page.node.Contents();
    const streams = contents instanceof PDFArray
      ? contents.asArray().map((ref) => doc.context.lookup(ref))
      : [contents];
    let current = decoder("");
    for (const stream of streams) {
      if (!(stream instanceof PDFRawStream)) continue;
      for (const token of streamText(stream).matchAll(/\/([^\s/]+)\s+[\d.]+\s+Tf|<([0-9A-Fa-f]+)>\s*Tj/g)) {
        if (token[1]) current = decoder(token[1]);
        else parts.push(current(token[2]!));
      }
    }
  }
  return parts.join(" | ");
}
