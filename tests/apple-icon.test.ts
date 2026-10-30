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

// iOS demande aussi ces adresses fixes quand il ne retient pas la balise de la page.
test("les adresses de secours d'iOS servent la même icône", () => {
  const icon = readFileSync("src/app/apple-icon.png");
  assert.ok(icon.equals(readFileSync("public/apple-touch-icon.png")));
  assert.ok(icon.equals(readFileSync("public/apple-touch-icon-precomposed.png")));
});

// Sans ce fond, iOS garde le gris de l'application au-dessus de la landing blanche.
test("le fond de page de la landing est celui de la landing, en Clair et en Sombre", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /:root:has\(\.landing\) body \{\s*background-color: #ffffff;/);
  assert.match(css, /:root\[data-theme="dark"\]:has\(\.landing\) body \{\s*background-color: #1c1f1e;/);
});
