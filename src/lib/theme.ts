/** Préférence de thème : « system » suit l'OS, « light » et « dark » sont des choix explicites mémorisés. */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "tutelliv-theme";

/** Espaces ayant migré vers les jetons Dark. Les autres gardent le Light actuel quel que soit l'OS. */
export const THEME_SCOPED_PATH_PREFIXES = ["/portal"] as const;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

export function isThemeScopedPath(pathname: string): boolean {
  return THEME_SCOPED_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Script exécuté avant l'hydratation (dans <head>) : lit la préférence et pose `data-theme`
 * (« system », « light » ou « dark ») sur <html> uniquement pour les espaces migrés, sans flash au chargement.
 * « system » laisse la media query `prefers-color-scheme` décider côté CSS.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=location.pathname;var s=${JSON.stringify(
  THEME_SCOPED_PATH_PREFIXES
)};var ok=false;for(var i=0;i<s.length;i++){if(p===s[i]||p.indexOf(s[i]+"/")===0){ok=true}}if(!ok)return;var v=null;try{v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})}catch(e){}if(v!=="light"&&v!=="dark"&&v!=="system")v="system";document.documentElement.setAttribute("data-theme",v)}catch(e){}})();`;
