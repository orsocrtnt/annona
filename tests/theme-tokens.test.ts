import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

import {
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  THEME_SCOPED_PATH_PREFIXES,
  THEME_EXCLUDED_PATH_PREFIXES,
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
    ["--color-ring", "--color-background", 3],
    ["--color-border", "--color-card", 1.2],
    // Statuts en texte sur la carte et sur le fond de page.
    ["--color-success", "--color-card", 4.5],
    ["--color-warning", "--color-card", 4.5],
    ["--color-success", "--color-background", 4.5],
    ["--color-warning", "--color-background", 4.5],
    ["--color-error", "--color-background", 4.5],
    ["--color-muted-foreground", "--color-background", 4.5],
  ];
  for (const [name, set] of [["dark", dark], ["light", light]] as const) {
    for (const [fg, bg, min] of pairs) {
      if (name === "light" && fg === "--color-border") continue;
            const r = ratio(set.get(fg)!, set.get(bg)!);
      assert.ok(r >= min, `${name} ${fg} sur ${bg} : ${r.toFixed(2)} < ${min}`);
    }
  }
  // Texte tertiaire : décoratif/aide, au moins 3:1 en Dark (jamais seul porteur d'information).
  assert.ok(ratio(dark.get("--color-text-tertiary")!, dark.get("--color-card")!) >= 3);
});

