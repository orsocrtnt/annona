/**
 * MOBILE-1, NOT-01 à NOT-03 — notifications natives de l'application (APNs sur iPhone, FCM sur Android).
 *
 * Navigateur : rien ne change (cloche du portail, e-mail, push web du livreur).
 * Application : après la connexion, l'autorisation est demandée une fois, le jeton de l'appareil est
 * envoyé au serveur (`/api/native/push-token`) et un toucher sur la notification ouvre la page
 * indiquée, limitée aux espaces de l'application.
 *
 * Désactivé tant que `NEXT_PUBLIC_NATIVE_PUSH` ne vaut pas « on » : sans fichier Firebase
 * (`google-services.json`), l'enregistrement ferait échouer l'application Android.
 */
import { pluginFacade } from "@/lib/native/plugin-facade";
import { appPlatform, type CapacitorRuntime } from "@/lib/native/platform";

export const NATIVE_PUSH_API = "/api/native/push-token";
export const NATIVE_PUSH_TOKEN_STORAGE_KEY = "annona.native-push-token";

export type NativePushStart = "web" | "disabled" | "denied" | "requested";

interface ListenerHandle {
  remove(): Promise<void> | void;
}

/** Sous-ensemble du module `@capacitor/push-notifications` utilisé ici. */
export interface NativePushPlugin {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  addListener(event: "registration", listener: (token: { value: string }) => void): Promise<ListenerHandle>;
  addListener(event: "registrationError", listener: (error: { error: string }) => void): Promise<ListenerHandle>;
  addListener(
    event: "pushNotificationActionPerformed",
    listener: (action: { notification: { data?: Record<string, unknown> } }) => void
  ): Promise<ListenerHandle>;
}

export interface NativePushDeps {
  runtime?: CapacitorRuntime | null;
  enabled?: boolean;
  plugin?: () => Promise<NativePushPlugin>;
  fetch?: typeof fetch;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  /** Ouvre une page de l'application (routeur Next). */
  navigate?: (path: string) => void;
}

export function nativePushEnabled(): boolean {
  // Lecture littérale : remplacée à la compilation par Next.
  return process.env.NEXT_PUBLIC_NATIVE_PUSH === "on";
}

/** Page ouverte au toucher : chemin interne des espaces de l'application seulement. */
export function safeNotificationPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^\/(portal|driver)(?:[/?#]|$)/.test(value)) return null;
  if (value.includes("\\") || /(^|\/)\.\.?(\/|$|[?#])/.test(value)) return null;
  return value;
}

async function loadPlugin(): Promise<NativePushPlugin> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  // Jamais le module lui-même depuis une fonction async : voir `pluginFacade`.
  return pluginFacade(PushNotifications as unknown as NativePushPlugin, ["checkPermissions", "requestPermissions", "register", "addListener"]);
}

function defaultStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

interface StoredToken {
  platform: "ios" | "android";
  token: string;
}

function readStoredToken(storage: NativePushDeps["storage"]): StoredToken | null {
  try {
    const raw = storage?.getItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredToken>) : null;
    if (parsed && (parsed.platform === "ios" || parsed.platform === "android") && typeof parsed.token === "string") {
      return { platform: parsed.platform, token: parsed.token };
    }
  } catch {
    // Valeur illisible : ignorée.
  }
  return null;
}

/**
 * Démarre les notifications natives (à appeler une fois l'utilisateur connecté, dans son espace).
 * Renvoie une fonction d'arrêt des écouteurs.
 */
export async function startNativePush(deps: NativePushDeps = {}): Promise<{ status: NativePushStart; stop: () => void }> {
  const noop = () => undefined;
  const platform = deps.runtime === undefined ? appPlatform() : appPlatform(deps.runtime);
  if (platform === "web") return { status: "web", stop: noop };
  if (!(deps.enabled ?? nativePushEnabled())) return { status: "disabled", stop: noop };

  const plugin = await (deps.plugin ?? loadPlugin)();
  const fetchImpl = deps.fetch ?? fetch;
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const handles: ListenerHandle[] = [];
  const stop = () => {
    for (const handle of handles.splice(0)) void Promise.resolve(handle.remove()).catch(() => undefined);
  };

  handles.push(await plugin.addListener("pushNotificationActionPerformed", (action) => {
    const path = safeNotificationPath(action.notification.data?.url);
    if (path) deps.navigate?.(path);
  }));

  let permission = (await plugin.checkPermissions()).receive;
  if (permission === "prompt" || permission === "prompt-with-rationale") permission = (await plugin.requestPermissions()).receive;
  if (permission !== "granted") return { status: "denied", stop };

  handles.push(await plugin.addListener("registration", (token) => {
    const record: StoredToken = { platform, token: token.value };
    void fetchImpl(NATIVE_PUSH_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    })
      .then((response) => {
        if (response.ok) storage?.setItem(NATIVE_PUSH_TOKEN_STORAGE_KEY, JSON.stringify(record));
      })
      .catch(() => undefined);
  }));
  handles.push(await plugin.addListener("registrationError", () => undefined));
  await plugin.register();
  return { status: "requested", stop };
}

/** Déconnexion : retire le jeton de ce téléphone pour ce compte (au mieux, sans bloquer). */
export async function releaseNativePush(deps: Pick<NativePushDeps, "fetch" | "storage"> = {}): Promise<void> {
  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const stored = readStoredToken(storage);
  if (!stored) return;
  try {
    await (deps.fetch ?? fetch)(NATIVE_PUSH_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stored),
    });
  } catch {
    // Hors réseau : le jeton changera de compte à la prochaine connexion sur ce téléphone.
  }
  storage?.removeItem(NATIVE_PUSH_TOKEN_STORAGE_KEY);
}
