/**
 * MOBILE-1, LIV-06 — état du réseau pour la file hors réseau du livreur.
 * Navigateur : événements `online` / `offline` (comportement inchangé).
 * Application : module natif `Network` (plus fiable que les événements de la vue web) et retour de
 * l'application au premier plan (`App`), pour relancer la synchronisation dès que possible.
 */
import { appPlatform, type CapacitorRuntime } from "@/lib/native/platform";

export interface ConnectivityHandlers {
  onOnline(): void;
  onOffline(): void;
  /** Application native revenue au premier plan. */
  onResume?(): void;
}

interface ListenerHandle {
  remove(): Promise<void> | void;
}

export interface NativeConnectivityPlugins {
  addNetworkListener(listener: (status: { connected: boolean }) => void): Promise<ListenerHandle>;
  addResumeListener(listener: (state: { isActive: boolean }) => void): Promise<ListenerHandle>;
}

export interface ConnectivityDeps {
  runtime?: CapacitorRuntime | null;
  native?: () => Promise<NativeConnectivityPlugins>;
  target?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
}

async function loadNativeConnectivity(): Promise<NativeConnectivityPlugins> {
  const [{ Network }, { App }] = await Promise.all([import("@capacitor/network"), import("@capacitor/app")]);
  return {
    addNetworkListener: (listener) => Network.addListener("networkStatusChange", listener),
    addResumeListener: (listener) => App.addListener("appStateChange", listener),
  };
}

/** Écoute le réseau ; renvoie la fonction qui arrête l'écoute. */
export function watchConnectivity(handlers: ConnectivityHandlers, deps: ConnectivityDeps = {}): () => void {
  const platform = deps.runtime === undefined ? appPlatform() : appPlatform(deps.runtime);

  if (platform === "web") {
    const target = deps.target === undefined ? (typeof window === "undefined" ? null : window) : deps.target;
    if (!target) return () => undefined;
    const online = () => handlers.onOnline();
    const offline = () => handlers.onOffline();
    target.addEventListener("online", online);
    target.addEventListener("offline", offline);
    return () => {
      target.removeEventListener("online", online);
      target.removeEventListener("offline", offline);
    };
  }

  let stopped = false;
  const handles: ListenerHandle[] = [];
  const keep = (handle: ListenerHandle) => {
    if (stopped) void Promise.resolve(handle.remove()).catch(() => undefined);
    else handles.push(handle);
  };
  void (async () => {
    try {
      const plugins = await (deps.native ?? loadNativeConnectivity)();
      if (stopped) return;
      keep(await plugins.addNetworkListener((status) => {
        if (stopped) return;
        if (status.connected) handlers.onOnline();
        else handlers.onOffline();
      }));
      keep(await plugins.addResumeListener((state) => {
        if (!stopped && state.isActive) handlers.onResume?.();
      }));
    } catch {
      // Module natif absent (ancienne version de l'application) : la relance toutes les 15 s reste active.
    }
  })();
  return () => {
    stopped = true;
    for (const handle of handles.splice(0)) void Promise.resolve(handle.remove()).catch(() => undefined);
  };
}
