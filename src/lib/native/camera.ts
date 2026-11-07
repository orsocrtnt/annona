/**
 * MOBILE-1, LIV-05 — photo d'un problème de livraison avec l'appareil photo natif.
 * Navigateur : le champ `<input type="file" capture>` reste utilisé (comportement inchangé).
 * Application : l'appareil photo du système est ouvert ; l'image revient en base64 (un chemin de
 * fichier local ne serait pas lisible par le site hébergé) et devient un `Blob` JPEG, ensuite
 * préparé et envoyé par la file hors réseau comme une photo du navigateur.
 */
import { appPlatform, type CapacitorRuntime } from "@/lib/native/platform";

export interface NativePhotoResult {
  base64String?: string;
  format?: string;
}

export interface NativeCameraDeps {
  runtime?: CapacitorRuntime | null;
  getPhoto?: () => Promise<NativePhotoResult>;
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

export function nativeCameraAvailable(runtime?: CapacitorRuntime | null): boolean {
  return (runtime === undefined ? appPlatform() : appPlatform(runtime)) !== "web";
}

async function pluginGetPhoto(): Promise<NativePhotoResult> {
  const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
  // `getPhoto` (base64) plutôt que `takePhoto` (chemin de fichier local, illisible depuis le site hébergé).
  return Camera.getPhoto({
    source: CameraSource.Camera,
    resultType: CameraResultType.Base64,
    quality: 70,
    width: 1600,
    correctOrientation: true,
    saveToGallery: false,
  });
}

function isCancel(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /cancel/i.test(message);
}

/** Photo prise, ou `null` si le livreur a annulé. Les autres erreurs (permission refusée) remontent. */
export async function takeNativePhoto(deps: NativeCameraDeps = {}): Promise<File | null> {
  if (!nativeCameraAvailable(deps.runtime)) throw new Error("NATIVE_CAMERA_UNAVAILABLE");
  let photo: NativePhotoResult;
  try {
    photo = await (deps.getPhoto ?? pluginGetPhoto)();
  } catch (error) {
    if (isCancel(error)) return null;
    throw error;
  }
  if (!photo.base64String) return null;
  const format = photo.format === "png" ? "png" : "jpeg";
  const blob = base64ToBlob(photo.base64String, `image/${format}`);
  return new File([blob], `incident.${format === "png" ? "png" : "jpg"}`, { type: blob.type });
}
