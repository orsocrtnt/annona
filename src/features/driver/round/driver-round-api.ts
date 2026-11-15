import type { DriverRoundsData } from "@/domains/round/round.types";
import { DriverApiError } from "@/features/driver/driver-api-error";
import { OFFLINE_COPY_HEADER } from "@/features/driver/driver-offline-cache";
import type { QueuedDriverAction } from "@/features/driver/offline-action-queue";

/** TOUR-1 — appels de l'application livreur (LIV-01 à LIV-06). */

/**
 * Tournée lue, avec sa fraîcheur (RECETTE-V1 N1) : `freshAt` est l'heure du début de la lecture quand le
 * serveur a répondu, `null` quand c'est la copie hors réseau du service worker (peut-être plus ancienne
 * qu'un envoi déjà fait).
 */
export type DriverRoundsResult = DriverRoundsData & { freshAt: number | null };

/** Refus définitif (droits, arrêt déplacé, données invalides) : l'action ne sera pas rejouée seule. */
function retryableStatus(status: number) {
  return status >= 500 || status === 401 || status === 408 || status === 429;
}

/**
 * RECETTE-V1 N2 : un envoi parti pendant le retour du réseau pouvait rester suspendu ~30 s et bloquer toute la
 * file. Passé ce délai, l'envoi est abandonné (« réseau indisponible ») et l'action reste en file ; sans risque
 * de doublon, « Livré » et « Problème » étant idempotents côté serveur (LIV-06). Photo : délai plus long.
 */
export const DRIVER_SEND_TIMEOUT_MS = 10_000;
export const DRIVER_PHOTO_SEND_TIMEOUT_MS = 30_000;

function withTimeout(init: RequestInit, ms: number): RequestInit {
  return typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function" ? { ...init, signal: AbortSignal.timeout(ms) } : init;
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  return (await request<T>(url, init)).data;
}

async function request<T>(url: string, init?: RequestInit): Promise<{ data: T; headers: Headers }> {
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
  return { data: json.data as T, headers: response.headers };
}

const jsonInit = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const driverRoundApi = {
  async rounds(): Promise<DriverRoundsResult> {
    const startedAt = Date.now();
    const { data, headers } = await request<DriverRoundsData>("/api/driver/rounds");
    return { ...data, freshAt: headers.get(OFFLINE_COPY_HEADER) ? null : startedAt };
  },

  /** Envoi d'une action de la file hors réseau (idempotent côté serveur). */
  send(action: QueuedDriverAction): Promise<unknown> {
    const payload = action.payload;
    if (payload.kind === "START") {
      return call(`/api/driver/rounds/${encodeURIComponent(payload.roundId)}/start`, withTimeout(jsonInit({ at: payload.at }), DRIVER_SEND_TIMEOUT_MS));
    }
    if (payload.kind === "DELIVERED") {
      return call(`/api/driver/stops/${encodeURIComponent(payload.stopId)}/delivered`, withTimeout(jsonInit({ at: payload.at }), DRIVER_SEND_TIMEOUT_MS));
    }
    const form = new FormData();
    form.set("code", payload.code);
    form.set("comment", payload.comment);
    form.set("at", payload.at);
    if (payload.photo) form.set("photo", payload.photo, payload.photo.type === "image/png" ? "photo.png" : "photo.jpg");
    return call(`/api/driver/stops/${encodeURIComponent(payload.stopId)}/incident`, withTimeout({ method: "POST", body: form }, payload.photo ? DRIVER_PHOTO_SEND_TIMEOUT_MS : DRIVER_SEND_TIMEOUT_MS));
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
