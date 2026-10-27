import assert from "node:assert/strict";
import test from "node:test";
import { PERF02_SCENARIOS, assertLocalPerf02Target, percentile } from "../scripts/perf02/run-local";

test("PERF-02 : les douze profils sont représentés sans ambiguïté", () => {
  assert.equal(PERF02_SCENARIOS.length, 12);
  assert.deepEqual([...new Set(PERF02_SCENARIOS.map((scenario) => scenario.companies))], [1, 10, 50, 100]);
  assert.deepEqual([...new Set(PERF02_SCENARIOS.map((scenario) => scenario.profile))], ["STARTER", "PRO", "BUSINESS"]);
});

test("PERF-02 : la cible doit être locale", () => {
  assert.equal(assertLocalPerf02Target("http://127.0.0.1:3999/perf"), "http://127.0.0.1:3999/perf");
  assert.equal(assertLocalPerf02Target("https://localhost/perf"), "https://localhost/perf");
  assert.throws(() => assertLocalPerf02Target("https://preprod.example.invalid/perf"), /PERF02_REMOTE_TARGET_FORBIDDEN/);
  assert.throws(() => assertLocalPerf02Target("not-a-url"), /PERF02_LOCAL_TARGET_URL_REQUIRED/);
});

test("PERF-02 : le p95 utilise la borne supérieure de l'échantillon", () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([1, 2, 3, 4, 5], 0.95), 5);
});
