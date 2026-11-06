import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DriverLocationStatus } from "../src/features/driver/driver-location-status";
import {
  DriverLocationPublishError,
  driverLocationStatusMessage,
  geolocationErrorStatus,
  locationIsStale,
  publishDriverLocation,
} from "../src/lib/tracking/driver-location-client";

test("MOB-01A : chaque erreur GPS devient un état explicite", () => {
  assert.equal(geolocationErrorStatus(1), "denied");
  assert.equal(geolocationErrorStatus(2), "unavailable");
  assert.equal(geolocationErrorStatus(3), "timeout");
  assert.match(driverLocationStatusMessage({ status: "denied" }), /refusée/i);
  assert.match(driverLocationStatusMessage({ status: "offline" }), /hors ligne/i);
  assert.match(driverLocationStatusMessage({ status: "sync-error", error: "Serveur indisponible." }), /Serveur indisponible/);
});

test("MOB-01A : la fraîcheur expire exactement au seuil", () => {
  const last = "2026-10-14T12:00:00.000Z";
  const threshold = 45_000;
  assert.equal(locationIsStale(last, threshold, Date.parse(last) + threshold - 1), false);
  assert.equal(locationIsStale(last, threshold, Date.parse(last) + threshold), true);
  assert.equal(locationIsStale(null, threshold, Date.parse(last) + threshold), false);
});

test("MOB-01A : seule une confirmation serveur valide marque la position synchronisée", async () => {
  let requestBody: unknown;
  const result = await publishDriverLocation(
    { latitude: 48.8, longitude: 2.3, accuracy: 12 },
    (async (_url: string | URL | Request, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ data: { updatedAt: "2026-10-14T12:00:01.000Z" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch
  );
  assert.deepEqual(requestBody, { latitude: 48.8, longitude: 2.3, accuracy: 12 });
  assert.equal(result.updatedAt, "2026-10-14T12:00:01.000Z");
});

test("MOB-01A : refus HTTP, réponse invalide et perte réseau restent des erreurs", async () => {
  await assert.rejects(
    publishDriverLocation(
      { latitude: 48.8, longitude: 2.3 },
      (async () => new Response(JSON.stringify({ error: "Service arrêté : position non enregistrée." }), { status: 409 })) as typeof fetch
    ),
    (error: unknown) => error instanceof DriverLocationPublishError && error.status === 409 && /Service arrêté/.test(error.message)
  );
  await assert.rejects(
    publishDriverLocation(
      { latitude: 48.8, longitude: 2.3 },
      (async () => new Response("<html>", { status: 502 })) as typeof fetch
    ),
    /Réponse de synchronisation invalide/
  );
  await assert.rejects(
    publishDriverLocation(
      { latitude: 48.8, longitude: 2.3 },
      (async () => { throw new TypeError("network down"); }) as typeof fetch
    ),
    /Impossible de joindre Annona/
  );
});

test("MOB-01A : les erreurs, la péremption et l’arrêt sont visibles dans l’interface", () => {
  const denied = renderToStaticMarkup(createElement(DriverLocationStatus, { status: "denied", onRetry: () => undefined }));
  assert.match(denied, /role="alert"/);
  assert.match(denied, /Localisation refusée/);
  assert.match(denied, /Réessayer/);

  const syncError = renderToStaticMarkup(createElement(DriverLocationStatus, {
    status: "sync-error",
    error: "Service arrêté : position non enregistrée.",
    lastSyncedAt: "2026-10-14T12:00:00.000Z",
  }));
  assert.match(syncError, /Service arrêté/);
  assert.match(syncError, /Dernière synchronisation/);

  const stale = renderToStaticMarkup(createElement(DriverLocationStatus, {
    status: "stale",
    lastSyncedAt: "2026-10-14T12:00:00.000Z",
  }));
  assert.match(stale, /Position périmée/);

  const stopped = renderToStaticMarkup(createElement(DriverLocationStatus, {
    status: "stopped",
    detail: "Partage GPS arrêté : service fermé.",
  }));
  assert.match(stopped, /role="status"/);
  assert.match(stopped, /service fermé/);
});
