import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// DESIGN-1, finitions du 29 octobre 2026 (audit axe, zoom 200 %, transparence réduite).
const read = (file: string) => readFileSync(file, "utf8");

test("DESIGN-1 : transparence réduite, aucun flou d'arrière-plan dans tous les espaces", () => {
  const css = read("src/app/globals.css");
  const block = css.slice(css.indexOf("@media (prefers-reduced-transparency: reduce)"));
  assert.match(block, /:root\[data-theme\] \[class\*="backdrop-blur"\] \{\s*-webkit-backdrop-filter: none;\s*backdrop-filter: none;/);
});
