/**
 * MOBILE-1, ENF-01 — réglages de l'application mobile Capacitor (iOS et Android).
 *
 * Module pur, lu par `capacitor.config.ts` (CLI Capacitor, sans alias `@/`) et par les tests.
 * Une seule application « Annona » pour les commerçants et les livreurs : elle charge le site hébergé
 * (rendu serveur et routes API : pas d'export statique) à partir de la page de connexion, qui envoie
 * chaque compte vers son espace (`/portal` ou `/driver`).
 */
export const MOBILE_APP_ID = "fr.annona.app";
export const MOBILE_APP_NAME = "Annona";
/** Page d'entrée : un compte déjà connecté est renvoyé vers son espace par le middleware. */
export const MOBILE_START_PATH = "/login";
/** Adresse locale par défaut, pour les essais sur simulateur avec `npm run dev`. */
export const MOBILE_DEFAULT_DEV_URL = "http://localhost:3000";

export interface MobileServerSettings {
  /** Origine chargée par l'application (sans chemin). */
  url: string;
  hostname: string;
  /** HTTP en clair autorisé (développement local seulement). */
  cleartext: boolean;
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|10\.0\.2\.2|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|[a-z0-9-]+\.local)$/i;

/**
 * Lit `CAPACITOR_SERVER_URL`. HTTPS obligatoire, sauf adresse locale (simulateur, émulateur Android
 * `10.0.2.2`, téléphone sur le réseau du poste) : une URL publique en HTTP est refusée.
 */
export function resolveMobileServer(raw: string | undefined): MobileServerSettings {
  const value = raw?.trim() || MOBILE_DEFAULT_DEV_URL;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`CAPACITOR_SERVER_URL invalide : ${value}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new Error("CAPACITOR_SERVER_URL doit être une origine seule (ex. https://app.annona.fr), sans chemin ni paramètre.");
  }
  const local = LOCAL_HOST.test(parsed.hostname);
  if (parsed.protocol === "http:" && !local) {
    throw new Error("CAPACITOR_SERVER_URL doit être en HTTPS hors du réseau local.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("CAPACITOR_SERVER_URL doit être en HTTP(S).");
  }
  return { url: parsed.origin, hostname: parsed.hostname, cleartext: parsed.protocol === "http:" };
}
