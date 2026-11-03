// SEC-5 : en-têtes de sécurité appliqués par next.config.ts à toutes les routes.
// Import relatif depuis next.config : aucun alias `@/` ni dépendance serveur ici.

type HeaderEnv = Partial<Record<
  "NODE_ENV" | "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_MAP_TILE_URL" | "NEXT_PUBLIC_MAP_STYLE_URL",
  string
>>;

// Valeurs par défaut de src/lib/maps/provider-config.ts (plan OSM, vectoriel OpenFreeMap). Les itinéraires
// passent par le serveur (/api/maps/route, LEGAL-1) : aucun fournisseur d'itinéraires dans connect-src.
const DEFAULT_TILE_ORIGIN = "https://tile.openstreetmap.org";
const DEFAULT_STYLE_ORIGIN = "https://tiles.openfreemap.org";
// Plan et géocodage IGN (Géoplateforme), utilisables comme tuiles via NEXT_PUBLIC_MAP_TILE_URL.
const IGN_ORIGIN = "https://data.geopf.fr";

/** Origine https d'une URL de configuration ; `{s}` des tuiles devient un joker de sous-domaine. */
function httpsOrigin(value: string | undefined): string | null {
  const match = /^https:\/\/([^/?#]+)/i.exec(value?.trim() ?? "");
  if (!match) return null;
  const host = match[1]!.replace(/^\{s\}\./, "*.").toLowerCase();
  return /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d{1,5})?$/.test(host) ? `https://${host}` : null;
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function buildContentSecurityPolicy(env: HeaderEnv = process.env as HeaderEnv): string {
  const supabase = httpsOrigin(env.NEXT_PUBLIC_SUPABASE_URL);
  const tiles = env.NEXT_PUBLIC_MAP_TILE_URL ? httpsOrigin(env.NEXT_PUBLIC_MAP_TILE_URL) : DEFAULT_TILE_ORIGIN;
  const style = env.NEXT_PUBLIC_MAP_STYLE_URL === undefined ? DEFAULT_STYLE_ORIGIN : httpsOrigin(env.NEXT_PUBLIC_MAP_STYLE_URL);
  const maps = unique([tiles, style, IGN_ORIGIN]);
  const dev = env.NODE_ENV === "development";

  const directives: Record<string, Array<string | null>> = {
    "default-src": ["'self'"],
    // Scripts inline de Next (hydratation) sans nonce ; eval seulement en développement.
    "script-src": ["'self'", "'unsafe-inline'", dev ? "'unsafe-eval'" : null],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://*.supabase.co", ...maps],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", supabase, supabase?.replace(/^https:/, "wss:") ?? null, ...maps, dev ? "ws:" : null],
    // Worker MapLibre servi depuis /vendor ; MapLibre crée aussi des workers blob:.
    "worker-src": ["'self'", "blob:"],
    "frame-ancestors": ["'none'"],
    "frame-src": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
  };
  return Object.entries(directives).map(([name, values]) => `${name} ${unique(values).join(" ")}`).join("; ");
}

export function buildSecurityHeaders(env: HeaderEnv = process.env as HeaderEnv) {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Géolocalisation pour l'app livreur ; caméra conservée pour la preuve de livraison.
    { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=(), usb=(), browsing-topics=()" },
    // Bloquante depuis la recette SEC-AUDIT du 29 octobre 2026 (build de production : cartes, démo,
    // preuves, connexion, portail, livreur, /admin) : zéro violation après `zod-jitless`.
    { key: "Content-Security-Policy", value: buildContentSecurityPolicy(env) },
  ];
}
