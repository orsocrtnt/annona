import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DEMO_POSITION_CYCLE_MS,
  demoDriverPosition,
  demoStartPoint,
  isDemoCompanyForSimulation,
} from "../src/lib/demo/demo-live-position";

test("la simulation ne vise que les entreprises de démo", () => {
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "logiexpress-demo" }), true);
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "logiexpress-demo-pool-3" }), true);
  assert.equal(isDemoCompanyForSimulation({ isDemo: false, slug: "logiexpress-demo-pool-3" }), false, "drapeau démo absent");
  assert.equal(isDemoCompanyForSimulation({ isDemo: true, slug: "transports-martin" }), false, "slug hors démo");
  assert.equal(isDemoCompanyForSimulation(null), false);
});

test("le livreur simulé avance vers l'adresse sans jamais l'atteindre, puis repart", () => {
  const start = { latitude: 48.9, longitude: 2.2 };
  const destination = { latitude: 48.8, longitude: 2.4 };
  const startedAt = new Date("2026-10-26T10:00:00Z");
  const at = (fraction: number) => demoDriverPosition(start, destination, startedAt, new Date(startedAt.getTime() + fraction * DEMO_POSITION_CYCLE_MS));
  const distance = (p: { latitude: number; longitude: number }) => Math.hypot(p.latitude - destination.latitude, p.longitude - destination.longitude);

  assert.ok(distance(at(0.25)) < distance(at(0)), "se rapproche");
  assert.ok(distance(at(0.5)) < distance(at(0.25)), "au plus près à mi-cycle");
  assert.ok(distance(at(0.5)) > 0, "n'arrive jamais : la mission ne paraît pas terminée");
  assert.ok(distance(at(0.75)) > distance(at(0.5)), "repart");
  assert.deepEqual(at(1), at(0), "cycle stable");
});

test("sans collecte connue, le départ est décalé d'environ 2,5 km", () => {
  const start = demoStartPoint({ latitude: 48.85, longitude: 2.35 }, null);
  assert.ok(Math.abs(start.latitude - 48.868) < 1e-9 && Math.abs(start.longitude - 2.328) < 1e-9);
});

test("les routes des cartes avancent les positions de démo sans bloquer la lecture", () => {
  for (const file of ["src/app/api/dispatch/map/route.ts", "src/app/api/dispatch/drivers-locations/route.ts", "src/app/api/dispatch/drivers-map/route.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /advanceDemoDriverPositions\(companyId\)\.catch\(/, file);
  }
});
