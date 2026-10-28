import sharp from "sharp";

const MAX_INPUT_PIXELS = 40_000_000;
/** Repli par paliers si le ré-encodage dépasse la limite : [qualité JPEG, plus grand côté en pixels]. */
const FALLBACK_STEPS: Array<[number, number | null]> = [[82, null], [70, null], [60, 2400], [50, 1600], [40, 1200]];

export type SanitizedPodPhoto = { bytes: Buffer; contentType: "image/jpeg" | "image/png" };

/**
 * Ré-encode une photo de preuve pour en retirer toutes les métadonnées (EXIF, dont la position GPS,
 * XMP, IPTC, profil). L'orientation EXIF est appliquée aux pixels avant suppression : la photo
 * reste affichée dans le bon sens partout.
 *
 * Le format est conservé tant que le résultat tient dans `maxBytes`. Sinon (un PNG ré-encodé ou un JPEG
 * très compressé peut grossir), repli en JPEG de qualité décroissante puis réduction de taille ; la limite
 * est contrôlée APRÈS ré-encodage pour que l'archive DATA-02 puisse toujours relire l'objet stocké.
 */
export async function sanitizePodPhoto(bytes: Buffer, contentType: string, maxBytes: number): Promise<SanitizedPodPhoto> {
  const open = () => sharp(bytes, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS }).rotate();
  try {
    // sharp supprime les métadonnées par défaut : on n'appelle volontairement pas withMetadata().
    const sameFormat =
      contentType === "image/png"
        ? await open().png().toBuffer()
        : await open().jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    if (sameFormat.length <= maxBytes) {
      return { bytes: sameFormat, contentType: contentType === "image/png" ? "image/png" : "image/jpeg" };
    }
    for (const [quality, maxSide] of FALLBACK_STEPS) {
      let pipeline = open().flatten({ background: "#ffffff" });
      if (maxSide) pipeline = pipeline.resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true });
      const jpeg = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      if (jpeg.length <= maxBytes) return { bytes: jpeg, contentType: "image/jpeg" };
    }
  } catch {
    throw new Error("POD_INVALID_PHOTO");
  }
  throw new Error("POD_PHOTO_TOO_LARGE");
}

/** Octets seuls (compatibilité) : même traitement, limite par défaut de 5 Mo. */
export async function stripPodPhotoMetadata(bytes: Buffer, contentType: string, maxBytes = 5 * 1024 * 1024): Promise<Buffer> {
  return (await sanitizePodPhoto(bytes, contentType, maxBytes)).bytes;
}
