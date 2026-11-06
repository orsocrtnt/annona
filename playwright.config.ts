import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // La suite navigateur sans accès DB reste utilisable avec les variables déjà exportées.
}

// `localhost` conserve les cookies Secure lors d'une recette sur le build de
// production local. L'écoute reste bornée à 127.0.0.1 dans `webServer`.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3106";
const useExternalServer = process.env.E2E_SKIP_WEB_SERVER === "1";
const localServerPort = new URL(baseURL).port || "3106";
if (!/^\d{2,5}$/.test(localServerPort)) throw new Error("E2E_PORT_INVALID");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: "line",
  outputDir: resolve(tmpdir(), "annona-test2-playwright"),
  use: {
    baseURL,
    headless: true,
    // Sur Mac, le Chrome du poste et le Chromium complet expirent au lancement : la coquille sans interface est fiable.
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "darwin" ? "chromium-headless-shell" : undefined),
    // MOBILE-WEB : `E2E_MOBILE=1` rejoue les parcours sur un téléphone (390 × 844, tactile).
    ...(process.env.E2E_MOBILE === "1" ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : {}),
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command:
          `WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=true npm run dev -- --hostname 127.0.0.1 --port ${localServerPort}`,
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
