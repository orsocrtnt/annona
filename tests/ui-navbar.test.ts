import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("la navigation publique réutilise la coque Apple", () => {
  const shell = read("src/components/navigation/apple-navbar.tsx");
  const publicNav = read("src/features/landing/public-top-navbar.tsx");
  const home = read("src/features/landing/home-landing.tsx");
  const growth = read("src/features/landing/growth-shell.tsx");

  assert.match(shell, /backdrop-blur-2xl/);
  assert.match(shell, /rounded-\[18px\]/);
  assert.match(shell, /focus-visible:ring-2/);
  assert.match(shell, /via-\[#ff6847\]/);
  assert.match(shell, /group-hover:scale-x-100/);
  assert.match(shell, /motion-reduce:transition-none/);
  assert.doesNotMatch(shell, /bg-white\/\[0\.11\] text-white/);
  assert.match(publicNav, /AppleNavbar/);
  assert.match(publicNav, /aria-label="Ouvrir la navigation"/);
  assert.match(home, /PublicTopNavbar/);
  assert.match(growth, /PublicTopNavbar/);
});
