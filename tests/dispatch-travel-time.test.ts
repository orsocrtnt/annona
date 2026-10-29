import assert from "node:assert/strict";
import test from "node:test";
import {
  ROUTE_CACHE_MAX_ENTRIES,
  ROUTE_CACHE_TTL_MS,
  ROUTE_CANDIDATES,
  ROUTE_FAILURE_COOLDOWN_MS,
  createTravelTimeState,
  estimateTravelTimes,
  straightLineSeconds,
} from "../src/lib/dispatch/travel-time";

// Seule la frontière réseau est simulée : la fonction testée tourne réellement.
type Reply = { status: number; body?: unknown; throws?: Error; hang?: boolean; badJson?: boolean };
function fakeOsrm(replies: Reply[] | ((url: string) => Reply)) {
  const urls: string[] = [];
  const fetchImpl = async (url: string, init: { signal: AbortSignal }) => {
    urls.push(url);
    const reply = typeof replies === "function" ? replies(url) : replies.shift() ?? { status: 500 };
    if (reply.throws) throw reply.throws;
    if (reply.hang) {
      await new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    }
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => {
        if (reply.badJson) throw new SyntaxError("Unexpected token <");
        return reply.body;
      },
    };
  };
  return { fetchImpl, urls };
}

const pickup = { latitude: 48.8566, longitude: 2.3522 };
const at = (id: string, dLat: number) => ({ id, point: { latitude: pickup.latitude + dLat, longitude: pickup.longitude } });
const okTable = (durations: Array<number | null>) => ({ status: 200, body: { code: "Ok", durations: durations.map((d) => [d]) } });
const base = "https://osrm.example.test";

test("trajet : sans endpoint approuvé, repli explicite à vol d'oiseau et aucun appel réseau", async () => {
  const osrm = fakeOsrm([]);
  const { estimates, networkCalls } = await estimateTravelTimes([at("a", 0.01)], pickup, {
    baseUrl: null, fetchImpl: osrm.fetchImpl, state: createTravelTimeState(),
  });
  assert.equal(networkCalls, 0);
  assert.equal(osrm.urls.length, 0);
  const estimate = estimates.get("a");
  assert.equal(estimate?.source, "STRAIGHT_LINE");
  assert.equal(estimate?.source === "STRAIGHT_LINE" && estimate.fallbackReason, "NOT_CONFIGURED");
  assert.equal(estimate?.seconds, straightLineSeconds(at("a", 0.01).point, pickup));
});

