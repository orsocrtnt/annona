import sharp from "sharp";
import {
  isPodSignaturePathForDelivery,
  putPodObject,
  readPodObject,
  removePodObject,
  signPodObject,
  validPng,
} from "@/lib/storage/pod";

export { isPodSignaturePathForDelivery };

/** Une signature manuscrite à l'écran reste légère : 300 Ko et 1 600 x 800 px au maximum. */
export const MAX_SIGNATURE_BYTES = 300 * 1024;
export const MAX_SIGNATURE_WIDTH = 1600;
export const MAX_SIGNATURE_HEIGHT = 800;
const MIN_SIGNATURE_SIDE = 40;

/** Contrôle les octets, le format PNG, les dimensions et la taille. Lève POD_SIGNATURE_INVALID ou POD_SIGNATURE_TOO_LARGE. */
export function validatePodSignature(bytes: Buffer, contentType: string): { width: number; height: number } {
  if (bytes.length > MAX_SIGNATURE_BYTES) throw new Error("POD_SIGNATURE_TOO_LARGE");
  if (contentType !== "image/png" || !bytes.length || !validPng(bytes)) throw new Error("POD_SIGNATURE_INVALID");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (
    width < MIN_SIGNATURE_SIDE || height < MIN_SIGNATURE_SIDE ||
    width > MAX_SIGNATURE_WIDTH || height > MAX_SIGNATURE_HEIGHT
  ) {
    throw new Error("POD_SIGNATURE_INVALID");
  }
  return { width, height };
}

/** Aplatit sur fond blanc (le canevas est transparent) et ré-encode : plus aucune donnée annexe. */
export async function normalizePodSignature(bytes: Buffer): Promise<Buffer> {
  try {
    return await sharp(bytes, { failOn: "error" }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    throw new Error("POD_SIGNATURE_INVALID");
  }
}

export async function uploadPodSignature(params: { companyId: string; deliveryId: string; bytes: Buffer; contentType: string }) {
  validatePodSignature(params.bytes, params.contentType);
  const clean = await normalizePodSignature(params.bytes);
  return putPodObject({ kind: "signature", companyId: params.companyId, deliveryId: params.deliveryId, bytes: clean, contentType: "image/png" });
}

export async function deletePodSignature(path: string, companyId: string, deliveryId: string) {
  return removePodObject("signature", path, companyId, deliveryId);
}

/** Octets de la signature (pour le PDF). */
export async function downloadPodSignature(path: string | null | undefined, companyId: string, deliveryId: string) {
  return readPodObject("signature", path, companyId, deliveryId);
}

export async function getPodSignatureSignedUrl(path: string | null | undefined, companyId: string, deliveryId: string) {
  return signPodObject("signature", path, companyId, deliveryId);
}
