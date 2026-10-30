import { haversineMeters } from "@/lib/maps/navigation-utils";
import { isValidCoordinate, serverRouteProviderConfig } from "@/lib/maps/provider-config";

/**
 * DISPATCH-4 — temps de trajet livreur → point de retrait.
 *
 * Contrat OSRM (documentation officielle v5.24, service `table`) :
 * - `GET /table/v1/driving/{lng,lat;…}?sources=…&destinations=…&annotations=duration` ;
 * - succès : HTTP 200 et `code: "Ok"`, `durations` matrice ligne par source, en secondes,
 *   cellule `null` quand aucun itinéraire n'existe entre la source et la destination ;
 * - erreurs : HTTP 400 avec `code` parmi `InvalidUrl`, `InvalidService`, `InvalidVersion`,
 *   `InvalidOptions`, `InvalidQuery`, `InvalidValue`, `NoSegment` (coordonnée non rattachable
 *   au réseau), `TooBig`, et pour `table` `NoTable` / `NotImplemented` (`NoRoute` pour `route`) ;
 * - toute autre réponse (429 du serveur public, 5xx, corps illisible, délai) = indisponible.
 *
 * Dimensionnement : la présélection est locale (haversine, O(n) + tri O(n log n)) ; seuls les
 * `ROUTE_CANDIDATES` plus proches partent dans UN appel `table` (n sources, 1 destination).
 * Pour 200 livreurs : 200 calculs haversine, un tri, une requête de 9 coordonnées, quel que
 * soit le nombre de livreurs. Jamais d'appel par livreur, jamais dans une transaction.
 *
 * Confidentialité : les positions ne partent que vers l'endpoint HTTPS approuvé
 * `DRIVE_ROUTE_OSRM_URL` (jamais le serveur public par défaut) ; aucune coordonnée n'est
 * journalisée ni renvoyée. Sans endpoint configuré, repli explicite `NOT_CONFIGURED`.
 */

export type GeoPoint = { latitude: number; longitude: number };

export type TravelFallbackReason =
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "NO_ROUTE"
  | "NO_SEGMENT"
  | "INVALID_RESPONSE"
  | "NOT_PRESELECTED"
  | "BUDGET";

export type TravelEstimate =
  | { source: "ROUTE"; seconds: number }
  | { source: "STRAIGHT_LINE"; seconds: number; fallbackReason: TravelFallbackReason };

export const TRAVEL_FALLBACK_LABELS: Record<TravelFallbackReason, string> = {
  NOT_CONFIGURED: "service de trajet non configuré",
  UNAVAILABLE: "service de trajet indisponible",
  TIMEOUT: "service de trajet trop lent",
  NO_ROUTE: "aucun itinéraire routier trouvé",
  NO_SEGMENT: "un point hors du réseau routier",
  INVALID_RESPONSE: "réponse du service de trajet illisible",
  NOT_PRESELECTED: "livreur éloigné, trajet non calculé",
  BUDGET: "file longue, trajet non calculé",
};

/** Livreurs les plus proches à vol d'oiseau envoyés au service de trajet. */
export const ROUTE_CANDIDATES = 8;
export const ROUTE_TIMEOUT_MS = 2_500;
export const ROUTE_CACHE_TTL_MS = 2 * 60_000;
export const ROUTE_CACHE_MAX_ENTRIES = 1_000;
/** Après une panne, le service n'est plus interrogé pendant ce délai (repli immédiat). */
export const ROUTE_FAILURE_COOLDOWN_MS = 30_000;
/**
 * Estimation à vol d'oiseau : 30 km/h en ville et un détour de 40 %. Grossière mais du même
 * ordre que le trajet réel ; la raison du repli est toujours affichée.
 */
const STRAIGHT_LINE_SPEED_MPS = 30_000 / 3_600;
const STRAIGHT_LINE_DETOUR = 1.4;

