/**
 * MOBILE-1, ENF-04 — suivi de la position du livreur, natif dans l'application, web sinon.
 * L'appelant (`useDriverLivePosition`) ne l'active que pendant une tournée démarrée
 * (`driverLocationAllowed`) et l'arrête dès qu'elle ne l'est plus : aucun suivi en arrière-plan.
 */
import { pluginFacade } from "@/lib/native/plugin-facade";
import { appPlatform, type CapacitorRuntime } from "@/lib/native/platform";

/** Forme commune (sous-ensemble de `GeolocationPosition`). */
export interface DriverPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number | null;
    speed: number | null;
  };
  timestamp: number;
}

export interface PositionWatchHandlers {
  onPosition(position: DriverPosition): void;
  /** Codes de `GeolocationPositionError` : 1 refus, 2 indisponible, 3 délai dépassé. */
  onError(code: number, message: string): void;
}

export interface PositionWatchOptions {
  enableHighAccuracy: boolean;
  maximumAge: number;
  timeout: number;
}

/** Sous-ensemble du module `@capacitor/geolocation` utilisé ici. */
export interface NativeGeolocation {
  checkPermissions(): Promise<{ location: string }>;
  requestPermissions(options?: { permissions: Array<"location" | "coarseLocation"> }): Promise<{ location: string }>;
  watchPosition(
    options: PositionWatchOptions,
    callback: (position: DriverPosition | null, error?: { message?: string; code?: string }) => void
  ): Promise<string>;
  clearWatch(options: { id: string }): Promise<void>;
}

export interface PositionWatchDeps {
  runtime?: CapacitorRuntime | null;
  native?: () => Promise<NativeGeolocation>;
  web?: Geolocation | null;
}

async function loadNativeGeolocation(): Promise<NativeGeolocation> {
  const { Geolocation } = await import("@capacitor/geolocation");
  // Jamais le module lui-même depuis une fonction async : voir `pluginFacade`.
  return pluginFacade(Geolocation as unknown as NativeGeolocation, ["checkPermissions", "requestPermissions", "watchPosition", "clearWatch"]);
}

function nativeErrorCode(error: { message?: string; code?: string } | undefined): number {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (/denied|permission|not authorized|refus/.test(text)) return 1;
  if (/timeout|timed out/.test(text)) return 3;
  return 2;
}

/** Démarre le suivi ; renvoie la fonction qui l'arrête (sûre même avant la fin du démarrage). */
export function watchDriverPosition(
  handlers: PositionWatchHandlers,
  options: PositionWatchOptions,
  deps: PositionWatchDeps = {}
): () => void {
  const platform = deps.runtime === undefined ? appPlatform() : appPlatform(deps.runtime);

  if (platform === "web") {
    const geolocation = deps.web === undefined ? (typeof navigator === "undefined" ? null : navigator.geolocation ?? null) : deps.web;
    if (!geolocation) {
      handlers.onError(2, "Géolocalisation non disponible.");
      return () => undefined;
    }
    const id = geolocation.watchPosition(
      (position) => handlers.onPosition(position),
      (error) => handlers.onError(error.code, error.message),
      options
    );
    return () => geolocation.clearWatch(id);
  }

  let stopped = false;
  let watchId: string | null = null;
  let plugin: NativeGeolocation | null = null;
  void (async () => {
    try {
      plugin = await (deps.native ?? loadNativeGeolocation)();
      let permission = (await plugin.checkPermissions()).location;
      if (permission !== "granted") permission = (await plugin.requestPermissions({ permissions: ["location"] })).location;
      if (stopped) return;
      if (permission !== "granted") {
        handlers.onError(1, "Accès à la position refusé.");
        return;
      }
      const id = await plugin.watchPosition(options, (position, error) => {
        if (stopped) return;
        if (position) handlers.onPosition(position);
        else handlers.onError(nativeErrorCode(error), error?.message ?? "Position indisponible.");
      });
      if (stopped) void plugin.clearWatch({ id }).catch(() => undefined);
      else watchId = id;
    } catch (error) {
      if (!stopped) handlers.onError(nativeErrorCode(error as { message?: string }), error instanceof Error ? error.message : "Position indisponible.");
    }
  })();
  return () => {
    stopped = true;
    if (plugin && watchId) void plugin.clearWatch({ id: watchId }).catch(() => undefined);
  };
}
