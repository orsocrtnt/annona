/** Public values are embedded by Next at build time. No private API keys here. */
export function tileProviderConfig(values: { url?: string; attribution?: string; maxNativeZoom?: string } = {
  url: process.env.NEXT_PUBLIC_MAP_TILE_URL,
  attribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION,
  maxNativeZoom: process.env.NEXT_PUBLIC_MAP_MAX_NATIVE_ZOOM,
}) {
  const nativeZoom = Number(values.maxNativeZoom);
  const custom = Boolean(values.url && values.attribution);
  return {
    url: custom ? values.url! : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: custom ? values.attribution! : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    minZoom: 1,
    maxZoom: custom ? (Number.isInteger(nativeZoom) && nativeZoom >= 1 && nativeZoom <= 19 ? nativeZoom : 1) : 19,
  };
}

export const MAP_TILES = tileProviderConfig();

/**
 * Plan vectoriel (direction Menthe). Une valeur vide désactive le vectoriel : la carte
 * revient au plan raster ci-dessus. Le service public OpenFreeMap n'a pas de garantie de
 * disponibilité : pour la production, pointer vers une instance hébergée ou un fournisseur.
 */
export function vectorStyleConfig(url: string | undefined = process.env.NEXT_PUBLIC_MAP_STYLE_URL) {
  const styleUrl = url === undefined ? "https://tiles.openfreemap.org/styles/positron" : url.trim();
  return {
    styleUrl: styleUrl || null,
    attribution:
      '<a href="https://openfreemap.org">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}

export const MAP_VECTOR = vectorStyleConfig();

/** Worker MapLibre copié au postinstall (scripts/maps/copy-maplibre-worker.mjs) et servi depuis `public/`. */
export const MAPLIBRE_WORKER_PATH = "/vendor/maplibre-gl-worker.mjs";

export function maplibreWorkerUrl(version: string) {
  return `${MAPLIBRE_WORKER_PATH}?v=${encodeURIComponent(version)}`;
}
export const PROVIDER_TIMEOUT_MS = 8_000;
export const TILE_TIMEOUT_MS = 10_000;
export const ROUTE_REFRESH_MS = 30_000;
export const GEOCODING_URL = process.env.GEOCODING_URL || "https://data.geopf.fr/geocodage/search";

function privateHttpsEndpoint(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href.replace(/\/$/, "") : null;
  } catch { return null; }
}

/** Le serveur n'envoie des positions réelles qu'à des endpoints explicitement approuvés. */
export function serverRouteProviderConfig(values: { osrmUrl?: string; ignUrl?: string } = {
  osrmUrl: process.env.DRIVE_ROUTE_OSRM_URL,
  ignUrl: process.env.DRIVE_ROUTE_IGN_URL,
}) {
  const osrmUrl = privateHttpsEndpoint(values.osrmUrl);
  const ignUrl = privateHttpsEndpoint(values.ignUrl);
  return osrmUrl || ignUrl ? { osrmUrl, ignUrl } : null;
}

export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}
