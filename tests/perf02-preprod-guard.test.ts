import assert from "node:assert/strict";
import test from "node:test";
import { PERF02_DEMO_LOGIN, PERF02_CONNECTED_ROUTES } from "../scripts/perf02/next-connected";
import { runPreprodConnectedMeasure } from "../scripts/perf02/preprod-connected";
import { assertPreprodPerf02Target, PERF02_PREPROD_REQUESTS_PER_LEVEL, PERF02_PREPROD_ROUTES } from "../scripts/perf02/preprod-public";

test("PERF-02 préproduction : seules les deux origines HTTPS de préproduction sont acceptées", () => {
  assert.equal(assertPreprodPerf02Target("https://annona.fr/"), "https://annona.fr");
  assert.equal(assertPreprodPerf02Target("https://annona-git-preproduction-annona.vercel.app"), "https://annona-git-preproduction-annona.vercel.app");
  for (const refused of [
    "http://annona.fr/",
    "https://annona.vercel.app/",
    "https://annona.com/",
    "https://annona.fr.evil.test/",
    "https://annona.fr/api",
    "https://annona.fr/?x=1",
    "http://127.0.0.1:3000/",
  ]) {
    assert.throws(() => assertPreprodPerf02Target(refused), /PERF02_PREPROD_TARGET_REFUSED/, refused);
  }
  assert.throws(() => assertPreprodPerf02Target("pas une url"), /PERF02_PREPROD_TARGET_INVALID/);
});

test("PERF-02 préproduction : lecture seule, sans route connectée ni écriture, plafond conservateur", () => {
  assert.ok(PERF02_PREPROD_REQUESTS_PER_LEVEL <= 24);
  assert.ok(!PERF02_PREPROD_ROUTES.some((route) => route.path.startsWith("/api/") && !["/api/signup", "/api/auth/session"].includes(route.path)));
});

test("PERF-02 préproduction connectée : refuse toute autre cible, session démo de test uniquement", async () => {
  await assert.rejects(runPreprodConnectedMeasure("https://annona.vercel.app/"), /PERF02_PREPROD_TARGET_REFUSED/);
  await assert.rejects(runPreprodConnectedMeasure("http://127.0.0.1:3000/"), /PERF02_PREPROD_TARGET_REFUSED/);
  assert.equal(PERF02_DEMO_LOGIN.demoTestSession, true);
  assert.ok(PERF02_CONNECTED_ROUTES.length <= 9);
});
