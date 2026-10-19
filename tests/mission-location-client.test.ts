import assert from "node:assert/strict";
import test from "node:test";
import { clearRememberedDriverPosition, getCurrentDriverPosition, rememberDriverPosition, POSITION_WAIT_MS } from "../src/lib/maps/driver-proximity";
import { checkMissionLocationProximity } from "../src/features/driver/mission-location-guard";
import { checkProximityWithTimeout, PROXIMITY_WAIT_MS } from "../src/features/driver/api";

const point = { coords: { latitude: 48.8, longitude: 2.3, accuracy: 9 }, timestamp: Date.now() } as GeolocationPosition;
function browser(getCurrentPosition: (success: PositionCallback, error: PositionErrorCallback) => void) {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation: { getCurrentPosition } } });
}
test("UX-01 : le signal frais du suivi est réutilisé sans nouvelle acquisition", async () => {
  browser(() => { throw new Error("Nouvelle acquisition inutile"); });
  rememberDriverPosition({ ...point, timestamp: Date.now() });
  assert.deepEqual(await getCurrentDriverPosition(), { latitude: 48.8, longitude: 2.3, accuracy: 9 });
  clearRememberedDriverPosition();
});
test("UX-01 : appels simultanés partagent une acquisition et un refus ne relance rien", async () => {
  let calls = 0;
  let fail!: () => void;
  browser((_success, error) => { calls++; fail = () => error({ code: 1 } as GeolocationPositionError); });
  const first = getCurrentDriverPosition();
  const second = getCurrentDriverPosition();
  assert.equal(first, second);
  fail();
  assert.equal(await first, null);
  assert.equal(calls, 1);
});
test("UX-01 : le navigateur muet et une réponse tardive sont bornés à six secondes", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let success!: (value: GeolocationPosition) => void;
  browser((callback) => { success = callback; });
  clearRememberedDriverPosition();
  const request = getCurrentDriverPosition();
  t.mock.timers.tick(POSITION_WAIT_MS);
  assert.equal(await request, null);
  success(point);
  let calls = 0;
  browser((_ok, error) => { calls++; error({ code: 2 } as GeolocationPositionError); });
  assert.equal(await getCurrentDriverPosition(), null);
  assert.equal(calls, 1);
});
test("UX-01 : signal périmé remplacé par une seule acquisition", async () => {
  rememberDriverPosition({ ...point, timestamp: Date.now() - 60_000 });
  let calls = 0;
  browser((success) => { calls++; success({ ...point, timestamp: Date.now() }); });
  assert.equal((await getCurrentDriverPosition())?.latitude, 48.8);
  assert.equal(calls, 1);
  clearRememberedDriverPosition();
});
test("UX-01 : proximité transmet et restitue exactement la position pour mutation/confirmation", async () => {
  const original = globalThis.fetch;
  rememberDriverPosition({ ...point, timestamp: Date.now() });
  browser(() => { throw new Error("GPS relancé"); });
  try {
    for (const near of [true, false]) {
      globalThis.fetch = (async (url) => {
        assert.match(String(url), /latitude=48.8&longitude=2.3/);
        return Response.json({ data: { kind: "delivery", near, hasLocation: true, distanceMeters: near ? 3 : 300, thresholdMeters: 150 } });
      }) as typeof fetch;
      const result = await checkMissionLocationProximity("fixture-ux01", "delivery");
      assert.equal(result.proceed, near);
      assert.deepEqual(result.position, { latitude: 48.8, longitude: 2.3, accuracy: 9 });
      if (!result.proceed) assert.equal(result.block.distanceMeters, 300);
    }
  } finally { globalThis.fetch = original; clearRememberedDriverPosition(); }
});
test("UX-01 : serveur muet annulé à huit secondes, sans envoyer de confirmation", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const original = globalThis.fetch;
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = ((_url, init) => { signal = init?.signal; return new Promise(() => {}); }) as typeof fetch;
  try {
    const request = checkProximityWithTimeout("/fixture-ux01");
    const rejected = assert.rejects(request, /prend trop de temps.*Aucune confirmation/);
    t.mock.timers.tick(PROXIMITY_WAIT_MS);
    await rejected;
    assert.equal(signal?.aborted, true);
  } finally { globalThis.fetch = original; }
});
