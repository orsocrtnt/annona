import { inflateSync } from "node:zlib";

// WinAnsi diffère du Latin-1 sur 0x80-0x9F (€, ’, —…).
const WIN_ANSI: Record<number, string> = { 0x80: "€", 0x92: "’", 0x96: "–", 0x97: "—", 0x9c: "œ" };
const decodeWinAnsi = (bytes: Buffer) => [...bytes].map((byte) => WIN_ANSI[byte] ?? String.fromCharCode(byte)).join("");

/** Texte affiché (opérateurs Tj en hexadécimal WinAnsi de pdf-lib), flux décompressés, fragments séparés par « | ». */
export function pdfText(bytes: Uint8Array): string {
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
