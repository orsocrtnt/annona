import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEMO_POSITION_CYCLE_MS,
  demoTripProgress,
  demoTripStart,
  isDemoCompanyForSimulation,
  pointAlongPolyline,
} from "../src/lib/demo/demo-live-position";

test("la simulation ne vise que les entreprises de démo", () => {
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "logiexpress-demo" }), true);
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "logiexpress-demo-pool-3" }), true);
  assert.equal(isDemoCompanyForSimulation({ isDemo: false, slug: "logiexpress-demo-pool-3" }), false, "drapeau démo absent");
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "transports-martin" }), false, "slug hors démo");
  assert.equal(isDemoCompanyForSimulation(null), false);
});

test("l'avancement va de 8 % à 90 % puis revient, sans jamais atteindre la cible", () => {
  const startedAt = new Date("2026-10-26T10:00:00Z");
  const at = (fraction: number) => demoTripProgress(startedAt, new Date(startedAt.getTime() + fraction * DEMO_POSITION_CYCLE_MS));
  assert.ok(Math.abs(at(0) - 0.08) < 1e-9);
  assert.ok(Math.abs(at(0.5) - 0.9) < 1e-9, "au plus près à mi-cycle, sans arriver");
  assert.ok(at(0.25) > at(0) && at(0.75) < at(0.5), "aller puis retour");
  assert.equal(at(1), at(0), "cycle stable");
});

test("la position simulée reste sur le tracé routier", () => {
  // Tracé en L : 2 segments égaux. À 75 %, le point est au milieu du second segment.
  const polyline: [number, number][] = [[48.85, 2.3], [48.86, 2.3], [48.86, 2.3 + 0.01 / Math.cos((48.85 * Math.PI) / 180)]];
  const point = pointAlongPolyline(polyline, 0.75);
  assert.ok(Math.abs(point.latitude - 48.86) < 1e-9, "sur le second segment");
  assert.ok(point.longitude > 2.3 && point.longitude < polyline[2]![1]);
  assert.deepEqual(pointAlongPolyline(polyline, 0), { latitude: 48.85, longitude: 2.3 });
});

test("le départ simulé reste dans Paris, entre la cible et le centre", () => {
  const start = demoTripStart({ latitude: 48.85803, longitude: 2.28223 });
  assert.ok(start.longitude > 2.28223 && start.longitude < 2.3522, "vers le centre");
  const central = demoTripStart({ latitude: 48.857, longitude: 2.352 });
  assert.ok(Math.hypot(central.latitude - 48.857, central.longitude - 2.352) > 0.015, "décalé quand la cible est au centre");
});

test("les routes des cartes avancent les positions de démo sans bloquer la lecture", () => {
  for (const file of ["src/app/api/dispatch/map/route.ts", "src/app/api/dispatch/drivers-locations/route.ts", "src/app/api/dispatch/drivers-map/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /advanceDemoDriverPositions\(companyId\)\.catch\(/, file);
  }
});