export function straightLineSeconds(from: GeoPoint, to: GeoPoint): number {
  return Math.round((haversineMeters(from, to) * STRAIGHT_LINE_DETOUR) / STRAIGHT_LINE_SPEED_MPS);
}

/** Clé arrondie à 3 décimales (environ 100 m) : un livreur qui bouge peu réutilise le trajet. */
const round = (value: number) => value.toFixed(3);
const cacheKey = (from: GeoPoint, to: GeoPoint) =>
  `${round(from.latitude)},${round(from.longitude)}>${round(to.latitude)},${round(to.longitude)}`;

type CacheEntry = { seconds: number | null; expiresAt: number };

export type TravelTimeState = {
  cache: Map<string, CacheEntry>;
  unavailableUntil: number;
  lastFailure: TravelFallbackReason | null;
};

export function createTravelTimeState(): TravelTimeState {
  return { cache: new Map(), unavailableUntil: 0, lastFailure: null };
}

/** État du processus : borné en taille et en durée, jamais persistant. */
const processState = createTravelTimeState();

function readCache(state: TravelTimeState, key: string, now: number): CacheEntry | null {
  const entry = state.cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    state.cache.delete(key);
    return null;
  }
  return entry;
}

function writeCache(state: TravelTimeState, key: string, seconds: number | null, now: number) {
  state.cache.delete(key);
  state.cache.set(key, { seconds, expiresAt: now + ROUTE_CACHE_TTL_MS });
  // Ordre d'insertion : la plus ancienne entrée part d'abord.
  while (state.cache.size > ROUTE_CACHE_MAX_ENTRIES) {
    const oldest = state.cache.keys().next().value;
    if (oldest === undefined) break;
    state.cache.delete(oldest);
  }
}

type FetchLike = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

type TableOutcome =
  | { ok: true; durations: Array<number | null> }
  | { ok: false; reason: TravelFallbackReason; cooldown: boolean };

async function requestTable(
  baseUrl: string,
  origins: GeoPoint[],
  destination: GeoPoint,
  fetchImpl: FetchLike,
  timeoutMs: number
): Promise<TableOutcome> {
  const coords = [...origins, destination].map((p) => `${p.longitude},${p.latitude}`).join(";");
  const sources = origins.map((_, index) => index).join(";");
  const url = `${baseUrl}/table/v1/driving/${coords}?sources=${sources}&destinations=${origins.length}&annotations=duration`;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const body = await Promise.race([
      (async () => {
        const response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
        let json: unknown = null;
        try {
          json = await response.json();
        } catch {
          json = null;
        }
        return { status: response.status, ok: response.ok, json };
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("ROUTE_TIMEOUT"));
        }, timeoutMs);
      }),
    ]);
    const code = (body.json as { code?: unknown } | null)?.code;
    if (code === "NoSegment") return { ok: false, reason: "NO_SEGMENT", cooldown: false };
    if (code === "NoTable" || code === "NoRoute") return { ok: false, reason: "NO_ROUTE", cooldown: false };
    if (!body.ok) return { ok: false, reason: "UNAVAILABLE", cooldown: true };
    if (code !== "Ok") return { ok: false, reason: "INVALID_RESPONSE", cooldown: true };
    const matrix = (body.json as { durations?: unknown }).durations;
    if (!Array.isArray(matrix) || matrix.length !== origins.length) {
      return { ok: false, reason: "INVALID_RESPONSE", cooldown: true };
    }
    const durations: Array<number | null> = [];
    for (const row of matrix) {
      if (!Array.isArray(row) || row.length !== 1) return { ok: false, reason: "INVALID_RESPONSE", cooldown: true };
      const cell = row[0];
      if (cell === null) durations.push(null);
      else if (typeof cell === "number" && Number.isFinite(cell) && cell >= 0) durations.push(Math.round(cell));
      else return { ok: false, reason: "INVALID_RESPONSE", cooldown: true };
    }
    return { ok: true, durations };
  } catch (error) {
    const timeout = controller.signal.aborted || (error instanceof Error && error.message === "ROUTE_TIMEOUT");
    return { ok: false, reason: timeout ? "TIMEOUT" : "UNAVAILABLE", cooldown: true };
  } finally {
    clearTimeout(timer);
  }
}

