import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PUBLIC_CAPABILITIES } from "../src/domains/growth/public-capabilities";

const root = new URL("../", import.meta.url);
const forbidden = /GPS permanent|import automatique|comptabilité|conformité|témoignage|gain client|missions spécialisées/i;

test("chaque phrase publique est couverte par un écran déjà livré", () => {
  const page = readFileSync(new URL("../src/app/fonctionnalites/page.tsx", import.meta.url), "utf8");
  const publicNav = readFileSync(new URL("../src/features/landing/public-top-navbar.tsx", import.meta.url), "utf8");
  assert.match(page, /PUBLIC_CAPABILITIES/);
  // Tarifs et démonstration en ligne retirés du site public le 5 novembre 2026 : plus aucun lien.
  assert.doesNotMatch(page, /href="\/(tarifs|demonstration)"/);
  assert.doesNotMatch(publicNav, /\/demonstration"/);
  assert.match(page, /href="\/contact"/);
  assert.match(page, /href="\/login"/);
  assert.match(publicNav, /href: "\/fonctionnalites"/);
  assert.doesNotMatch(page, forbidden);
  assert.equal(PUBLIC_CAPABILITIES.map((section) => section.id).join(","), "client,dispatch,driver");
  for (const section of PUBLIC_CAPABILITIES) {
    for (const claim of section.claims) {
      assert.doesNotMatch(claim.text, forbidden);
      const source = readFileSync(new URL(claim.proof, root), "utf8");
      for (const needle of claim.needles) assert.equal(source.includes(needle), true, `${claim.proof} :: ${needle}`);
    }
  }
});
