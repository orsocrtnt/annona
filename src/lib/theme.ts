/** Préférence de thème : « system » suit l'OS, « light » et « dark » sont des choix explicites mémorisés. */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tutelliv-theme";

/**
 * Espaces ayant migré vers les jetons Dark : portail client, back-office et dispatch, espace `/admin`, app livreur,
 * et site public (LANDING-2, DESIGN-2) : accueil, pages publiques, connexion, inscription (`/register` et
 * `/register/client`) et mot de passe, pour ne pas changer de thème entre connexion et inscription.
 * « / » ne vaut que pour l'accueil exact (aucune route ne commence par « // »).
 */
export const THEME_SCOPED_PATH_PREFIXES = [
  "/portal",
  "/dashboard",
  "/dispatch",
  "/settings",
  "/support",
  "/users",
  "/companies",
  "/onboarding",
  "/admin",
  "/driver",
  "/",
  "/fonctionnalites",
  "/tarifs",
  "/demonstration",
  "/demo",
  "/contact",
  "/commander",
  "/suivi",
  "/mentions-legales",
  "/confidentialite",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
] as const;

/**
 * Routes retirées du Dark. Vide depuis le lot B (carte et panneaux ont une version sombre : `use-map-theme.ts`,
 * `map-theme.css`, `map-visual-theme.ts`). Le mécanisme reste pour exclure un futur écran sans toucher à la règle.
 */
export const THEME_EXCLUDED_PATH_PREFIXES: readonly string[] = [];

/** Téléphone, portrait ou paysage : thème clair seul pour le moment (décision du propriétaire du 30 octobre 2026). */
export const PHONE_MEDIA_QUERY = "(max-width: 767px), (max-height: 500px) and (pointer: coarse)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/**
 * Thème à poser sur <html> pour `pathname`, ou `null` hors des espaces migrés. Source unique de la règle :
 * appelée par ThemeSync et recopiée telle quelle (toString) dans THEME_INIT_SCRIPT. Elle doit donc rester
 * autonome : aucune référence à un autre symbole du module, uniquement ses paramètres.
 */
export function resolveRootTheme(
  pathname: string,
  stored: unknown,
  prefersDark: boolean,
  prefixes: readonly string[],
  excluded: readonly string[] = [],
  phone = false
): ResolvedTheme | null {
  let scoped = false;
  for (let i = 0; i < prefixes.length; i++) {
    if (pathname === prefixes[i] || pathname.indexOf(prefixes[i] + "/") === 0) scoped = true;
  }
  for (let j = 0; j < excluded.length; j++) {
    if (pathname === excluded[j] || pathname.indexOf(excluded[j] + "/") === 0) scoped = false;
  }
  if (!scoped) return null;
  if (phone) return "light";
  if (stored === "light" || stored === "dark") return stored;
  return prefersDark ? "dark" : "light";
}

export function isThemeScopedPath(pathname: string): boolean {
  return resolveRootTheme(pathname, "light", false, THEME_SCOPED_PATH_PREFIXES, THEME_EXCLUDED_PATH_PREFIXES) !== null;
}

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): ResolvedTheme {
  return pref === "system" ? (prefersDark ? "dark" : "light") : pref;
}

/**
 * Applique (ou retire) `data-theme` sur la racine lors des navigations client et des changements de
 * préférence ou de thème du système. Au premier chargement, c'est THEME_INIT_SCRIPT qui pose l'attribut
 * avant l'hydratation ; les deux passent par resolveRootTheme.
 */
export function applyThemeToRoot(
  root: { setAttribute(name: string, value: string): void; removeAttribute(name: string): void },
  pathname: string,
  pref: ThemePreference,
  prefersDark: boolean,
  phone = false
): void {
  const theme = resolveRootTheme(pathname, pref, prefersDark, THEME_SCOPED_PATH_PREFIXES, THEME_EXCLUDED_PATH_PREFIXES, phone);
  if (theme) root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
}

/**
 * Script exécuté avant l'hydratation (dans <head>) : lit la préférence mémorisée et le thème du système,
 * puis pose `data-theme` sur <html> via resolveRootTheme (même code que ThemeSync), sans flash au chargement.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var v=null;try{v=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)})}catch(e){}var d=!!(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);var p=!!(window.matchMedia&&window.matchMedia(${JSON.stringify(PHONE_MEDIA_QUERY)}).matches);var t=(${resolveRootTheme.toString()})(location.pathname,v,d,${JSON.stringify(THEME_SCOPED_PATH_PREFIXES)},${JSON.stringify(
  THEME_EXCLUDED_PATH_PREFIXES
)},p);if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
