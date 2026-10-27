import assert from "node:assert/strict";
import test from "node:test";
import { workloadBar, workloadMax, workloadSentence } from "../src/lib/dispatch/workload-bars";

test("la barre du livreur le plus chargé occupe toute la largeur", () => {
  const splits = [{ standard: 2, courier: 2 }, { standard: 1, courier: 0 }, { standard: 0, courier: 0 }];
  const max = workloadMax(splits);
  assert.equal(max, 4);
  assert.deepEqual(workloadBar(splits[0]!, max), { total: 4, standardPct: 50, courierPct: 50 });
  assert.deepEqual(workloadBar(splits[1]!, max), { total: 1, standardPct: 25, courierPct: 0 });
  assert.deepEqual(workloadBar(splits[2]!, max), { total: 0, standardPct: 0, courierPct: 0 });
  assert.deepEqual(workloadBar({ standard: 0, courier: 0 }, 0), { total: 0, standardPct: 0, courierPct: 0 }, "équipe sans charge");
});

test("la charge se dit aussi en mots", () => {
  assert.equal(workloadSentence({ standard: 2, courier: 1 }), "2 commandes et 1 course");
  assert.equal(workloadSentence({ standard: 1, courier: 0 }), "1 commande");
  assert.equal(workloadSentence({ standard: 0, courier: 3 }), "3 courses");
  assert.equal(workloadSentence({ standard: 0, courier: 0 }), "aucune livraison");
});
