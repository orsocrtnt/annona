import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("le thème Glass Light V2 reste limité au tableau de bord entreprise", () => {
  const routeLayout = read("src/app/(back-office)/layout.tsx");
  const shell = read("src/components/layouts/back-office-layout.tsx");
  const rootLayout = read("src/app/layout.tsx");

  assert.match(routeLayout, /pathname === "\/dashboard"/);
  assert.match(routeLayout, /dashboardVisualV2=\{dashboardVisualV2\}/);
  assert.match(shell, /dashboard-v2-shell/);
  assert.match(rootLayout, /Sora/);
  assert.doesNotMatch(routeLayout, /startsWith\("\/dashboard"\)/);
});

test("le dashboard premium n'invente ni création ni données d'activité", () => {
  const content = read("src/features/back-office/company-dashboard-content.tsx");
  const widgets = read("src/features/back-office/dashboard-widget-renderer.tsx");
  const maps = read("src/features/back-office/dashboard-map-widgets.tsx");

  assert.match(content, /Bonjour\{user\?\.firstName/);
  assert.match(content, /Ouvrir le dispatch/);
  assert.match(content, /Voir les commandes/);
  assert.doesNotMatch(content, /Nouvelle livraison/);

  assert.match(widgets, /dashboard\.periods\[period\]/);
  assert.match(widgets, /STATUS_ROWS\.map/);
  assert.match(widgets, /Répartition des \$\{periodStats\.total\.total\} missions/);
  assert.match(maps, /useDispatchDeliveriesMap/);
  assert.match(widgets, /useDriverLiveLocations/);
  assert.match(widgets, /dashboard\.lists\.periods\[period\]\.all/);
  assert.doesNotMatch(widgets, /Math\.random|faker|mockData|fakeData/);
});

test("la coque premium garde navigation, personnalisation et alertes réelles", () => {
  const shell = read("src/components/layouts/back-office-layout.tsx");
  const sidebar = read("src/components/layouts/sidebar.tsx");
  const content = read("src/features/back-office/company-dashboard-content.tsx");
  const styles = read("src/app/globals.css");

  assert.match(shell, /OrderMessagesInbox enableDispatchTargets/);
  assert.match(content, /DashboardCustomizeDrawer/);
  assert.match(sidebar, /bg-\[#0e1310\]/);
  assert.match(sidebar, /bg-\[#00d46a\]/);
  assert.match(sidebar, /premium \? \(/);
  assert.match(sidebar, /Package2/);
  assert.doesNotMatch(sidebar, />\s*Tu\s*</);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /dashboard-v2-route-line/);
});

test("les missions et contrôles premium restent accessibles sur mobile", () => {
  const widgets = read("src/features/back-office/dashboard-widget-renderer.tsx");
  const drawer = read("src/features/back-office/dashboard-customize-drawer.tsx");

  assert.match(widgets, /md:hidden/);
  assert.match(widgets, /hidden border-t border-black\/\[0\.055\] md:block/);
  assert.doesNotMatch(widgets, /min-w-\[720px\]/);
  assert.match(widgets, /aria-pressed=\{period === option\.key\}/);
  assert.match(drawer, /aria-pressed=\{draft\.defaultPeriod === option\.key\}/);
  assert.match(widgets, /min-h-11/);
});
