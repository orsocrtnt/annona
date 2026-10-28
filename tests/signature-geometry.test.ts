import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_EXPORT_SIDE,
  canvasBackingSize,
  exportSize,
  isSignatureExportable,
  pointerToCanvas,
} from "../src/features/driver/signature-geometry";

test("taille du canevas : nulle tant que le dialogue n'est pas mis en page, arrondie ensuite, ratio plafonné à 2", () => {
  assert.equal(canvasBackingSize({ width: 0, height: 0 }, 2), null);
  assert.equal(canvasBackingSize({ width: 320, height: 0 }, 2), null);
  assert.deepEqual(canvasBackingSize({ width: 320.4, height: 144 }, 2), { width: 641, height: 288 });
  assert.deepEqual(canvasBackingSize({ width: 300, height: 100 }, 3), { width: 600, height: 200 });
  assert.deepEqual(canvasBackingSize({ width: 300, height: 100 }, 0), { width: 300, height: 100 });
});

test("pointeur : coordonnées en pixels de mise en page, indépendantes de l'échelle d'animation du dialogue", () => {
  // Dialogue en cours de zoom à 90 % : le rectangle visuel (288 x 130) est plus petit que la mise en page (320 x 144).
  const rect = { left: 10, top: 20, width: 288, height: 129.6 };
  assert.deepEqual(pointerToCanvas(rect, { width: 320, height: 144 }, 10 + 144, 20 + 64.8), { x: 160, y: 72 });
  assert.deepEqual(pointerToCanvas({ left: 0, top: 0, width: 0, height: 0 }, { width: 320, height: 144 }, 5, 5), { x: 0, y: 0 });
});

test("export : réduit à 800 px de large au plus, jamais sous le minimum accepté par le serveur", () => {
  assert.deepEqual(exportSize({ width: 1282, height: 288 }, 800), { width: 800, height: 180 });
  assert.deepEqual(exportSize({ width: 641, height: 288 }, 800), { width: 641, height: 288 });
  assert.equal(exportSize({ width: 1600, height: 40 }, 800), null, "réduite, la hauteur passerait sous le minimum");
  assert.equal(exportSize({ width: 1, height: 1 }, 800), null);
});

test("signature exportable : tracé assez long ET canevas mesuré (pas de PNG 1 px)", () => {
  assert.equal(isSignatureExportable({ points: 3, width: 641, height: 288 }), false);
  assert.equal(isSignatureExportable({ points: 40, width: 1, height: 1 }), false);
  assert.equal(isSignatureExportable({ points: 40, width: 0, height: 0 }), false);
  assert.equal(isSignatureExportable({ points: 40, width: 641, height: 288 }), true);
  assert.equal(MIN_EXPORT_SIDE, 40);
});
