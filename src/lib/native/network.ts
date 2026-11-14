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

  const target = deps.target === undefined ? (typeof window === "undefined" ? null : window) : deps.target;
  const online = () => handlers.onOnline();
  const offline = () => handlers.onOffline();
  target?.addEventListener("online", online);
  target?.addEventListener("offline", offline);
  const stopWeb = () => {
    target?.removeEventListener("online", online);
    target?.removeEventListener("offline", offline);
  };
  if (platform === "web") return stopWeb;

  // Application : les événements de la vue web restent écoutés aussi (RECETTE-V1 N2). Après un rechargement
  // hors réseau, le module natif chargé à la demande n'est pas dans la copie du service worker : son import
  // échouait en silence et le retour du réseau n'était vu qu'au passage suivant (jusqu'à 15 s).
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
      // Module natif absent ou non chargeable hors réseau : les événements de la vue web prennent le relais.
    }
  })();
  return () => {
    stopped = true;
    stopWeb();
    for (const handle of handles.splice(0)) void Promise.resolve(handle.remove()).catch(() => undefined);
  };
}
