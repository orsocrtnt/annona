/**
 * MOBILE-1, AUTH-GOOGLE — connexion Google dans l'application native.
 *
 * Google refuse sa page de connexion dans la vue web de Capacitor. Dans l'application, la page Google s'ouvre
 * donc dans le navigateur du système (`@capacitor/browser`, onglet personnalisé sur Android). Supabase renvoie
 * ensuite vers le lien de l'application `fr.annona.app://auth/callback?code=…` ; l'application le reçoit
 * (`appUrlOpen`, ou `getLaunchUrl` si elle avait été fermée), referme le navigateur et charge
 * `/auth/callback?code=…` dans sa vue web. Le vérificateur PKCE posé par `signInWithOAuth` est dans les cookies
 * de la vue web : la route serveur existante échange le code sans changement.
 *
 * Réglage Supabase nécessaire (Authentication › URL Configuration › Redirect URLs) : `fr.annona.app://auth/callback**`.
 */
import { MOBILE_APP_ID } from "@/lib/native/app-config";
import { pluginFacade } from "@/lib/native/plugin-facade";

/** Schéma du lien de l'application, identique à l'identifiant `fr.annona.app` (Android et iOS). */
export const NATIVE_APP_SCHEME = MOBILE_APP_ID;

/** Paramètres du retour Supabase transmis à `/auth/callback` ; tout le reste est ignoré. */
const CALLBACK_PARAMS = ["code", "intent", "error", "error_code", "error_description"] as const;

export type OAuthIntent = "login" | "signup";

/** Adresse de retour donnée à Supabase dans l'application : le lien de l'application, pas l'adresse web. */
export function nativeOAuthRedirect(intent: OAuthIntent): string {
  return `${NATIVE_APP_SCHEME}://auth/callback?intent=${intent}`;
}

/**
 * Lien reçu par l'application → adresse `/auth/callback` du site, sur l'origine de la vue web.
 * Renvoie `null` pour tout autre lien (autre schéma, autre chemin) : jamais de redirection ouverte.
 */
export function webCallbackFromAppLink(link: string, origin: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(link);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${NATIVE_APP_SCHEME}:`) return null;
  // `fr.annona.app://auth/callback` : « auth » est l'hôte, « /callback » le chemin.
  const path = `${parsed.host}${parsed.pathname}`.replace(/\/+$/, "");
  if (path !== "auth/callback") return null;
  const target = new URL("/auth/callback", origin);
  for (const name of CALLBACK_PARAMS) {
    const value = parsed.searchParams.get(name);
    if (value !== null) target.searchParams.set(name, value);
  }
  if (!target.searchParams.has("code") && !target.searchParams.has("error")) return null;
  return target.toString();
}

interface ListenerHandle {
  remove(): Promise<void> | void;
}

export interface NativeOAuthPlugins {
  openBrowser(url: string): Promise<void>;
  closeBrowser(): Promise<void>;
  addAppUrlListener(listener: (event: { url: string }) => void): Promise<ListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
}

interface BrowserPlugin {
  open(options: { url: string; presentationStyle?: "fullscreen" | "popover" }): Promise<void>;
  close(): Promise<void>;
}

interface AppPlugin {
  addListener(event: "appUrlOpen", listener: (event: { url: string }) => void): Promise<ListenerHandle>;
  getLaunchUrl(): Promise<{ url: string } | undefined>;
}

async function loadNativeOAuthPlugins(): Promise<NativeOAuthPlugins> {
  const [{ Browser }, { App }] = await Promise.all([import("@capacitor/browser"), import("@capacitor/app")]);
  // Jamais les modules eux-mêmes depuis une fonction async : voir `pluginFacade`.
  const browser = pluginFacade(Browser as unknown as BrowserPlugin, ["open", "close"]);
  const app = pluginFacade(App as unknown as AppPlugin, ["addListener", "getLaunchUrl"]);
  return {
    openBrowser: (url) => browser.open({ url, presentationStyle: "popover" }),
    closeBrowser: () => browser.close(),
    addAppUrlListener: (listener) => app.addListener("appUrlOpen", listener),
    getLaunchUrl: () => app.getLaunchUrl(),
  };
}

export interface NativeOAuthDeps {
  plugins?: () => Promise<NativeOAuthPlugins>;
  origin?: string;
  navigate?: (url: string) => void;
  /** Mémoire du dernier lien traité (par défaut `sessionStorage`). */
  memory?: { get(): string | null; set(link: string): void };
}

const HANDLED_KEY = "annona:oauth-app-link";

/**
 * `getLaunchUrl` renvoie le même lien pendant toute la vie de l'application : sans mémoire, une page de connexion
 * rouverte après une déconnexion rejouerait un code déjà utilisé (refus « google=erreur »).
 */
const sessionMemory = {
  get: () => {
    try {
      return window.sessionStorage.getItem(HANDLED_KEY);
    } catch {
      return null;
    }
  },
  set: (link: string) => {
    try {
      window.sessionStorage.setItem(HANDLED_KEY, link);
    } catch {
      // Stockage indisponible : le lien du lancement pourra être revu, sans autre effet qu'un message d'erreur.
    }
  },
};

/** Ouvre la page Google (adresse fournie par Supabase) dans le navigateur du système. */
export async function openNativeOAuth(url: string, deps: NativeOAuthDeps = {}): Promise<void> {
  const plugins = await (deps.plugins ?? loadNativeOAuthPlugins)();
  await plugins.openBrowser(url);
}

/**
 * Écoute le retour de Google dans l'application ; renvoie la fonction qui arrête l'écoute. Un lien déjà reçu au
 * lancement (application fermée pendant la connexion) est traité aussi, une seule fois.
 */
export function watchNativeOAuthReturn(deps: NativeOAuthDeps = {}): () => void {
  const origin = deps.origin ?? window.location.origin;
  const navigate = deps.navigate ?? ((url: string) => window.location.assign(url));
  const memory = deps.memory ?? sessionMemory;
  let stopped = false;
  let handled = false;
  let handle: ListenerHandle | null = null;
  let plugins: NativeOAuthPlugins | null = null;

  const receive = (link: string | undefined) => {
    if (stopped || handled || !link || memory.get() === link) return;
    const target = webCallbackFromAppLink(link, origin);
    if (!target) return;
    handled = true;
    memory.set(link);
    void plugins?.closeBrowser().catch(() => undefined);
    navigate(target);
  };

  void (async () => {
    try {
      plugins = await (deps.plugins ?? loadNativeOAuthPlugins)();
      if (stopped) return;
      const listener = await plugins.addAppUrlListener((event) => receive(event.url));
      if (stopped) {
        void Promise.resolve(listener.remove()).catch(() => undefined);
        return;
      }
      handle = listener;
      receive((await plugins.getLaunchUrl().catch(() => undefined))?.url);
    } catch {
      // Modules natifs absents : rien à écouter.
    }
  })();

  return () => {
    stopped = true;
    if (handle) void Promise.resolve(handle.remove()).catch(() => undefined);
    handle = null;
  };
}
