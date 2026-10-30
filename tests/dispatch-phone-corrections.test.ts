import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PHONE_MEDIA_QUERY, THEME_INIT_SCRIPT, applyThemeToRoot, resolveRootTheme } from "../src/lib/theme";

test("téléphone : thème clair seul, quels que soient la préférence et le système", () => {
  const prefixes = ["/driver"];
  assert.equal(resolveRootTheme("/driver", "dark", true, prefixes, [], true), "light");
  assert.equal(resolveRootTheme("/driver", "system", true, prefixes, [], true), "light");
  assert.equal(resolveRootTheme("/driver", "dark", false, prefixes, [], false), "dark", "ordinateur inchangé");
  assert.equal(resolveRootTheme("/ailleurs", "dark", true, prefixes, [], true), null, "hors périmètre inchangé");
  const attributes = new Map<string, string>();
  const root = { setAttribute: (n: string, v: string) => attributes.set(n, v), removeAttribute: (n: string) => attributes.delete(n) };
  applyThemeToRoot(root, "/driver", "dark", true, true);
  assert.equal(attributes.get("data-theme"), "light");
});

test("le premier affichage et la feuille de style utilisent la même règle téléphone", () => {
  assert.ok(THEME_INIT_SCRIPT.includes(JSON.stringify(PHONE_MEDIA_QUERY)));
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, new RegExp(`@media ${PHONE_MEDIA_QUERY.replace(/[()]/g, "\\$&")} \\{\\s+\\.theme-control`));
  for (const file of ["src/components/theme/theme-toggle.tsx", "src/components/theme/theme-preference-choice.tsx"]) {
    assert.match(readFileSync(file, "utf8"), /theme-control/, file);
  }
});

test("la carte plein écran garde un accès au menu sur téléphone", () => {
  const layout = readFileSync("src/components/layouts/back-office-layout.tsx", "utf8");
  assert.match(layout, /mapFullscreen && \([\s\S]*?onClick=\{toggleMobileNav\}[\s\S]*?aria-label="Ouvrir le menu"/);
});

test("l'itinéraire est tracé par la carte quand le serveur n'en fournit pas", () => {
  const map = readFileSync("src/components/maps/deliveries-live-map.tsx", "utf8");
  assert.match(map, /driverMoving=\{Boolean\(showDriver && delivery\.driverLocation\?\.motion\?\.route\)\}/);
});

test("le lancement passe par une proposition, sauf « Ne plus me demander »", () => {
  const page = readFileSync("src/app/(back-office)/dispatch/page.tsx", "utf8");
  assert.match(page, /if \(skipAutoConfirm\) return runAuto\(\);\s+try \{\s+setAutoPreview\(await previewAutoDispatch\.mutateAsync\(\)\)/);
  const route = readFileSync("src/app/api/dispatch/auto-assign/route.ts", "utf8");
  assert.match(route, /confirmAutoDispatch\(companyId, parsed\.data\.assignments\)/);
  const service = readFileSync("src/domains/delivery/auto-dispatch.service.ts", "utf8");
  const preview = service.slice(service.indexOf("export async function previewAutoDispatch"), service.indexOf("const STALE_PROPOSAL_ERRORS"));
  assert.ok(!preview.includes("assignDeliveryToDriver"), "la proposition n'affecte rien");
});