test("trajet : un seul appel table pour 200 livreurs, présélection des plus proches", async () => {
  const origins = Array.from({ length: 200 }, (_, i) => at(`d${String(i).padStart(3, "0")}`, 0.001 * (200 - i)));
  const osrm = fakeOsrm(() => okTable(Array.from({ length: ROUTE_CANDIDATES }, (_, i) => 60 * (i + 1))));
  const { estimates, networkCalls } = await estimateTravelTimes(origins, pickup, {
    baseUrl: base, fetchImpl: osrm.fetchImpl, state: createTravelTimeState(),
  });
  assert.equal(networkCalls, 1);
  assert.equal(osrm.urls.length, 1);
  const url = new URL(osrm.urls[0]!);
  assert.match(url.pathname, /^\/table\/v1\/driving\//);
  const coordinates = url.pathname.replace("/table/v1/driving/", "").split(";");
  assert.equal(coordinates.length, ROUTE_CANDIDATES + 1, "8 sources + le retrait");
  assert.equal(coordinates.at(-1), `${pickup.longitude},${pickup.latitude}`, "retrait en dernière position, ordre lng,lat");
  assert.equal(url.searchParams.get("destinations"), String(ROUTE_CANDIDATES));
  assert.equal(url.searchParams.get("sources"), "0;1;2;3;4;5;6;7");
  assert.equal(url.searchParams.get("annotations"), "duration");
  // Les 8 plus proches (d199 → d192) ont le trajet routier ; les autres, un repli motivé.
  assert.deepEqual(estimates.get("d199"), { source: "ROUTE", seconds: 60 });
  assert.deepEqual(estimates.get("d192"), { source: "ROUTE", seconds: 480 });
  const far = estimates.get("d000");
  assert.equal(far?.source === "STRAIGHT_LINE" && far.fallbackReason, "NOT_PRESELECTED");
  assert.equal(estimates.size, 200);
  for (const value of estimates.values()) {
    assert.deepEqual(Object.keys(value).sort(), value.source === "ROUTE" ? ["seconds", "source"] : ["fallbackReason", "seconds", "source"]);
  }
});

test("trajet : cache à clé arrondie, durée de vie courte et taille bornée", async () => {
  const state = createTravelTimeState();
  let now = 1_000_000;
  const osrm = fakeOsrm(() => okTable([300]));
  const options = { baseUrl: base, fetchImpl: osrm.fetchImpl, state, now: () => now };
  await estimateTravelTimes([at("a", 0.01)], pickup, options);
  // Déplacement de quelques mètres : même clé arrondie, pas de nouvel appel.
  const moved = { id: "a", point: { latitude: pickup.latitude + 0.01 + 0.0001, longitude: pickup.longitude } };
  const second = await estimateTravelTimes([moved], pickup, options);
  assert.equal(second.networkCalls, 0);
  assert.deepEqual(second.estimates.get("a"), { source: "ROUTE", seconds: 300 });
  now += ROUTE_CACHE_TTL_MS + 1;
  const expired = await estimateTravelTimes([at("a", 0.01)], pickup, options);
  assert.equal(expired.networkCalls, 1, "entrée expirée : nouvel appel");

  const big = createTravelTimeState();
  const many = fakeOsrm(() => okTable([10]));
  for (let i = 0; i < ROUTE_CACHE_MAX_ENTRIES + 50; i += 1) {
    await estimateTravelTimes([at(`x${i}`, 0.001 * i)], pickup, { baseUrl: base, fetchImpl: many.fetchImpl, state: big, now: () => now });
  }
  assert.equal(big.cache.size, ROUTE_CACHE_MAX_ENTRIES);
});

test("trajet : cellule null = aucun itinéraire pour ce livreur seulement", async () => {
  const osrm = fakeOsrm([okTable([120, null])]);
  const { estimates } = await estimateTravelTimes([at("a", 0.001), at("b", 0.002)], pickup, {
    baseUrl: base, fetchImpl: osrm.fetchImpl, state: createTravelTimeState(),
  });
  assert.deepEqual(estimates.get("a"), { source: "ROUTE", seconds: 120 });
  const b = estimates.get("b");
  assert.equal(b?.source === "STRAIGHT_LINE" && b.fallbackReason, "NO_ROUTE");
});

test("trajet : codes OSRM documentés et erreurs HTTP donnent un repli motivé", async () => {
  const cases: Array<[Reply, string, boolean]> = [
    [{ status: 400, body: { code: "NoSegment", message: "Could not find a matching segment" } }, "NO_SEGMENT", false],
    [{ status: 400, body: { code: "NoTable" } }, "NO_ROUTE", false],
    [{ status: 200, body: { code: "NoRoute" } }, "NO_ROUTE", false],
    [{ status: 400, body: { code: "TooBig" } }, "UNAVAILABLE", true],
    [{ status: 400, body: { code: "InvalidQuery" } }, "UNAVAILABLE", true],
    [{ status: 429, body: { message: "Too Many Requests" } }, "UNAVAILABLE", true],
    [{ status: 503, badJson: true }, "UNAVAILABLE", true],
    [{ status: 200, body: { code: "Ok", durations: [[1], [2]] } }, "INVALID_RESPONSE", true],
    [{ status: 200, body: { code: "Ok", durations: [["12"]] } }, "INVALID_RESPONSE", true],
    [{ status: 200, body: { code: "Ok" } }, "INVALID_RESPONSE", true],
    [{ status: 200, body: { code: "NotImplemented" } }, "INVALID_RESPONSE", true],
    [{ status: 200, badJson: true }, "INVALID_RESPONSE", true],
    [{ status: 0, throws: new TypeError("fetch failed") }, "UNAVAILABLE", true],
  ];
  for (const [reply, reason, cooldown] of cases) {
    const state = createTravelTimeState();
    const osrm = fakeOsrm([reply]);
    const { estimates } = await estimateTravelTimes([at("a", 0.01)], pickup, { baseUrl: base, fetchImpl: osrm.fetchImpl, state, now: () => 5_000 });
    const a = estimates.get("a");
    assert.equal(a?.source, "STRAIGHT_LINE", JSON.stringify(reply));
    assert.equal(a?.source === "STRAIGHT_LINE" && a.fallbackReason, reason, JSON.stringify(reply));
    assert.equal(state.unavailableUntil > 5_000, cooldown, `pause après ${JSON.stringify(reply)}`);
  }
});

test("trajet : délai dépassé → TIMEOUT borné, puis pause sans appel, puis reprise", async () => {
  const state = createTravelTimeState();
  let now = 10_000;
  const osrm = fakeOsrm([{ status: 200, hang: true }, okTable([90])]);
  const options = { baseUrl: base, fetchImpl: osrm.fetchImpl, state, now: () => now, timeoutMs: 20 };
  const started = Date.now();
  const first = await estimateTravelTimes([at("a", 0.01)], pickup, options);
  assert.ok(Date.now() - started < 1_000, "le délai borne l'attente");
  const a = first.estimates.get("a");
  assert.equal(a?.source === "STRAIGHT_LINE" && a.fallbackReason, "TIMEOUT");

  now += 1_000;
  const during = await estimateTravelTimes([at("a", 0.01)], pickup, options);
  assert.equal(during.networkCalls, 0, "pendant la pause : repli immédiat");
  const d = during.estimates.get("a");
  assert.equal(d?.source === "STRAIGHT_LINE" && d.fallbackReason, "TIMEOUT");

  now += ROUTE_FAILURE_COOLDOWN_MS;
  const after = await estimateTravelTimes([at("a", 0.01)], pickup, options);
  assert.equal(after.networkCalls, 1);
  assert.deepEqual(after.estimates.get("a"), { source: "ROUTE", seconds: 90 });
});

test("trajet : budget épuisé → aucun appel, raison BUDGET ; coordonnées invalides ignorées", async () => {
  const osrm = fakeOsrm([]);
  const { estimates, networkCalls } = await estimateTravelTimes(
    [at("a", 0.01), { id: "bad", point: { latitude: Number.NaN, longitude: 2 } }],
    pickup,
    { baseUrl: base, fetchImpl: osrm.fetchImpl, state: createTravelTimeState(), allowNetwork: false }
  );
  assert.equal(networkCalls, 0);
  const a = estimates.get("a");
  assert.equal(a?.source === "STRAIGHT_LINE" && a.fallbackReason, "BUDGET");
  assert.equal(estimates.has("bad"), false);
});
