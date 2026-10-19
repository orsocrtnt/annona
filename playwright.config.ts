import { defineConfig } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // La suite navigateur sans accès DB reste utilisable avec les variables déjà exportées.
}

// `localhost` conserve les cookies Secure lors d'une recette sur le build de
// production local. L'écoute reste bornée à 127.0.0.1 dans `webServer`.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3106";
const useExternalServer = process.env.E2E_SKIP_WEB_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: "line",
  outputDir: "/private/tmp/tutelliv-test2-playwright",
  use: {
    baseURL,
    headless: true,
    channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === "darwin" ? "chrome" : undefined),
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
  },
  webServer: useExternalServer
    ? undefined
    : {
        command:
          "WATCHPACK_POLLING=true CHOKIDAR_USEPOLLING=true npm run dev -- --hostname 127.0.0.1 --port 3106",
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
