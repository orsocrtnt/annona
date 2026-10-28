import sharp from "sharp";

/**
 * Ré-encode une photo de preuve pour en retirer toutes les métadonnées (EXIF, dont la position GPS,
 * XMP, IPTC, profil). L'orientation EXIF est appliquée aux pixels avant suppression : la photo
 * reste affichée dans le bon sens partout. Le format (JPEG ou PNG) est conservé.
 */
export async function stripPodPhotoMetadata(bytes: Buffer, contentType: string): Promise<Buffer> {
  try {
    // sharp supprime les métadonnées par défaut : on n'appelle volontairement pas withMetadata().
    const pipeline = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    return contentType === "image/png"
      ? await pipeline.png().toBuffer()
      : await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  } catch {
    throw new Error("POD_INVALID_PHOTO");
  }
}
