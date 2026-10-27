import assert from "node:assert/strict";
import test from "node:test";
import { collectedShare, volumeSummary } from "../src/lib/analytics/summary";

test("le volume se résume par son total, son pic et sa moyenne", () => {
  const s = volumeSummary([{ date: "2026-10-25", count: 2 }, { date: "2026-10-26", count: 0 }, { date: "2026-10-27", count: 4 }]);
  assert.equal(s.total, 6);
  assert.deepEqual(s.peak, { date: "2026-10-27", count: 4 });
  assert.equal(s.average, 2);
  assert.deepEqual(volumeSummary([{ date: "2026-10-27", count: 0 }]), { total: 0, peak: null, average: 0 }, "aucun pic sans livraison");
  assert.deepEqual(volumeSummary([]), { total: 0, peak: null, average: 0 });
});

test("la part encaissée est arrondie et absente sans facture", () => {
  assert.equal(collectedShare(89.9, 45), 67);
  assert.equal(collectedShare(0, 45), 0);
  assert.equal(collectedShare(0, 0), null);
});
