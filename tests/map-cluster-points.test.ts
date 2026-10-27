import assert from "node:assert/strict";
import test from "node:test";
import { clusterProjectedPoints } from "../src/lib/maps/cluster-points";

test("les livraisons proches à l'écran se regroupent, les lointaines restent seules", () => {
  const clusters = clusterProjectedPoints(
    [
      { item: "paris-1", x: 10, y: 10 },
      { item: "paris-2", x: 40, y: 30 },
      { item: "lyon", x: 300, y: 500 },
    ],
    64
  );
  assert.equal(clusters.length, 2);
  const paris = clusters.find((cluster) => cluster.items.length === 2)!;
  assert.deepEqual(paris.items.sort(), ["paris-1", "paris-2"]);
  assert.equal(paris.x, 25, "centre du groupe");
});

test("un rayon d'un pixel ne regroupe que les points superposés (vue rapprochée)", () => {
  const clusters = clusterProjectedPoints([{ item: "a", x: 10.2, y: 10 }, { item: "b", x: 12, y: 10 }], 1);
  assert.equal(clusters.length, 2);
});
