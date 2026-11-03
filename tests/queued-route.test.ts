import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

test("carte : une demande annulée quitte la file avant tout appel fournisseur", async () => {
  let calls = 0;
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync("src/lib/maps/queued-route.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module,
    exports: module.exports,
    Map,
    Promise,
    setTimeout,
    AbortController,
    require: (id: string) => {
      assert.equal(id, "@/lib/maps/route-client");
      return { fetchRoutePolyline: async () => { calls += 1; return [[48.85, 2.35], [48.86, 2.35]]; } };
    },
  });
  const queued = module.exports as { requestQueuedRoute: (points: Array<{ latitude: number; longitude: number }>, signal?: AbortSignal) => Promise<unknown> };
  const controller = new AbortController();
  controller.abort();
  assert.equal(await queued.requestQueuedRoute([{ latitude: 48.85, longitude: 2.35 }, { latitude: 48.86, longitude: 2.35 }], controller.signal), null);
  assert.equal(calls, 0);
});
