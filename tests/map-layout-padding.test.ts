import assert from "node:assert/strict";
import test from "node:test";
import { getMapLayoutPadding } from "../src/lib/maps/map-layout-padding";

const mobile = { left: 0, top: 48, right: 390, bottom: 844, width: 390, height: 796 };
test("MAP-1 : panneau mobile réserve de la hauteur et garde les destinations dans la largeur", () => {
  const padding = getMapLayoutPadding(mobile, { left: 16, top: 272, right: 316, bottom: 338, width: 300, height: 66 });
  assert.equal(padding.top, 314);
  assert.equal(padding.left, 39);
  assert.equal(padding.right, 39);
  assert.ok(mobile.width - padding.left - padding.right > 300);
});
test("MAP-1 : panneau desktop réserve sa largeur et panneau masqué ne consomme rien", () => {
  const desktop = { ...mobile, width: 1280, right: 1280 };
  assert.equal(getMapLayoutPadding(desktop, { left: 16, top: 64, right: 376, bottom: 844, width: 360, height: 780 }).left, 400);
  assert.equal(getMapLayoutPadding(mobile, { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }).left, 39);
});
test("MAP-1 : panneau déplié conserve une zone de carte cadrable", () => {
  const padding = getMapLayoutPadding(mobile, { left: 16, top: 272, right: 316, bottom: 800, width: 300, height: 528 });
  assert.ok(padding.top <= mobile.height * 0.55);
  assert.ok(mobile.height - padding.top - padding.bottom > 200);
});
