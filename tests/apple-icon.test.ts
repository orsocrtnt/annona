import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// « Sur l'écran d'accueil » de l'iPhone : iOS veut un carré opaque, sinon il remplit lui-même les zones transparentes.
test("l'icône d'écran d'accueil iPhone est un PNG carré de 180 px sans transparence", () => {
  const png = readFileSync("src/app/apple-icon.png");
  assert.equal(png.toString("latin1", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), 180);
  assert.equal(png.readUInt32BE(20), 180);
  const RGB_WITHOUT_ALPHA = 2;
  assert.equal(png[25], RGB_WITHOUT_ALPHA);
});
