import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TONE_CLASSES, resolveTone } from "../src/components/ui/tone";

test("une alerte critique à zéro reste neutre, les autres teintes sont conservées", () => {
  assert.equal(resolveTone("critical", 0), "neutral");
  assert.equal(resolveTone("critical", 2), "critical");
  assert.equal(resolveTone("warning", 0), "warning");
  assert.equal(resolveTone(undefined, 5), "neutral");
});

test("les teintes d'urgence sont de légers dégradés vers le blanc", () => {
  for (const tone of ["critical", "warning", "info", "success"] as const) {
    assert.match(TONE_CLASSES[tone].surface, /linear-gradient\(160deg,#[0-9a-f]{6}_0%,#ffffff_62%\)/);
  }
});

test("le pilotage du dashboard porte une teinte par urgence et le donut du jour", () => {
  const widgets = readFileSync(new URL("../src/features/back-office/dashboard-widget-renderer.tsx", import.meta.url), "utf8");
  for (const tone of ["critical", "warning", "info", "success"]) {
    assert.match(widgets, new RegExp(`tone="${tone}"`));
  }
  assert.match(widgets, /<TodayDonut/);
});