export type TravelTimeOptions = {
  /** Endpoint OSRM ; par défaut l'endpoint serveur approuvé. `null` = non configuré. */
  baseUrl?: string | null;
  fetchImpl?: FetchLike;
  now?: () => number;
  state?: TravelTimeState;
  timeoutMs?: number;
  /** Faux : aucun appel réseau (budget d'un passage de file épuisé). */
  allowNetwork?: boolean;
};

/**
 * Temps de trajet de chaque livreur positionné jusqu'au retrait. Ne lève jamais : toute
 * panne donne une estimation à vol d'oiseau avec sa raison. `networkCalls` compte l'appel.
 */
export async function estimateTravelTimes(
  origins: Array<{ id: string; point: GeoPoint }>,
  destination: GeoPoint,
  options: TravelTimeOptions = {}
): Promise<{ estimates: Map<string, TravelEstimate>; networkCalls: number }> {
  const state = options.state ?? processState;
  const now = (options.now ?? Date.now)();
  const baseUrl = options.baseUrl === undefined ? serverRouteProviderConfig()?.osrmUrl ?? null : options.baseUrl;
  const estimates = new Map<string, TravelEstimate>();
  const fallback = (id: string, point: GeoPoint, reason: TravelFallbackReason) =>
    estimates.set(id, { source: "STRAIGHT_LINE", seconds: straightLineSeconds(point, destination), fallbackReason: reason });

  const valid = origins.filter((o) => isValidCoordinate(o.point.latitude, o.point.longitude));
  if (valid.length === 0 || !isValidCoordinate(destination.latitude, destination.longitude)) {
    return { estimates, networkCalls: 0 };
  }

  // Présélection locale : les plus proches à vol d'oiseau seulement.
  const ranked = valid
    .map((origin) => ({ ...origin, meters: haversineMeters(origin.point, destination) }))
    .sort((a, b) => a.meters - b.meters || a.id.localeCompare(b.id));
  const preselected = ranked.slice(0, ROUTE_CANDIDATES);
  for (const rest of ranked.slice(ROUTE_CANDIDATES)) fallback(rest.id, rest.point, "NOT_PRESELECTED");

  if (!baseUrl) {
    for (const item of preselected) fallback(item.id, item.point, "NOT_CONFIGURED");
    return { estimates, networkCalls: 0 };
  }

  const missing: typeof preselected = [];
  for (const item of preselected) {
    const cached = readCache(state, cacheKey(item.point, destination), now);
    if (!cached) missing.push(item);
    else if (cached.seconds === null) fallback(item.id, item.point, "NO_ROUTE");
    else estimates.set(item.id, { source: "ROUTE", seconds: cached.seconds });
  }
  if (missing.length === 0) return { estimates, networkCalls: 0 };

  if (options.allowNetwork === false) {
    for (const item of missing) fallback(item.id, item.point, "BUDGET");
    return { estimates, networkCalls: 0 };
  }
  if (state.unavailableUntil > now) {
    for (const item of missing) fallback(item.id, item.point, state.lastFailure ?? "UNAVAILABLE");
    return { estimates, networkCalls: 0 };
  }

  // `NoSegment` rejette toute la matrice sans dire quel point : la même requête n'est pas
  // rejouée pendant la durée du cache.
  const requestKey = `req:${missing.map((item) => cacheKey(item.point, destination)).join("|")}`;
  if (readCache(state, requestKey, now)) {
    for (const item of missing) fallback(item.id, item.point, "NO_SEGMENT");
    return { estimates, networkCalls: 0 };
  }

  const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
  const outcome = await requestTable(
    baseUrl.replace(/\/$/, ""),
    missing.map((item) => item.point),
    destination,
    fetchImpl,
    options.timeoutMs ?? ROUTE_TIMEOUT_MS
  );
  if (!outcome.ok) {
    if (outcome.reason === "NO_SEGMENT") writeCache(state, requestKey, null, now);
    if (outcome.cooldown) {
      state.unavailableUntil = now + ROUTE_FAILURE_COOLDOWN_MS;
      state.lastFailure = outcome.reason;
    }
    for (const item of missing) fallback(item.id, item.point, outcome.reason);
    return { estimates, networkCalls: 1 };
  }
  state.unavailableUntil = 0;
  state.lastFailure = null;
  missing.forEach((item, index) => {
    const seconds = outcome.durations[index] ?? null;
    writeCache(state, cacheKey(item.point, destination), seconds, now);
    if (seconds === null) fallback(item.id, item.point, "NO_ROUTE");
    else estimates.set(item.id, { source: "ROUTE", seconds });
  });
  return { estimates, networkCalls: 1 };
}

