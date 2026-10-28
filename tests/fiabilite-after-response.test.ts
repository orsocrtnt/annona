import assert from "node:assert/strict";
import test from "node:test";
import { runAfterResponse } from "../src/lib/operations/after-response";

test("hors contexte de requête, la tâche s'exécute (repli) et le repli est journalisé", async () => {
  let ran = false;
  const logged: unknown[][] = [];
  runAfterResponse(
    async () => {
      ran = true;
    },
    { log: (...args) => logged.push(args) }
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ran, true);
  assert.ok(logged.some((entry) => entry.join(" ").includes("repli")));
});

test("un repli identifiable est aussi journalisé quand le planificateur le signale", async () => {
  let ran = false;
  const logged: unknown[][] = [];
  runAfterResponse(
    async () => {
      ran = true;
    },
    {
      schedule: () => {
        throw new Error("`after` was called outside a request scope.");
      },
      log: (...args) => logged.push(args),
    }
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ran, true);
  assert.equal(logged.length, 1);
});

test("une autre erreur du planificateur n'est pas masquée : journalisée, tâche non lancée", async () => {
  let ran = false;
  const logged: unknown[][] = [];
  assert.doesNotThrow(() =>
    runAfterResponse(
      async () => {
        ran = true;
      },
      {
        schedule: () => {
          throw new Error("planificateur cassé");
        },
        log: (...args) => logged.push(args),
      }
    )
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ran, false);
  assert.equal(logged.length, 1);
  assert.ok(logged[0]?.join(" ").includes("planificateur cassé"));
});

test("une tâche en échec ne fait jamais lever l'appelant ni ne produit de rejet non géré", async () => {
  const logged: unknown[] = [];
  assert.doesNotThrow(() =>
    runAfterResponse(
      async () => {
        throw new Error("boom");
      },
      { schedule: (task) => void task(), log: (...args) => logged.push(args) }
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
