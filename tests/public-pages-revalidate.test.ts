import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Une page qui lit le catalogue en base sans API dynamique est figée au build par Next sans revalidation
// (prix figés, et repli figé si la base est injoignable pendant le build).
// Depuis le 5 novembre 2026, /tarifs est une liste d'attente provisoire : aucune page publique ne lit le
// catalogue. La règle vaut pour la prochaine qui le lira.
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return pages(path);
    return entry.name === "page.tsx" ? [path] : [];
  });
}

test("toute page qui lit le catalogue se revalide toutes les 5 minutes", () => {
  for (const page of pages("src/app")) {
    const source = readFileSync(page, "utf8");
    if (!source.includes("getActiveSignupCatalog")) continue;
    assert.match(source, /export const revalidate = 300;/, page);
  }
  assert.doesNotMatch(readFileSync("src/app/tarifs/page.tsx", "utf8"), /getActiveSignupCatalog/);
});