test("DESIGN-2 : bordures de champ, diagrammes et aplats d'état restent AA en Sombre", () => {
  // Champ de saisie : la bordure délimite la cible (WCAG 1.4.11, 3:1) sur la carte et sur le fond.
  for (const bg of ["--color-card", "--color-background", "--color-popover", "--color-muted"]) {
    const r = ratio(dark.get("--color-input")!, dark.get(bg)!);
    assert.ok(r >= 3, `input sur ${bg} : ${r.toFixed(2)}`);
  }
  // Diagrammes : barres encre (gris clair en Dark) et teinte intermédiaire lisibles sur la carte (3:1).
  for (const token of ["--color-chart-ink", "--color-chart-mid"]) {
    const r = ratio(dark.get(token)!, dark.get("--color-card")!);
    assert.ok(r >= 3, `${token} : ${r.toFixed(2)}`);
  }
  // Light (DA-1) : diagrammes en encre Annona, gris de la plaquette, piste Brume.
  assert.equal(light.get("--color-chart-ink"), "#0d0d12");
  assert.equal(light.get("--color-chart-mid"), "#6b6b76");
  assert.equal(light.get("--color-chart-soft"), "#d4d4da");
  assert.equal(light.get("--color-chart-todo"), "#c8c8cf");
  assert.equal(light.get("--color-chart-track"), "#f2f2f4");
  // Aplats d'état (KPI, alertes) : texte, texte atténué et statut lisibles sur chaque aplat.
  const tone = readFileSync(new URL("../src/components/ui/tone.ts", import.meta.url), "utf8");
  assert.doesNotMatch(tone, /gradient/);
  const flats = [...tone.matchAll(/surface: "[^"]*dark:bg-\[(#[0-9a-f]{6})\]/g)].map((m) => m[1]!);
  assert.equal(flats.length, 4);
  for (const surface of flats) {
    for (const fg of ["--color-foreground", "--color-muted-foreground", "--color-error", "--color-warning", "--color-success"]) {
      const r = ratio(dark.get(fg)!, surface);
      assert.ok(r >= 4.5, `${fg} sur ${surface} : ${r.toFixed(2)}`);
    }
  }
  const lightFlats = [...tone.matchAll(/surface: "[^"]*?\sbg-\[(#[0-9a-f]{6})\]/g)].map((m) => m[1]!);
  assert.equal(lightFlats.length, 4);
  for (const surface of lightFlats) {
    for (const fg of ["--color-foreground", "--color-muted-foreground"]) {
      assert.ok(ratio(light.get(fg)!, surface) >= 4.5, `${fg} sur ${surface}`);
    }
    assert.ok(ratio("#b42318", surface) >= 4.5, `valeur critique sur ${surface}`);
  }
});

test("le Dark ne s'applique qu'aux espaces migrés et le script précède l'hydratation", () => {
  assert.equal(isThemeScopedPath("/portal"), true);
  assert.equal(isThemeScopedPath("/portal/orders/new"), true);
  assert.equal(isThemeScopedPath("/portalx"), false);
  // DESIGN-2 : back-office et dispatch, /admin, app livreur.
  for (const path of ["/dashboard", "/dashboard/rounds", "/bakery", "/settings/billing", "/support", "/users", "/companies", "/admin", "/admin/users", "/driver", "/driver/profile"]) {
    assert.equal(isThemeScopedPath(path), true, path);
  }
  // RETOURS-2 (recette du 22 novembre) : espaces du lot 2, pâtissier et tablette Vente.
  for (const path of ["/pastry", "/pastry/stock", "/shop", "/shop/cakes"]) {
    assert.equal(isThemeScopedPath(path), true, path);
  }
  assert.equal(isThemeScopedPath("/shopx"), false);
  // Site public et connexion (LANDING-2, DESIGN-2) : même choix de thème.
  for (const path of ["/", "/mentions-legales", "/confidentialite", "/login", "/login/client", "/forgot-password", "/reset-password"]) {
    assert.equal(isThemeScopedPath(path), true, path);
  }
  // Préfixes voisins : hors Dark.
  for (const path of ["/loginx", "/dashboardx", "/administration", "/bakeryx"]) {
    assert.equal(isThemeScopedPath(path), false, path);
  }
  // Écrans de carte : en Dark depuis le lot B (plus aucune exclusion).
  for (const path of ["/driver/navigate", "/driver/navigate/abc"]) {
    assert.equal(isThemeScopedPath(path), true, path);
  }
  assert.deepEqual([...THEME_EXCLUDED_PATH_PREFIXES], []);
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
  assert.match(read("src/components/maps/map-glass-styles.ts"), /backdropFilter: "var\(--map-glass-blur, blur\(8px\)\)"/);
  assert.doesNotMatch(reduced, /\.glass\b/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("chaque espace propose la bascule en un clic et le choix Clair / Sombre / Système", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const layout of ["src/components/layouts/client-portal-layout.tsx", "src/components/layouts/header.tsx", "src/components/layouts/driver-app-layout.tsx"]) {
    assert.match(read(layout), /<ThemeToggle/, layout);
  }
  // Choix complet : menu du compte du back-office (/admin compris), Profil du portail et du livreur.
  assert.match(read("src/components/layouts/header.tsx"), /<ThemeRadioGroup \/>/);
  assert.match(read("src/app/(client-portal)/portal/profile/page.tsx"), /<ThemePreferenceField \/>/);
  assert.match(read("src/app/(driver-app)/driver/profile/page.tsx"), /<ThemePreferenceField \/>/);
  const choice = read("src/components/theme/theme-preference-choice.tsx");
  for (const label of ["Système", "Clair", "Sombre"]) assert.match(choice, new RegExp(`label: "${label}"`));
  assert.doesNotMatch(choice, /setAttribute|removeAttribute|documentElement/);
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
  applyThemeToRoot(root, "/dashboard", "dark", false);
  assert.equal(attrs.get("data-theme"), "dark");
  applyThemeToRoot(root, "/registerx", "dark", true);
  assert.equal(attrs.has("data-theme"), false);
  applyThemeToRoot(root, "/bakery", "system", true);
  assert.equal(attrs.get("data-theme"), "dark");
  applyThemeToRoot(root, "/dashboard/rounds", "dark", true);
  assert.equal(attrs.get("data-theme"), "dark");
  applyThemeToRoot(root, "/driver/navigate/abc", "light", true);
  assert.equal(attrs.get("data-theme"), "light");
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
  // Un clic bascule Clair ↔ Sombre : plus de menu à trois choix.
  assert.doesNotMatch(toggle, /DropdownMenuRadioGroup/);
  assert.match(toggle, /setPreference\(effective === "dark" \? "light" : "dark"\)/);
});

test("la barre du portail tient à 320 px : thème et avatar passent dans le menu sous 640 px", () => {
  const layout = readFileSync(new URL("../src/components/layouts/client-portal-layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /<ThemeToggle className="max-sm:hidden"/);
  assert.match(layout, /sm:hidden">[\s\S]*<ThemeMenuItem/);
  // Le compte connecté (avatar, nom) masqué dans la barre est repris dans le menu mobile.
  assert.match(layout, /max-sm:hidden[\s\S]*<Avatar/);
  assert.match(layout, /className="sm:hidden" data-testid="portal-mobile-account">[\s\S]*<Avatar[\s\S]*user\.firstName/);
});

test("DA-1 : une seule famille, Geist (et Geist Mono), chargée par le layout racine ; plus de Sora ni d'Inter", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const rootLayout = read("src/app/layout.tsx");
  assert.match(rootLayout, /import \{ Geist, Geist_Mono \} from "next\/font\/google"/);
  assert.match(rootLayout, /variable: "--font-sans"/);
  assert.match(rootLayout, /variable: "--font-mono"/);
  assert.doesNotMatch(rootLayout, /\bInter\b|Sora/);
  assert.doesNotMatch(read("src/app/(client-portal)/layout.tsx"), /sora/i);
  assert.doesNotMatch(read("src/features/auth/auth-shell.tsx"), /sora/i);
  assert.doesNotMatch(css, /--font-sora/);
  assert.match(css, /--font-sans: "Geist"/);
});

test("DA-1 : l'Aube est l'action principale, jamais du texte sur fond clair", () => {
  assert.equal(light.get("--color-primary"), "#ffd60a");
  assert.equal(dark.get("--color-primary"), "#ffd60a");
  assert.equal(light.get("--color-primary-foreground"), "#0d0d12");
  // Texte de marque et liens en clair : jamais l'Aube (1,4:1 sur blanc).
  for (const token of ["--color-brand", "--color-success", "--color-warning", "--color-ring"]) {
    assert.notEqual(light.get(token), "#ffd60a", `${token} ne doit pas être l'Aube en clair`);
  }
  assert.ok(ratio("#ffd60a", "#ffffff") < 3);
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
  // Le texte atténué du sombre doit rester lisible sur la surface de verre sombre (#1a1a22).
  assert.ok(ratio(dark.get("--color-muted-foreground")!, "#1a1a22") >= 4.5);
  assert.match(darkBlock, /--map-glass-bg: rgb\(26 26 34 \/ 0\.94\)/);
});

test("cartes partagées : un fond blanc codé en dur avec un texte en jeton porte sa variante dark:", () => {
  const files = [
    "src/components/maps/provider-tile-layer.tsx",
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
  assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(THEME_EXCLUDED_PATH_PREFIXES)));
  const paths = ["/portal", "/portal/orders/new", "/portalx", "/portal-old", "/dashboard", "/", "/driver/profile", "/driver/navigate/x", "/bakery", "/bakeryx", "/dashboard/rounds", "/admin/users", "/login", "/tarifs"];
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

test("DESIGN-2 : dans les espaces migrés, aucune couleur claire codée en dur sans sa variante dark:", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const roots = [
    "src/features/back-office", "src/features/driver", "src/features/admin", "src/features/support", "src/features/users",
    "src/app/(back-office)", "src/app/(driver-app)",
    "src/components/ui", "src/components/shared", "src/components/layouts", "src/components/theme", "src/lib/permissions",
  ];
  // Aucune exclusion : les écrans de carte sont en Dark et doivent suivre la même règle.
  const excluded = /^$/;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name) && !excluded.test(path)) files.push(path);
    }
  };
  roots.forEach(walk);
  const isLightHex = (hex: string) => {
    const n = parseInt(hex, 16);
    return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3 > 200;
  };
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const [, classes] of src.matchAll(/["`]([^"`]*\b(?:bg|text)-[^"`]*)["`]/g)) {
      const tokens = classes!.split(/\s+/);
      if (tokens.some((t) => t.startsWith("dark:"))) continue;
      const lightSurface = tokens.some((t) =>
        /^(?:hover:)?bg-white(?:\/(?:[5-9]\d|100))?$/.test(t) ||
        /^(?:hover:)?bg-(?:zinc|gray|slate|neutral|stone|red|amber|orange|yellow|emerald|green|blue|sky|indigo)-(?:50|100|200)$/.test(t) ||
        (/^(?:hover:)?bg-\[#[0-9a-fA-F]{6}\]$/.test(t) && isLightHex(t.match(/#(\w{6})/)![1]!))
      );
      const darkText = tokens.some((t) =>
        (/^text-\[#[0-9a-fA-F]{6}\]$/.test(t) && !isLightHex(t.match(/#(\w{6})/)![1]!)) ||
        /^text-(?:red|amber|orange|yellow|emerald|green|blue|sky|indigo|zinc|gray|slate|neutral|stone)-[6-9]\d0$/.test(t) ||
        t === "text-black"
      );
      // Texte blanc sur un jeton qui s'éclaircit en Dark (vert, encre inversée, statuts) : illisible sans variante.
      const whiteOnLightening = tokens.includes("text-white") &&
        tokens.some((t) => /^bg-(?:brand|primary|foreground|success|warning|error)$/.test(t));
      if (lightSurface || darkText || whiteOnLightening) offenders.push(`${file} : « ${classes!.slice(0, 120)} »`);
    }
  }
  assert.deepEqual(offenders, []);
});