/** Au-delà, pas d'appel : une matrice de cette taille reste bornée pour le service gratuit. */
export const ROUTE_MATRIX_MAX_POINTS = 60;

export type TravelMatrix = {
  /** Temps de trajet en secondes ; à vol d'oiseau si le service n'a pas répondu. */
  seconds: (from: GeoPoint, to: GeoPoint) => number;
  /** Vrai si tout ou partie des temps sont estimés à vol d'oiseau. */
  approximate: boolean;
};

/**
 * Tournées — un seul appel `table` pour tous les points, hors transaction. Ne lève jamais : sans
 * service, trop de points ou panne, les temps sont à vol d'oiseau et `approximate` le dit.
 */
export async function estimateTravelMatrix(points: GeoPoint[], options: TravelTimeOptions = {}): Promise<TravelMatrix> {
  const state = options.state ?? processState;
  const now = (options.now ?? Date.now)();
  const baseUrl = options.baseUrl === undefined ? serverRouteProviderConfig()?.osrmUrl ?? null : options.baseUrl;
  const straight: TravelMatrix = { seconds: straightLineSeconds, approximate: true };
  const key = (point: GeoPoint) => `${round(point.latitude)},${round(point.longitude)}`;
  const unique = [...new Map(points.filter((p) => isValidCoordinate(p.latitude, p.longitude)).map((p) => [key(p), p])).values()];
  if (!baseUrl || unique.length < 2 || unique.length > ROUTE_MATRIX_MAX_POINTS || state.unavailableUntil > now) return straight;

  const coords = unique.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? ROUTE_TIMEOUT_MS);
  try {
    const fetchImpl = options.fetchImpl ?? (fetch as unknown as FetchLike);
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/table/v1/driving/${coords}?annotations=duration`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const body = (await response.json()) as { code?: unknown; durations?: unknown };
    const matrix = body.durations;
    if (!response.ok || body.code !== "Ok" || !Array.isArray(matrix) || matrix.length !== unique.length) throw new Error("ROUTE_MATRIX_INVALID");
    const index = new Map(unique.map((point, position) => [key(point), position]));
    const seconds = (from: GeoPoint, to: GeoPoint) => {
      const cell = (matrix[index.get(key(from)) ?? -1] as unknown[] | undefined)?.[index.get(key(to)) ?? -1];
      // Cellule nulle : pas d'itinéraire entre ces deux points, repli local pour ce trajet.
      return typeof cell === "number" && Number.isFinite(cell) && cell >= 0 ? Math.round(cell) : straightLineSeconds(from, to);
    };
    return { seconds, approximate: false };
  } catch {
    state.unavailableUntil = now + ROUTE_FAILURE_COOLDOWN_MS;
    state.lastFailure = "UNAVAILABLE";
    return straight;
  } finally {
    clearTimeout(timer);
  }
}
