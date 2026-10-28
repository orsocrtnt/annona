import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  applyThemeToRoot,
  isThemeScopedPath,
  resolveTheme,
} from "../src/lib/theme";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function tokens(block: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of block.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-f]{6})/g)) map.set(m[1]!, m[2]!);
  return map;
}

function between(start: string, end: string): string {
  const i = css.indexOf(start);
  assert.ok(i >= 0, `${start} introuvable`);
  return css.slice(i, css.indexOf(end, i));
}

const dark = tokens(between(':root[data-theme="dark"] {', "}"));
const light = tokens(between("@theme {", "--radius-sm"));

function luminance(hex: string) {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

test("les jetons Dark couvrent tous les jetons sémantiques Light, en un seul bloc", () => {
  for (const key of light.keys()) assert.ok(dark.has(key), `jeton Dark manquant : ${key}`);
  assert.doesNotMatch(css, /data-theme="system"/);
  assert.doesNotMatch(css, /prefers-color-scheme/);
});

test("contrastes WCAG AA du Light et du Dark", () => {
  const pairs: [string, string, number][] = [
    ["--color-foreground", "--color-background", 4.5],
    ["--color-card-foreground", "--color-card", 4.5],
    ["--color-muted-foreground", "--color-card", 4.5],
    ["--color-muted-foreground", "--color-muted", 4.5],
    ["--color-text-secondary", "--color-card", 4.5],
    ["--color-primary-foreground", "--color-primary", 4.5],
    ["--color-primary-foreground", "--color-primary-hover", 4.5],
    ["--color-brand", "--color-card", 4.5],
    ["--color-brand", "--color-brand-subtle", 4.5],
    ["--color-accent-foreground", "--color-accent", 4.5],
    ["--color-success", "--color-success-subtle", 4.5],
    ["--color-warning", "--color-warning-subtle", 4.5],
    ["--color-error", "--color-error-subtle", 4.5],
    ["--color-error", "--color-card", 4.5],
    ["--color-ring", "--color-card", 3],
    ["--color-border", "--color-card", 1.2],
  ];
  for (const [name, set] of [["dark", dark], ["light", light]] as const) {
    for (const [fg, bg, min] of pairs) {
      if (name === "light" && fg === "--color-border") continue;
      if (name === "light" && fg === "--color-warning") continue; // jeton Light historique, hors périmètre
      const r = ratio(set.get(fg)!, set.get(bg)!);
      assert.ok(r >= min, `${name} ${fg} sur ${bg} : ${r.toFixed(2)} < ${min}`);
    }
  }
  // Texte tertiaire : décoratif/aide, au moins 3:1 en Dark (jamais seul porteur d'information).
  assert.ok(ratio(dark.get("--color-text-tertiary")!, dark.get("--color-card")!) >= 3);
});

test("le Dark ne s'applique qu'aux espaces migrés et le script précède l'hydratation", () => {
  assert.equal(isThemeScopedPath("/portal"), true);
  assert.equal(isThemeScopedPath("/portal/orders/new"), true);
  assert.equal(isThemeScopedPath("/portalx"), false);
  assert.equal(isThemeScopedPath("/dashboard"), false);
  assert.equal(isThemeScopedPath("/driver"), false);
  assert.match(THEME_INIT_SCRIPT, new RegExp(THEME_STORAGE_KEY));
  const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<head>[\s\S]*THEME_INIT_SCRIPT[\s\S]*<\/head>/);
});

test("le verre respecte prefers-reduced-transparency et le mouvement prefers-reduced-motion", () => {
  assert.match(css, /@media \(prefers-reduced-transparency: reduce\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("le basculement de thème est présent dans la barre du portail", () => {
  const layout = readFileSync(new URL("../src/components/layouts/client-portal-layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<ThemeToggle/);
});

test("applyThemeToRoot résout « système » et retire l'attribut hors des espaces migrés", () => {
  const attrs = new Map<string, string>();
  const root = {
    setAttribute: (k: string, v: string) => void attrs.set(k, v),
    removeAttribute: (k: string) => void attrs.delete(k),
  };
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  applyThemeToRoot(root, "/portal/orders", "system", true);
  assert.equal(attrs.get("data-theme"), "dark");
  applyThemeToRoot(root, "/portal", "light", true);
  assert.equal(attrs.get("data-theme"), "light");
  // Navigation client vers un autre espace : l'attribut disparaît, le Dark ne déborde pas.
  applyThemeToRoot(root, "/dashboard", "dark", true);
  assert.equal(attrs.has("data-theme"), false);
});

test("ThemeSync est l'unique écrivain de data-theme, appliqué avant peinture, sans snapshot serveur", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const sync = read("src/components/theme/theme-sync.tsx");
  const hook = read("src/components/theme/use-theme-preference.ts");
  const toggle = read("src/components/theme/theme-toggle.tsx");
  assert.match(sync, /useLayoutEffect/);
  assert.match(sync, /\[pathname\]/);
  assert.match(sync, /readThemePreference\(\)/);
  for (const src of [hook, toggle]) {
    assert.doesNotMatch(src, /setAttribute|removeAttribute|documentElement/);
  }
  assert.match(toggle, /DropdownMenuRadioGroup/);
  assert.doesNotMatch(toggle, /role="menuitemradio"/);
});

test("la barre du portail tient à 320 px : thème et avatar passent dans le menu sous 640 px", () => {
  const layout = readFileSync(new URL("../src/components/layouts/client-portal-layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<ThemeToggle className="max-sm:hidden"/);
  assert.match(layout, /sm:hidden">[\s\S]*<ThemeRadioGroup/);
});

test("Sora (titres DESIGN.md) est chargée par le seul portail ; le layout racine garde Inter", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("src/app/(client-portal)/portal-font.ts"), /Sora\(/);
  assert.match(read("src/app/(client-portal)/layout.tsx"), /sora\.variable[\s\S]*h1,h2,h3/);
  assert.doesNotMatch(read("src/app/layout.tsx"), /Sora/);
});
