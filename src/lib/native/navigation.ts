/**
 * MOBILE-1, LIV-04 — ouverture de Plans ou Waze depuis l'application native.
 * Navigateur : rien à faire ici, le lien `<a target="_blank">` s'ouvre comme avant.
 * Application : le lien est confié au système (`AppLauncher.openUrl`), qui ouvre l'application
 * Plans ou Waze (liens universels) au lieu d'une page web dans l'application.
 */
import { appPlatform, type CapacitorRuntime } from "@/lib/native/platform";

const NAVIGATION_HOSTS = new Set(["maps.apple.com", "waze.com", "www.waze.com"]);

/** Seuls les liens de navigation construits par `navigation-links.ts` sont confiés au système. */
export function isNavigationAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && NAVIGATION_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export interface NavigationLaunchDeps {
  runtime?: CapacitorRuntime | null;
  openUrl?: (url: string) => Promise<unknown>;
}

async function launcherOpenUrl(url: string) {
  const { AppLauncher } = await import("@capacitor/app-launcher");
  return AppLauncher.openUrl({ url });
}

/**
 * Renvoie `true` si l'application native a pris le lien en charge (l'appelant annule alors le clic) ;
 * `false` dans un navigateur ou pour un lien inconnu (comportement web inchangé).
 */
export function openInNavigationApp(url: string, deps: NavigationLaunchDeps = {}): boolean {
  const platform = deps.runtime === undefined ? appPlatform() : appPlatform(deps.runtime);
  if (platform === "web" || !isNavigationAppUrl(url)) return false;
  void (deps.openUrl ?? launcherOpenUrl)(url).catch(() => undefined);
  return true;
}
