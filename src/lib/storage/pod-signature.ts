import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/services/supabase/admin";
import { POD_BUCKET, SIGNED_URL_SECONDS, ensurePodBucket, validPng } from "@/lib/storage/pod";

/** Une signature manuscrite à l'écran reste légère : 300 Ko et 1 600 x 800 px au maximum. */
export const MAX_SIGNATURE_BYTES = 300 * 1024;
export const MAX_SIGNATURE_WIDTH = 1600;
export const MAX_SIGNATURE_HEIGHT = 800;
const MIN_SIGNATURE_SIDE = 40;

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

/** Chemin de la signature : même préfixe `companyId/deliveryId-` que la photo, infixe `sig-` pour les distinguer. */
export function isPodSignaturePathForDelivery(path: string, companyId: string, deliveryId: string): boolean {
  if (![companyId, deliveryId].every((id) => SAFE_ID.test(id))) return false;
  const prefix = `${companyId}/${deliveryId}-sig-`;
  return path.startsWith(prefix) && /^\d+-[0-9a-f-]{36}\.png$/.test(path.slice(prefix.length));
}

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
  if (![params.companyId, params.deliveryId].every((id) => SAFE_ID.test(id))) throw new Error("POD_INVALID_PATH");
  const clean = await normalizePodSignature(params.bytes);
  await ensurePodBucket();
  const path = `${params.companyId}/${params.deliveryId}-sig-${Date.now()}-${randomUUID()}.png`;
  const { error } = await createAdminClient().storage.from(POD_BUCKET).upload(path, clean, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(`POD_UPLOAD: ${error.message}`);
  return path;
}

export async function deletePodSignature(path: string, companyId: string, deliveryId: string) {
  if (!isPodSignaturePathForDelivery(path, companyId, deliveryId)) throw new Error("POD_INVALID_PATH");
  await ensurePodBucket();
  const { error } = await createAdminClient().storage.from(POD_BUCKET).remove([path]);
  if (error) throw new Error(`POD_DELETE: ${error.message}`);
}

/** Octets de la signature (pour le PDF). Null si le chemin n'appartient pas à cette entreprise et cette livraison. */
export async function downloadPodSignature(path: string | null | undefined, companyId: string, deliveryId: string) {
  if (!path || !isPodSignaturePathForDelivery(path, companyId, deliveryId)) return null;
  await ensurePodBucket();
  const { data, error } = await createAdminClient().storage.from(POD_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function getPodSignatureSignedUrl(path: string | null | undefined, companyId: string, deliveryId: string) {
  if (!path || !isPodSignaturePathForDelivery(path, companyId, deliveryId)) return null;
  await ensurePodBucket();
  const { data, error } = await createAdminClient().storage.from(POD_BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}
