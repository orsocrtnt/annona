import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("la coque Glass Light V2 couvre tout le back-office", () => {
  const routeLayout = read("src/app/(back-office)/layout.tsx");
  const shell = read("src/components/layouts/back-office-layout.tsx");
  const sidebar = read("src/components/layouts/sidebar.tsx");
  const rootLayout = read("src/app/layout.tsx");

  assert.doesNotMatch(routeLayout, /pathname === "\/dashboard"/);
  assert.match(shell, /className="dashboard-v2-shell min-h-screen/);
  assert.match(shell, /<Sidebar items=\{navItems\} footer=\{sidebarFooter\} premium \/>/);
  assert.match(shell, /<MobileNav items=\{navItems\} premium \/>/);
  assert.match(shell, /<Header breadcrumbs=\{breadcrumbs\} premium \/>/);
  assert.match(shell, /OrderMessagesInbox enableDispatchTargets/);
  assert.match(sidebar, /bg-\[#0e1310\]/);
  assert.match(sidebar, /bg-\[#00d46a\]/);
  assert.match(rootLayout, /Sora/);
});

test("le dashboard garde ses widgets de pilotage et leurs détails", () => {
  const content = read("src/features/back-office/company-dashboard-content.tsx");
  const widgets = read("src/features/back-office/dashboard-widget-renderer.tsx");

  assert.match(content, /<h1[^>]*>Tableau de bord<\/h1>/);
  assert.match(content, /DashboardCustomizeDrawer/);
  assert.match(content, /drillDown/);
  for (const widget of ["AlertsRowWidget", "TodaySummaryWidget", "PlanningWidget", "PlanningStatusTableSection", "MapDriversWidget", "MapDeliveriesWidget"]) {
    assert.match(widgets, new RegExp(`function ${widget}`));
  }
  assert.doesNotMatch(widgets, /Math\.random|faker|mockData|fakeData/);
});

test("les jetons du thème suivent la palette TutelLiv, sans le bleu historique", () => {
  const styles = read("src/app/globals.css");

  assert.match(styles, /--color-primary: #0e1310;/);
  assert.match(styles, /--color-ring: #00d46a;/);
  assert.match(styles, /--color-brand: #08783f;/);
  assert.match(styles, /--color-background: #f8f9f7;/);
  assert.doesNotMatch(styles, /#0066ff|#0052cc|#e6f0ff/i);
});
