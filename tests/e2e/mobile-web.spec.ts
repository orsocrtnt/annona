import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// MOBILE-WEB (lot H). Contrôles souples (expect.soft) : un passage relève tous les défauts. À 390 et 360 px, sur les pages principales
// de chaque espace : la page ne défile jamais horizontalement et les boutons / liens visibles font au moins
// 44 × 44 px. Exclus, par construction : le lien d'évitement (hors écran tant qu'il n'a pas le focus), les
// éléments sr-only et les liens en ligne au milieu d'une phrase (cible WCAG 2.5.8 : exception « en ligne »).
// Comptes : session de démonstration (personas admin, client, livreur) ; /admin demande le compte
// `superAdmin` de `npm run e2e:role-accounts -- setup`.

const SIZES = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
];
const MIN = 44;
// Clair seulement : le mode sombre est retiré des téléphones depuis le 30 octobre 2026 (voir `PHONE_` dans src/lib/theme.ts).
const THEMES: ("light" | "dark")[] = ["light"];

const PUBLIC = ["/", "/tarifs", "/contact", "/fonctionnalites", "/mentions-legales", "/confidentialite", "/login", "/login/client", "/login/driver", "/register", "/forgot-password"];
const BACK_OFFICE = ["/dashboard", "/dashboard/orders", "/dashboard/clients", "/dashboard/drivers", "/dispatch", "/dispatch/map", "/dispatch/drivers", "/dispatch/intake", "/users", "/support", "/settings"];
const PORTAL = ["/portal", "/portal/orders", "/portal/orders/new", "/portal/orders/history", "/portal/deliveries", "/portal/invoices", "/portal/recurring", "/portal/support", "/portal/profile", "/portal/settings"];
const DRIVER = ["/driver", "/driver/missions", "/driver/profile"];
const ADMIN = ["/admin", "/admin/users", "/admin/sales", "/admin/support", "/admin/incidents", "/admin/operations", "/admin/subscriptions", "/admin/access-events", "/companies"];

async function overflowX(page: Page) {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
}

async function smallTargets(page: Page) {
  return page.evaluate((min) => {
    const bad: string[] = [];
    const nodes = document.querySelectorAll<HTMLElement>("a[href], button, [role='button'], summary");
    for (const el of nodes) {
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
      if (el.closest("[hidden], [aria-hidden='true'], .sr-only")) continue;
      // Marqueurs Leaflet : l'ancre fait 1 × 1 px ; la cible réelle est la zone tactile ::after de 44 px
      // (map-theme.css), mesurée ici pour chaque marqueur cliquable.
      if (el.classList.contains("leaflet-marker-icon")) {
        if (!el.classList.contains("leaflet-interactive")) continue;
        const hit = getComputedStyle(el, "::after");
        const size = Math.min(parseFloat(hit.width) || 0, parseFloat(hit.height) || 0);
        if (hit.position !== "absolute" || size < min - 0.5) bad.push(`marqueur de carte ${Math.round(size)}×${Math.round(size)}`);
        continue;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // Lien d'évitement : hors écran tant qu'il n'a pas le focus.
      if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= window.innerWidth + 1000 || rect.top < -500) continue;
      // Lien en ligne dans une phrase : du texte du parent entoure le lien.
      if (el.tagName === "A" && el.parentElement && style.display === "inline") {
        const around = Array.from(el.parentElement.childNodes).some((n) => n !== el && n.nodeType === 3 && (n.textContent ?? "").trim() !== "");
        if (around) continue;
      }
      // Interrupteurs : la zone cliquable est étendue par un ::after absolu à insets négatifs (hors cadre visuel).
      let width = rect.width;
      let height = rect.height;
      const after = getComputedStyle(el, "::after");
      if (el.getAttribute("role") === "switch" && after.position === "absolute") {
        const [t = 0, r = 0, b = 0, l = 0] = [after.top, after.right, after.bottom, after.left].map((v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : 0));
        width -= l + r;
        height -= t + b;
      }
      if (width < min - 0.5 || height < min - 0.5) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
        bad.push(`${el.tagName.toLowerCase()} « ${label} » ${Math.round(width)}×${Math.round(height)}`);
      }
    }
    return bad;
  }, MIN);
}

async function audit(page: Page, path: string, width: number) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toBeVisible();
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const theme = await page.evaluate(() => localStorage.getItem("tutelliv-theme"));
  // Toutes les pages auditées suivent le choix Clair / Sombre (THEME_SCOPED_PATH_PREFIXES).
  if (theme) expect.soft(await page.evaluate(() => document.documentElement.dataset.theme), `${path} : thème ${theme} appliqué`).toBe(theme);
  const { scrollWidth, innerWidth } = await overflowX(page);
  expect.soft(scrollWidth, `${path} @${width} : défilement horizontal`).toBeLessThanOrEqual(innerWidth);
  expect.soft(await smallTargets(page), `${path} @${width} : cibles < ${MIN} px`).toEqual([]);
}

for (const theme of THEMES) for (const size of SIZES) {
  test.describe(`MOBILE-WEB ${size.width} px ${theme === "dark" ? "Sombre" : "Clair"}`, () => {
    test.use({ viewport: size, colorScheme: theme });
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem("tutelliv-theme", value), theme);
    });

    test("site public et authentification", async ({ page }) => {
      for (const path of PUBLIC) await audit(page, path, size.width);
    });

    test("démonstration : back-office, portail, livreur", async ({ page }) => {
      test.setTimeout(600_000);
      const login = await page.request.post("/api/auth/login", {
        data: { email: "demo@tutelliv.fr", password: "Demo2026!", demoTestSession: true, accountType: "company" },
      });
      expect(login.status()).toBe(200);
      try {
        for (const [persona, paths] of [["admin", BACK_OFFICE], ["client", PORTAL], ["driver", DRIVER]] as const) {
          expect((await page.request.post("/api/demo/persona", { data: { persona } })).status()).toBe(200);
          for (const path of paths) await audit(page, path, size.width);
        }
      } finally {
        await page.request.post("/api/auth/logout").catch(() => undefined);
      }
    });

    test("espace /admin (compte superAdmin)", async ({ page }) => {
      test.setTimeout(600_000);
      let account: { email: string; password: string } | undefined;
      try {
        account = JSON.parse(readFileSync(resolve("outputs/e2e-role-accounts.json"), "utf8")).superAdmin;
      } catch {
        account = undefined;
      }
      test.skip(!account, "comptes de rôle absents : npm run e2e:role-accounts -- setup");
      expect((await page.request.post("/api/auth/login", { data: account })).status()).toBe(200);
      try {
        for (const path of ADMIN) await audit(page, path, size.width);
      } finally {
        await page.request.post("/api/auth/logout").catch(() => undefined);
      }
    });
  });
}
