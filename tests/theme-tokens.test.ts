import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEME_SCOPED_PATH_PREFIXES,
  applyThemeToRoot,
  isThemePreference,
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
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const reduced = between("@media (prefers-reduced-transparency: reduce) {", "\n}\n");
  // Les sélecteurs visés doivent exister dans le code : barre et barre d'action (data-glass), cartes (--map-glass-*).
  assert.match(reduced, /:root\[data-theme\] \[data-glass\] \{[^}]*backdrop-filter: none/);
  assert.match(reduced, /--map-glass-blur: none/);
  assert.match(read("src/components/navigation/apple-navbar.tsx"), /data-glass\s+className=\{cn\(\s+light/);
  assert.match(read("src/features/client-portal/create-order-form.tsx"), /data-glass className="sticky/);
  assert.match(read("src/components/maps/map-glass-styles.ts"), /backdropFilter: "var\(--map-glass-blur, blur\(8px\)\)"/);
  assert.doesNotMatch(reduced, /\.glass\b/);
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
  // Le compte connecté (avatar, nom) masqué dans la barre est repris dans le menu mobile.
  assert.match(layout, /max-sm:hidden[\s\S]*<Avatar/);
  assert.match(layout, /className="sm:hidden" data-testid="portal-mobile-account">[\s\S]*<Avatar[\s\S]*user\.firstName/);
});

test("Sora (titres DESIGN.md) est chargée par le seul portail ; le layout racine garde Inter", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert.match(read("src/app/(client-portal)/portal-font.ts"), /Sora\(/);
  const portalLayout = read("src/app/(client-portal)/layout.tsx");
  // Variable et attribut portés sur <html> : les fenêtres Radix rendues dans <body> héritent de Sora.
  assert.match(portalLayout, /documentElement[\s\S]*classList\.add\(sora\.variable\)[\s\S]*setAttribute\("data-portal"/);
  assert.match(portalLayout, /classList\.remove\(sora\.variable\)[\s\S]*removeAttribute\("data-portal"\)/);
  assert.match(css, /html\[data-portal\] :is\(h1, h2, h3, \[data-slot="dropdown-menu-label"\]\) \{\s*font-family: var\(--font-sora\)/);
  assert.match(read("src/components/ui/dropdown-menu.tsx"), /data-slot="dropdown-menu-label"/);
  assert.doesNotMatch(read("src/app/layout.tsx"), /Sora/);
});

test("verre des cartes : valeurs historiques en repli hors portail, surfaces sombres en Dark", async () => {
  const { mapGlassCardStyle, mapGlassButtonStyle } = await import("../src/components/maps/map-glass-styles");
  // Hors portail, aucune variable --map-glass-* n'existe : le repli doit être la valeur de preproduction.
  assert.equal(mapGlassCardStyle.background, "var(--map-glass-bg, rgba(255, 255, 255, 0.97))");
  assert.equal(mapGlassCardStyle.backdropFilter, "var(--map-glass-blur, blur(8px))");
  assert.equal(mapGlassCardStyle.border, "1px solid var(--map-glass-border, rgba(10, 10, 10, 0.10))");
  assert.equal(mapGlassCardStyle.boxShadow, "var(--map-glass-shadow, 0 8px 28px rgba(0, 0, 0, 0.10))");
  assert.equal(mapGlassButtonStyle.background, "var(--map-glass-button-bg, #ffffff)");
  assert.equal(mapGlassButtonStyle.color, "var(--map-glass-button-fg, #111111)");
  const darkBlock = between(':root[data-theme="dark"] {', "}");
  for (const name of ["--map-glass-bg", "--map-glass-border", "--map-glass-shadow", "--map-glass-button-bg", "--map-glass-button-fg"]) {
    assert.match(darkBlock, new RegExp(`${name}:`), `${name} absent du Dark`);
  }
  // Le texte atténué du Dark (#a3aca6) doit rester lisible sur la surface de verre sombre (#1c1f1e).
  assert.ok(ratio(dark.get("--color-muted-foreground")!, "#1c1f1e") >= 4.5);
  assert.match(darkBlock, /--map-glass-bg: rgb\(28 31 30 \/ 0\.94\)/);
});

test("cartes partagées : un fond blanc codé en dur avec un texte en jeton porte sa variante dark:", () => {
  const files = [
    "src/components/maps/provider-tile-layer.tsx",
    "src/components/maps/deliveries-live-map.tsx",
    "src/components/maps/delivery-map-status-bar.tsx",
    "src/components/maps/leaflet-base-map.tsx",
  ];
  for (const file of files) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    for (const [, classes] of src.matchAll(/"([^"]*\bbg-(?:white|\[#f0f0f0\])[^"]*)"/g)) {
      // Texte de couleur fixe (attribution OSM en zinc) : lisible dans les deux thèmes, pas de variante requise.
      if (/\btext-(?:zinc|black|white)\b|\btext-zinc-/.test(classes!)) continue;
      assert.match(classes!, /\bdark:bg-/, `${file} : « ${classes} » sans variante dark:`);
    }
  }
});

test("les entrées de menu simples et radio partagent une seule constante de classes", () => {
  const src = readFileSync(new URL("../src/components/ui/dropdown-menu.tsx", import.meta.url), "utf8");
  assert.equal(src.match(/focus:bg-accent focus:text-accent-foreground/g)?.length, 1);
  assert.equal(src.match(/\bdropdownMenuItemClass,/g)?.length, 2);
});

test("le script d'initialisation et ThemeSync (applyThemeToRoot) décident pareil sur les mêmes cas", () => {
  // Le script embarque le source de resolveRootTheme : aucune recopie manuelle de la règle.
  assert.ok(THEME_INIT_SCRIPT.includes("resolveRootTheme"));
  assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_SCOPED_PATH_PREFIXES)));
  const paths = ["/portal", "/portal/orders/new", "/portalx", "/portal-old", "/dashboard", "/", "/driver/missions"];
  const stored = [null, "light", "dark", "system", "nimporte"];
  for (const pathname of paths) {
    for (const value of [...stored, "throws"]) {
      for (const prefersDark of [true, false]) {
        const attrs = new Map<string, string>();
        const documentElement = { setAttribute: (k: string, v: string) => void attrs.set(k, v) };
        vm.runInNewContext(THEME_INIT_SCRIPT, {
          location: { pathname },
          localStorage: {
            getItem: () => {
              if (value === "throws") throw new Error("stockage bloqué");
              return value;
            },
          },
          window: { matchMedia: (q: string) => ({ matches: q === "(prefers-color-scheme: dark)" && prefersDark }) },
          document: { documentElement },
        });
        const synced = new Map<string, string>();
        const pref = isThemePreference(value) ? value : "system"; // même repli que readThemePreference
        applyThemeToRoot(
          { setAttribute: (k, v) => void synced.set(k, v), removeAttribute: (k) => void synced.delete(k) },
          pathname,
          pref,
          prefersDark
        );
        assert.equal(attrs.get("data-theme"), synced.get("data-theme"), `${pathname} ${value} ${prefersDark}`);
      }
    }
  }
});
