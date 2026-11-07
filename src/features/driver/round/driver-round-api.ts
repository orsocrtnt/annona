import type { DriverRoundsData } from "@/domains/round/round.types";
import { DriverApiError } from "@/features/driver/driver-api-error";
import type { QueuedDriverAction } from "@/features/driver/offline-action-queue";

/** TOUR-1 — appels de l'application livreur (LIV-01 à LIV-06). */

/** Refus définitif (droits, arrêt déplacé, données invalides) : l'action ne sera pas rejouée seule. */
function retryableStatus(status: number) {
  return status >= 500 || status === 401 || status === 408 || status === 429;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store" });
  } catch {
    // Pas de réseau (ou coupure) : l'action reste dans la file et repartira au retour de la connexion.
    throw new DriverApiError("Réseau indisponible.", { retryable: true });
  }
  let json: { error?: string; data?: T; code?: string } = {};
  try {
    json = await response.json();
  } catch {
    if (!response.ok) throw new DriverApiError(`Erreur serveur (${response.status})`, { status: response.status, retryable: retryableStatus(response.status) });
  }
  if (!response.ok) {
    throw new DriverApiError(json.error ?? `Erreur serveur (${response.status})`, {
      status: response.status,
      code: json.code,
      retryable: retryableStatus(response.status),
    });
  }
  return json.data as T;
}

const jsonInit = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const driverRoundApi = {
  rounds: () => call<DriverRoundsData>("/api/driver/rounds"),

  /** Envoi d'une action de la file hors réseau (idempotent côté serveur). */
  send(action: QueuedDriverAction): Promise<unknown> {
    const payload = action.payload;
    if (payload.kind === "START") {
      return call(`/api/driver/rounds/${encodeURIComponent(payload.roundId)}/start`, jsonInit({ at: payload.at }));
    }
    if (payload.kind === "DELIVERED") {
      return call(`/api/driver/stops/${encodeURIComponent(payload.stopId)}/delivered`, jsonInit({ at: payload.at }));
    }
    const form = new FormData();
    form.set("code", payload.code);
    form.set("comment", payload.comment);
    form.set("at", payload.at);
    if (payload.photo) form.set("photo", payload.photo, payload.photo.type === "image/png" ? "photo.png" : "photo.jpg");
    return call(`/api/driver/stops/${encodeURIComponent(payload.stopId)}/incident`, { method: "POST", body: form });
  },
};

const MAX_PHOTO_SIDE = 1600;

/**
 * Photo d'incident réduite et convertie en JPEG sur le téléphone avant d'entrer dans la file : moins de
 * données à garder hors réseau et à envoyer, et un format accepté par le serveur (HEIC de l'iPhone
 * compris quand le navigateur sait le décoder). En cas d'échec, le fichier d'origine est gardé.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}
