import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { signupEntryFromSearch } from "../src/domains/growth/signup-entry";
import { PUBLIC_CAPABILITIES } from "../src/domains/growth/public-capabilities";

const root = new URL("../", import.meta.url);

function read(path: string) {
  return readFileSync(fileURLToPath(new URL(path, root)), "utf8");
}

function routes() {
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = `${dir}/${name}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") {
        const rel = full.slice(full.indexOf("/src/app/") + "/src/app/".length).replace(/(^|\/)page\.tsx$/, "");
        const parts = rel.split("/").filter((part) => part && !part.startsWith("("));
        found.add(`/${parts.join("/")}`);
      }
    }
  };
  walk(fileURLToPath(new URL("src/app", root)));
  return found;
}

function localLinks(source: string) {
  return [...source.matchAll(/href="(\/[^"#?]*)/g)].flatMap((match) => match[1] ? [match[1]] : []);
}

test("les parcours publics locaux se rejoignent sans route absente", () => {
  const known = routes();
  const home = read("src/features/landing/home-landing.tsx");
  const publicNav = read("src/features/landing/public-top-navbar.tsx");
  const features = read("src/app/fonctionnalites/page.tsx");
  const tarifs = read("src/app/tarifs/page.tsx");
  const demonstration = read("src/app/demonstration/page.tsx");
  const expected = ["/fonctionnalites", "/contact", "/register", "/login"];
  for (const path of expected) assert.equal(known.has(path), true, path);
  for (const source of [home, publicNav, features, tarifs, demonstration]) {
    for (const href of localLinks(source)) assert.equal(known.has(href), true, href);
  }
  assert.match(home, /PublicTopNavbar/);
  assert.equal(publicNav.includes('href: "/fonctionnalites"'), true);
  // Démonstration retirée pour le moment (5 novembre 2026) : aucun lien public, redirection temporaire si l'adresse est tapée.
  for (const source of [home, publicNav, features]) assert.doesNotMatch(source, /href(: |=)"\/demonstration"/);
  const nextConfig = read("next.config.ts");
  assert.match(nextConfig, /source: "\/demonstration", destination: "\/#demo", permanent: false/);
  assert.doesNotMatch(nextConfig, /source: "\/tarifs"/);

  // Tarifs provisoire : liste d'attente, aucun prix, aucune inscription payante.
  assert.equal(publicNav.includes('href: "/tarifs"'), true);
  assert.match(home, /href="\/tarifs"/);
  assert.match(tarifs, /<WaitlistForm \/>/);
  assert.match(tarifs, /Annona arrive bientôt/);
  assert.doesNotMatch(tarifs, /\/register\?plan=|€|getActiveSignupCatalog/);
  assert.doesNotMatch(read("src/domains/growth/public-pricing.ts"), /7900|17900|34900/);
  assert.deepEqual(signupEntryFromSearch("?plan=PRO&interval=ANNUAL"), { planCode: "PRO", billingInterval: "ANNUAL" });

  const demo = read("src/domains/growth/public-demo.ts");
  assert.match(demo, /findFirst/);
  assert.doesNotMatch(demo, /leaseDemoPoolEnvironment|ensureDemoSession|provisionDemo|create\(/);

  for (const section of PUBLIC_CAPABILITIES) {
    for (const claim of section.claims) assert.equal(statSync(fileURLToPath(new URL(claim.proof, root))).isFile(), true);
  }

  const acceptance = read("docs/operations/growth01/ACCEPTANCE.md");
  assert.match(acceptance, /clavier/i);
  assert.match(acceptance, /390/);
  assert.match(acceptance, /contact/);
  assert.match(acceptance, /légales/);
  assert.match(acceptance, /domaine/);
  assert.match(acceptance, /GROWTH-1 reste ouvert/);
  assert.match(read("TODO.md"), /^- \[ \] \*\*GROWTH-1/m);
});
