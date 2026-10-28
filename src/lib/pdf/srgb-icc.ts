/**
 * Profil ICC v2 « sRGB IEC61966-2.1 » (matrice + courbes), construit en code pour
 * l'OutputIntent PDF/A sans embarquer de fichier binaire tiers.
 * Primaires sRGB adaptées D50 (Bradford), courbe de transfert sRGB échantillonnée sur 1024 points.
 */

const D50 = [0.9642, 1.0, 0.8249] as const;
const RED = [0.4360747, 0.2225045, 0.0139322] as const;
const GREEN = [0.3850649, 0.7168786, 0.0971045] as const;
const BLUE = [0.1430804, 0.0606169, 0.7141733] as const;

const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0) & 0x7f);

function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function s15Fixed16(value: number): number[] {
  return u32(Math.round(value * 65536) >>> 0);
}

function xyzTag(xyz: readonly number[]): number[] {
  return [...ascii("XYZ "), 0, 0, 0, 0, ...xyz.flatMap(s15Fixed16)];
}

function curveTag(): number[] {
  const points = 1024;
  const body: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const x = i / (points - 1);
    const linear = x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    const value = Math.round(linear * 65535);
    body.push((value >>> 8) & 0xff, value & 0xff);
  }
  return [...ascii("curv"), 0, 0, 0, 0, ...u32(points), ...body];
}

function descTag(text: string): number[] {
  const bytes = [...ascii(text), 0];
  // textDescriptionType v2 : ASCII, puis Unicode (vide) et ScriptCode (vide, 67 octets).
  return [...ascii("desc"), 0, 0, 0, 0, ...u32(bytes.length), ...bytes, ...u32(0), ...u32(0), 0, 0, 0, ...new Array(67).fill(0)];
}

function textTag(text: string): number[] {
  return [...ascii("text"), 0, 0, 0, 0, ...ascii(text), 0];
}

let cached: Uint8Array | null = null;

export function buildSrgbIccProfile(): Uint8Array {
  if (cached) return cached;
  const curve = curveTag();
  const tags: Array<[string, number[]]> = [
    ["desc", descTag("sRGB IEC61966-2.1")],
    ["cprt", textTag("No copyright, use freely")],
    ["wtpt", xyzTag(D50)],
    ["rXYZ", xyzTag(RED)],
    ["gXYZ", xyzTag(GREEN)],
    ["bXYZ", xyzTag(BLUE)],
    ["rTRC", curve],
    ["gTRC", curve],
    ["bTRC", curve],
  ];

  const tableSize = 4 + tags.length * 12;
  let offset = 128 + tableSize;
  const table: number[] = [...u32(tags.length)];
  const data: number[] = [];
  const shared = new Map<number[], number>();
  for (const [signature, body] of tags) {
    let at = shared.get(body);
    if (at === undefined) {
      at = offset;
      shared.set(body, at);
      data.push(...body);
      offset += body.length;
      while (offset % 4 !== 0) {
        data.push(0);
        offset += 1;
      }
    }
    table.push(...ascii(signature), ...u32(at), ...u32(body.length));
  }

  const size = 128 + tableSize + data.length;
  const header = [
    ...u32(size),
    0, 0, 0, 0, // CMM
    0x02, 0x10, 0x00, 0x00, // version 2.1
    ...ascii("mntr"),
    ...ascii("RGB "),
    ...ascii("XYZ "),
    ...[2026, 1, 1, 0, 0, 0].flatMap((v) => [(v >>> 8) & 0xff, v & 0xff]),
    ...ascii("acsp"),
    0, 0, 0, 0, // plateforme
    0, 0, 0, 0, // drapeaux
    0, 0, 0, 0, // fabricant
    0, 0, 0, 0, // modèle
    0, 0, 0, 0, 0, 0, 0, 0, // attributs
    0, 0, 0, 0, // intention perceptuelle
    ...D50.flatMap(s15Fixed16),
    0, 0, 0, 0, // créateur
  ];
  while (header.length < 128) header.push(0);

  cached = Uint8Array.from([...header, ...table, ...data]);
  return cached;
}
