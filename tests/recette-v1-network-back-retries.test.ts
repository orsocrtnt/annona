// RECETTE-V1 N2 — envois rapprochés de la file livreur au retour du réseau : les minuteries parties sont retirées,
// un nouveau retour du réseau remplace les envois en attente, le démontage les annule.
import assert from "node:assert/strict";
import test from "node:test";
import { createNetworkBackRetries } from "@/features/driver/round/network-back-retries";

const DELAYS = [1_500, 4_000, 8_000] as const;

test("RECETTE-V1 N2 : un envoi par délai, chaque minuterie partie est retirée de la liste", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let runs = 0;
  const retries = createNetworkBackRetries(() => runs++, DELAYS);
  retries.schedule();
  assert.equal(retries.pending(), 3);
  t.mock.timers.tick(1_500);
  assert.equal(runs, 1);
  assert.equal(retries.pending(), 2);
  t.mock.timers.tick(6_500);
  assert.equal(runs, 3);
  assert.equal(retries.pending(), 0);
});

test("RECETTE-V1 N2 : un réseau qui va et vient n'empile pas les envois", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let runs = 0;
  const retries = createNetworkBackRetries(() => runs++, DELAYS);
  retries.schedule();
  t.mock.timers.tick(1_000);
  retries.schedule();
  retries.schedule();
  assert.equal(retries.pending(), 3);
  t.mock.timers.tick(10_000);
  assert.equal(runs, 3);
  assert.equal(retries.pending(), 0);
});

test("RECETTE-V1 N2 : le démontage annule les envois en attente", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let runs = 0;
  const retries = createNetworkBackRetries(() => runs++, DELAYS);
  retries.schedule();
  t.mock.timers.tick(1_500);
  retries.cancel();
  assert.equal(retries.pending(), 0);
  t.mock.timers.tick(10_000);
  assert.equal(runs, 1);
});
