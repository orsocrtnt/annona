import assert from "node:assert/strict";
import test from "node:test";
import { runAfterResponse } from "../src/lib/operations/after-response";

test("hors contexte de requête, la tâche s'exécute quand même (repli)", async () => {
  let ran = false;
  runAfterResponse(async () => {
    ran = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ran, true);
});

test("une tâche en échec ne fait jamais lever l'appelant ni ne produit de rejet non géré", async () => {
  const logged: unknown[] = [];
  assert.doesNotThrow(() =>
    runAfterResponse(
      async () => {
        throw new Error("boom");
      },
      { log: (...args) => logged.push(args) }
    )
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logged.length, 1);
});

test("dans un contexte de requête, la tâche est confiée à after() et non lancée tout de suite", async () => {
  const scheduled: Array<() => Promise<unknown>> = [];
  let ran = false;
  runAfterResponse(
    async () => {
      ran = true;
    },
    { schedule: (task) => scheduled.push(task) }
  );
  assert.equal(scheduled.length, 1);
  assert.equal(ran, false);
  await scheduled[0]?.();
  assert.equal(ran, true);
});
