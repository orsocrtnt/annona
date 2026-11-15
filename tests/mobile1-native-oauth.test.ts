// MOBILE-1, AUTH-GOOGLE — connexion Google dans l'application : navigateur du système, retour par le lien de
// l'application (fr.annona.app://auth/callback), puis /auth/callback dans la vue web.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  NATIVE_APP_SCHEME,
  nativeOAuthRedirect,
  openNativeOAuth,
  watchNativeOAuthReturn,
  webCallbackFromAppLink,
  type NativeOAuthPlugins,
} from "../src/lib/native/oauth";

const ORIGIN = "https://annona-gray.vercel.app";

test("MOBILE-1 OAuth : adresse de retour = lien de l'application, schéma = identifiant de l'application", () => {
  assert.equal(nativeOAuthRedirect("login"), "fr.annona.app://auth/callback?intent=login");
  assert.equal(nativeOAuthRedirect("signup"), "fr.annona.app://auth/callback?intent=signup");
  assert.equal(NATIVE_APP_SCHEME, "fr.annona.app");
  assert.match(readFileSync("capacitor.config.ts", "utf8"), /appId: MOBILE_APP_ID/);
});

test("MOBILE-1 OAuth : lien reçu → /auth/callback sur l'origine de la vue web, paramètres connus seulement", () => {
  assert.equal(
    webCallbackFromAppLink("fr.annona.app://auth/callback?intent=login&code=abc123&next=https://evil.example", ORIGIN),
    `${ORIGIN}/auth/callback?code=abc123&intent=login`
  );
  assert.equal(
    webCallbackFromAppLink("fr.annona.app://auth/callback/?intent=signup&error=access_denied&error_description=refus", ORIGIN),
    `${ORIGIN}/auth/callback?intent=signup&error=access_denied&error_description=refus`
  );
});

test("MOBILE-1 OAuth : tout autre lien est ignoré (pas de redirection ouverte)", () => {
  for (const link of [
    "https://evil.example/auth/callback?code=abc",
    "fr.annona.app://evil.example/auth/callback?code=abc",
    "fr.annona.app://auth/other?code=abc",
    "fr.annona.app://auth/callback?intent=login",
    "autre.app://auth/callback?code=abc",
    "pas une adresse",
  ]) {
    assert.equal(webCallbackFromAppLink(link, ORIGIN), null, link);
  }
});

function fakePlugins(launchUrl?: string) {
  const calls: string[] = [];
  let listener: ((event: { url: string }) => void) | null = null;
  const plugins: NativeOAuthPlugins = {
    openBrowser: async (url) => { calls.push(`open:${url}`); },
    closeBrowser: async () => { calls.push("close"); },
    addAppUrlListener: async (callback) => {
      listener = callback;
      return { remove: () => { calls.push("remove"); listener = null; } };
    },
    getLaunchUrl: async () => (launchUrl ? { url: launchUrl } : undefined),
  };
  return { plugins, calls, fire: (url: string) => listener?.({ url }) };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function memory() {
  let stored: string | null = null;
  return { get: () => stored, set: (link: string) => { stored = link; } };
}

test("MOBILE-1 OAuth : ouverture dans le navigateur du système", async () => {
  const fake = fakePlugins();
  await openNativeOAuth("https://supabase.example/auth/v1/authorize?provider=google", { plugins: async () => fake.plugins });
  assert.deepEqual(fake.calls, ["open:https://supabase.example/auth/v1/authorize?provider=google"]);
});

test("MOBILE-1 OAuth : retour de Google → navigateur refermé et /auth/callback chargé une fois ; autres liens ignorés", async () => {
  const fake = fakePlugins();
  const visits: string[] = [];
  const stop = watchNativeOAuthReturn({ plugins: async () => fake.plugins, origin: ORIGIN, navigate: (url) => visits.push(url), memory: memory() });
  await tick();
  fake.fire("https://evil.example/?code=x");
  fake.fire("fr.annona.app://auth/callback?intent=login&code=c1");
  fake.fire("fr.annona.app://auth/callback?intent=login&code=c2");
  await tick();
  assert.deepEqual(visits, [`${ORIGIN}/auth/callback?code=c1&intent=login`]);
  assert.ok(fake.calls.includes("close"));
  stop();
  assert.ok(fake.calls.includes("remove"));
});

test("MOBILE-1 OAuth : application relancée par le lien (getLaunchUrl) traitée une fois, jamais rejouée après une déconnexion", async () => {
  const link = "fr.annona.app://auth/callback?intent=login&code=launch";
  const remembered = memory();
  const first: string[] = [];
  const stopFirst = watchNativeOAuthReturn({ plugins: async () => fakePlugins(link).plugins, origin: ORIGIN, navigate: (url) => first.push(url), memory: remembered });
  await tick();
  await tick();
  assert.deepEqual(first, [`${ORIGIN}/auth/callback?code=launch&intent=login`]);
  stopFirst();
  // Page de connexion rouverte plus tard dans la même vie de l'application : même lien de lancement, ignoré.
  const second: string[] = [];
  const stopSecond = watchNativeOAuthReturn({ plugins: async () => fakePlugins(link).plugins, origin: ORIGIN, navigate: (url) => second.push(url), memory: remembered });
  await tick();
  await tick();
  assert.deepEqual(second, []);
  stopSecond();
});

test("MOBILE-1 OAuth : écoute arrêtée avant le chargement des modules → rien n'est branché", async () => {
  const fake = fakePlugins("fr.annona.app://auth/callback?code=late");
  const visits: string[] = [];
  const stop = watchNativeOAuthReturn({ plugins: async () => fake.plugins, origin: ORIGIN, navigate: (url) => visits.push(url), memory: memory() });
  stop();
  await tick();
  await tick();
  assert.deepEqual(visits, []);
});

test("MOBILE-1 OAuth : Android déclare le lien de l'application", () => {
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.match(manifest, /<data android:scheme="fr\.annona\.app" android:host="auth" \/>/);
  assert.match(manifest, /android\.intent\.category\.BROWSABLE/);
});
