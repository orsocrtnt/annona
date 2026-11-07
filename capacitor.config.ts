import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";
// Chemin relatif : la CLI Capacitor ne connaît pas l'alias `@/`.
import { MOBILE_APP_ID, MOBILE_APP_NAME, MOBILE_START_PATH, resolveMobileServer } from "./src/lib/native/app-config";

/**
 * MOBILE-1 — application hébergée : l'application charge le site Annona (`CAPACITOR_SERVER_URL`,
 * par défaut http://localhost:3000 pour les essais) ; `mobile/www` ne contient que la page
 * « hors connexion » affichée quand le site ne répond pas. Voir docs/MOBILE.md.
 */
const server = resolveMobileServer(process.env.CAPACITOR_SERVER_URL);
const webDir = "mobile/www";

// La page de repli doit connaître l'adresse à réessayer : écrite ici pour suivre chaque `cap sync`.
const fallbackConfig = join(__dirname, webDir, "app-config.js");
const fallbackContent = `window.ANNONA_SERVER_URL = ${JSON.stringify(server.url + MOBILE_START_PATH)};\n`;
if (!existsSync(fallbackConfig) || readFileSync(fallbackConfig, "utf8") !== fallbackContent) {
  writeFileSync(fallbackConfig, fallbackContent);
}

const config: CapacitorConfig = {
  appId: MOBILE_APP_ID,
  appName: MOBILE_APP_NAME,
  webDir,
  server: {
    url: server.url,
    appStartPath: MOBILE_START_PATH,
    cleartext: server.cleartext,
    errorPath: "index.html",
  },
  ios: {
    contentInset: "never",
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#F5F8F6",
      showSpinner: false,
    },
  },
};

export default config;
