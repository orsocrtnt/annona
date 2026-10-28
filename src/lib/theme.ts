/** Préférence de thème : « system » suit l'OS, « light » et « dark » sont des choix explicites mémorisés. */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tutelliv-theme";

/** Espaces ayant migré vers les jetons Dark. Les autres gardent le Light actuel quel que soit l'OS. */
export const THEME_SCOPED_PATH_PREFIXES = ["/portal"] as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function isThemeScopedPath(pathname: string): boolean {
  return THEME_SCOPED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return pref === "system" ? (prefersDark ? "dark" : "light") : pref;
}

/** Applique (ou retire) `data-theme` sur la racine : seule fonction qui écrit l'attribut, appelée par ThemeSync. */
export function applyThemeToRoot(
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void },
  pathname: string,
  pref: ThemePreference,
  prefersDark: boolean
): void {
  if (isThemeScopedPath(pathname)) root.setAttribute("data-theme", resolveTheme(pref, prefersDark));
  else root.removeAttribute("data-theme");
}

/**
 * Script exécuté avant l'hydratation (dans <head>) : lit la préférence, résout « système » avec matchMedia
 * et pose `data-theme="light|dark"` sur <html> uniquement pour les espaces migrés, sans flash au chargement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=location.pathname;var s=${JSON.stringify(
  THEME_SCOPED_PATH_PREFIXES
)};var ok=false;for(var i=0;i<s.length;i++){if(p===s[i]||p.indexOf(s[i]+"/")===0){ok=true}}if(!ok)return;var v=null;try{v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})}catch(e){}if(v!=="light"&&v!=="dark")v=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",v)}catch(e){}})();`;
