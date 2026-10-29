import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Ces pages lisent le catalogue en base sans API dynamique : sans revalidation, Next les fige au build
// (prix figés, et repli « voir /tarifs » figé si la base est injoignable pendant le build).
// L'accueil (LANDING-3) n'affiche plus de prix : seul /tarifs lit le catalogue.
for (const page of ["src/app/tarifs/page.tsx"]) {
  test(`${page} : revalidation de 5 minutes`, () => {
    const source = readFileSync(page, "utf8");
    assert.match(source, /export const revalidate = 300;/);
    assert.match(source, /getActiveSignupCatalog/);
  });
}
