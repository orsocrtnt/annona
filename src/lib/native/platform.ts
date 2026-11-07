/**
 * MOBILE-1 — détection de l'application native (Capacitor) côté navigateur.
 * Dans un navigateur ordinaire, tout reste comme avant : chaque pont garde le comportement web.
 */
import { Capacitor } from "@capacitor/core";

export type AppPlatform = "ios" | "android" | "web";

/** Sous-ensemble de `Capacitor` utilisé ici (remplaçable dans les tests). */
export interface CapacitorRuntime {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

export function appPlatform(runtime: CapacitorRuntime | null = Capacitor): AppPlatform {
  if (!runtime || !runtime.isNativePlatform()) return "web";
  const platform = runtime.getPlatform();
  return platform === "ios" || platform === "android" ? platform : "web";
}

export function isNativeApp(runtime: CapacitorRuntime | null = Capacitor): boolean {
  return appPlatform(runtime) !== "web";
}
