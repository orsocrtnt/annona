/**
 * MOBILE-1 (ENF-01, ENF-04, LIV-04, LIV-05, LIV-06, NOT-01 à NOT-03) — ponts natifs Capacitor :
 * détection application / navigateur, repli web inchangé, Plans et Waze, position pendant la tournée
 * seulement, appareil photo, réseau, notifications natives (client et serveur), copie hors réseau.
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import type { Prisma } from "@prisma/client";
import { deliverDriverMissionPush, NEW_MISSION_PUSH } from "../src/domains/driver/driver-push.service";
import { nativePushChannel } from "../src/domains/notification/native-push-channel";
import {
  apnsPayload,
  deliverToNativeDevices,
  fcmMessage,
  getNativePushConfig,
  nativeEndpoint,
  NativePushError,
  nativeSubscription,
  parseNativeEndpoint,
  signJwt,
  type NativePushConfig,
} from "../src/domains/notification/native-push.service";
import { notificationChannels, type NotificationMessage } from "../src/domains/notification/notification-channels";
import { getDriverPushAvailability } from "../src/features/driver/driver-push";
import { driverOfflineUrls } from "../src/features/driver/driver-offline-cache";
import { appleMapsUrl, wazeUrl } from "../src/lib/maps/navigation-links";
import { MOBILE_APP_ID, MOBILE_START_PATH, resolveMobileServer } from "../src/lib/native/app-config";
import { base64ToBlob, nativeCameraAvailable, takeNativePhoto } from "../src/lib/native/camera";
import { watchDriverPosition, type DriverPosition, type NativeGeolocation } from "../src/lib/native/geolocation";
import { driverLocationAllowed } from "../src/lib/native/location-policy";
import { isNavigationAppUrl, openInNavigationApp } from "../src/lib/native/navigation";
import { watchConnectivity } from "../src/lib/native/network";
import { appPlatform, isNativeApp, type CapacitorRuntime } from "../src/lib/native/platform";
import {
  NATIVE_PUSH_API,
  NATIVE_PUSH_TOKEN_STORAGE_KEY,
  releaseNativePush,
  safeNotificationPath,
  startNativePush,
  type NativePushPlugin,
} from "../src/lib/native/push";
import { nativePushTokenSchema } from "../src/lib/validations/native-push";

const runtime = (platform: string, native = platform !== "web"): CapacitorRuntime => ({
  isNativePlatform: () => native,
  getPlatform: () => platform,
});
const IOS = runtime("ios");
const ANDROID = runtime("android");
const WEB = runtime("web");
const flush = () => new Promise((resolve) => setImmediate(resolve));
const APNS_TOKEN = "a".repeat(64);
const FCM_TOKEN = `fcm-token_${"b".repeat(40)}:APA91`;

// --- Détection ---------------------------------------------------------------------------------

test("détection : iOS et Android natifs, navigateur sinon (y compris sans Capacitor)", () => {
  assert.equal(appPlatform(IOS), "ios");
  assert.equal(appPlatform(ANDROID), "android");
  assert.equal(appPlatform(WEB), "web");
  assert.equal(appPlatform(null), "web");
  assert.equal(appPlatform(runtime("electron", true)), "web", "plate-forme inconnue : comportement web");
  assert.equal(isNativeApp(IOS), true);
  assert.equal(isNativeApp(WEB), false);
  // Le vrai module, chargé hors application (Node, navigateur) : web.
  assert.equal(isNativeApp(), false);
});

test("configuration : une application hébergée, HTTPS hors réseau local, origine seule", () => {
  assert.equal(MOBILE_APP_ID, "fr.annona.app");
  assert.equal(MOBILE_START_PATH, "/login");
  assert.deepEqual(resolveMobileServer(undefined), { url: "http://localhost:3000", hostname: "localhost", cleartext: true });
  assert.deepEqual(resolveMobileServer("https://app.annona.fr/"), { url: "https://app.annona.fr", hostname: "app.annona.fr", cleartext: false });
  assert.equal(resolveMobileServer("http://192.168.1.20:3000").cleartext, true, "téléphone sur le réseau du poste");
  assert.equal(resolveMobileServer("http://10.0.2.2:3000").url, "http://10.0.2.2:3000", "émulateur Android");
  assert.throws(() => resolveMobileServer("http://app.annona.fr"), /HTTPS/);
  assert.throws(() => resolveMobileServer("https://app.annona.fr/driver"), /origine seule/);
  assert.throws(() => resolveMobileServer("pas une adresse"), /invalide/);
});

// --- Plans et Waze (LIV-04, critère 7) ----------------------------------------------------------

test("Plans et Waze : confiés au système dans l'application, lien web inchangé dans un navigateur", () => {
  const target = { latitude: 48.8566, longitude: 2.3522, address: "1 rue de Rivoli, 75001 Paris" };
  for (const url of [appleMapsUrl(target), wazeUrl(target), wazeUrl({ ...target, latitude: null, longitude: null })]) {
    assert.equal(isNavigationAppUrl(url), true, url);
    const opened: string[] = [];
    assert.equal(openInNavigationApp(url, { runtime: IOS, openUrl: async (value) => opened.push(value) }), true);
    assert.equal(openInNavigationApp(url, { runtime: ANDROID, openUrl: async (value) => opened.push(value) }), true);
    assert.deepEqual(opened, [url, url], "le lien exact part au système");
    assert.equal(openInNavigationApp(url, { runtime: WEB, openUrl: async () => assert.fail("navigateur : pas de pont") }), false);
  }
  // Un lien étranger n'est jamais confié au système par ce pont.
  assert.equal(openInNavigationApp("https://exemple.fr/", { runtime: IOS, openUrl: async () => assert.fail() }), false);
  assert.equal(isNavigationAppUrl("http://maps.apple.com/?daddr=1,2"), false);
  assert.equal(isNavigationAppUrl("javascript:alert(1)"), false);
});

// --- Position pendant la tournée seulement (ENF-04) -----------------------------------------------

test("ENF-04 : position seulement pendant une tournée démarrée", () => {
  assert.equal(driverLocationAllowed([]), false);
  assert.equal(driverLocationAllowed([{ status: "ASSIGNED" }, { status: "DRAFT" }]), false);
  assert.equal(driverLocationAllowed([{ status: "COMPLETED" }]), false);
  assert.equal(driverLocationAllowed([{ status: "ASSIGNED" }, { status: "IN_PROGRESS" }]), true);
});

function fakeNativeGeolocation(permission: { check: string; request: string }) {
  const calls = { watch: 0, cleared: [] as string[], requested: 0 };
  let callback: ((position: DriverPosition | null, error?: { message?: string }) => void) | null = null;
  const plugin: NativeGeolocation = {
    checkPermissions: async () => ({ location: permission.check }),
    requestPermissions: async () => {
      calls.requested += 1;
      return { location: permission.request };
    },
    watchPosition: async (_options, cb) => {
      calls.watch += 1;
      callback = cb;
      return "watch-1";
    },
    clearWatch: async ({ id }) => {
      calls.cleared.push(id);
    },
  };
  return { plugin, calls, emit: (position: DriverPosition | null, error?: { message?: string }) => callback?.(position, error) };
}
const OPTIONS = { enableHighAccuracy: true, maximumAge: 2_000, timeout: 15_000 };
const POSITION: DriverPosition = { coords: { latitude: 48.85, longitude: 2.35, accuracy: 8, heading: null, speed: null }, timestamp: 1 };

test("position native : autorisation demandée, positions transmises, arrêt du suivi", async () => {
  const fake = fakeNativeGeolocation({ check: "prompt", request: "granted" });
  const seen: DriverPosition[] = [];
  const stop = watchDriverPosition({ onPosition: (p) => seen.push(p), onError: () => assert.fail() }, OPTIONS, { runtime: IOS, native: async () => fake.plugin });
  await flush();
  assert.equal(fake.calls.requested, 1);
  assert.equal(fake.calls.watch, 1);
  fake.emit(POSITION);
  assert.deepEqual(seen, [POSITION]);
  stop();
  await flush();
  assert.deepEqual(fake.calls.cleared, ["watch-1"]);
  fake.emit(POSITION);
  assert.equal(seen.length, 1, "plus rien après l'arrêt");
});

test("position native : refus → erreur « refusée », aucun suivi ; arrêt avant le démarrage → aucun suivi restant", async () => {
  const denied = fakeNativeGeolocation({ check: "denied", request: "denied" });
  const errors: number[] = [];
  watchDriverPosition({ onPosition: () => assert.fail(), onError: (code) => errors.push(code) }, OPTIONS, { runtime: ANDROID, native: async () => denied.plugin });
  await flush();
  assert.deepEqual(errors, [1]);
  assert.equal(denied.calls.watch, 0);

  const early = fakeNativeGeolocation({ check: "granted", request: "granted" });
  const stop = watchDriverPosition({ onPosition: () => assert.fail(), onError: () => assert.fail() }, OPTIONS, { runtime: IOS, native: async () => early.plugin });
  stop(); // fin de tournée immédiate
  await flush();
  assert.equal(early.calls.watch, 0, "le suivi n'est jamais lancé");
});

test("position web : navigator.geolocation inchangé ; absent → erreur", () => {
  const calls: string[] = [];
  const web = {
    watchPosition: (success: PositionCallback) => {
      calls.push("watch");
      success(POSITION as unknown as GeolocationPosition);
      return 7;
    },
    clearWatch: (id: number) => calls.push(`clear:${id}`),
    getCurrentPosition: () => undefined,
  } as unknown as Geolocation;
  const seen: DriverPosition[] = [];
  const stop = watchDriverPosition({ onPosition: (p) => seen.push(p), onError: () => assert.fail() }, OPTIONS, { runtime: WEB, web });
  stop();
  assert.deepEqual(calls, ["watch", "clear:7"]);
  assert.equal(seen.length, 1);
  const errors: number[] = [];
  watchDriverPosition({ onPosition: () => assert.fail(), onError: (code) => errors.push(code) }, OPTIONS, { runtime: WEB, web: null });
  assert.deepEqual(errors, [2]);
});

// --- Réseau (LIV-06, critère 8) ----------------------------------------------------------------

test("réseau web : événements online/offline, retirés à l'arrêt", () => {
  const listeners = new Map<string, () => void>();
  const target = {
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  } as unknown as Window;
  const events: string[] = [];
  const stop = watchConnectivity({ onOnline: () => events.push("on"), onOffline: () => events.push("off") }, { runtime: WEB, target });
  listeners.get("offline")!();
  listeners.get("online")!();
  assert.deepEqual(events, ["off", "on"]);
  stop();
  assert.equal(listeners.size, 0);
});

test("réseau natif : retour du réseau et retour au premier plan relancent la synchronisation", async () => {
  let network: ((status: { connected: boolean }) => void) | null = null;
  let resume: ((state: { isActive: boolean }) => void) | null = null;
  let removed = 0;
  const handle = { remove: async () => { removed += 1; } };
  const events: string[] = [];
  const stop = watchConnectivity(
    { onOnline: () => events.push("on"), onOffline: () => events.push("off"), onResume: () => events.push("resume") },
    {
      runtime: ANDROID,
      native: async () => ({
        addNetworkListener: async (fn) => { network = fn; return handle; },
        addResumeListener: async (fn) => { resume = fn; return handle; },
      }),
    }
  );
  await flush();
  network!({ connected: false });
  network!({ connected: true });
  resume!({ isActive: false });
  resume!({ isActive: true });
  assert.deepEqual(events, ["off", "on", "resume"]);
  stop();
  await flush();
  assert.equal(removed, 2);
  network!({ connected: true });
  assert.equal(events.length, 3, "plus rien après l'arrêt");
});

// --- Appareil photo (LIV-05) -------------------------------------------------------------------

test("photo native : image JPEG prête pour la file ; annulation → rien ; navigateur → champ fichier", async () => {
  assert.equal(nativeCameraAvailable(WEB), false);
  assert.equal(nativeCameraAvailable(IOS), true);
  await assert.rejects(takeNativePhoto({ runtime: WEB }), /NATIVE_CAMERA_UNAVAILABLE/);

  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const file = await takeNativePhoto({ runtime: IOS, getPhoto: async () => ({ base64String: bytes.toString("base64"), format: "jpeg" }) });
  assert.ok(file);
  assert.equal(file.type, "image/jpeg");
  assert.equal(file.name, "incident.jpg");
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);

  assert.equal(await takeNativePhoto({ runtime: ANDROID, getPhoto: async () => { throw new Error("User cancelled photos app"); } }), null);
  await assert.rejects(takeNativePhoto({ runtime: ANDROID, getPhoto: async () => { throw new Error("User denied access to camera"); } }), /denied/);
  assert.equal(base64ToBlob(Buffer.from("abc").toString("base64"), "image/png").size, 3);
});

// --- Notifications natives : application -------------------------------------------------------

function fakePushPlugin(permission: { check: string; request?: string }) {
  const listeners = new Map<string, (value: never) => void>();
  const calls = { registered: 0, requested: 0, removed: 0 };
  const plugin = {
    checkPermissions: async () => ({ receive: permission.check }),
    requestPermissions: async () => {
      calls.requested += 1;
      return { receive: permission.request ?? permission.check };
    },
    register: async () => {
      calls.registered += 1;
    },
    addListener: async (event: string, fn: (value: never) => void) => {
      listeners.set(event, fn);
      return { remove: () => { calls.removed += 1; } };
    },
  } as unknown as NativePushPlugin;
  const emit = (event: string, value: unknown) => (listeners.get(event) as ((value: unknown) => void) | undefined)?.(value);
  return { plugin, calls, emit };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    storage: { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => void map.set(key, value), removeItem: (key: string) => void map.delete(key) },
  };
}

test("notifications natives : navigateur et application sans clés → rien n'est demandé", async () => {
  const fake = fakePushPlugin({ check: "prompt", request: "granted" });
  assert.equal((await startNativePush({ runtime: WEB, enabled: true, plugin: async () => fake.plugin })).status, "web");
  assert.equal((await startNativePush({ runtime: IOS, enabled: false, plugin: async () => fake.plugin })).status, "disabled");
  assert.equal(fake.calls.requested + fake.calls.registered, 0);
});

test("notifications natives : autorisation, jeton envoyé au serveur, toucher → page de l'espace", async () => {
  const fake = fakePushPlugin({ check: "prompt", request: "granted" });
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const { map, storage } = memoryStorage();
  const opened: string[] = [];
  const started = await startNativePush({ runtime: IOS, enabled: true, plugin: async () => fake.plugin, fetch: fetchImpl, storage, navigate: (path) => opened.push(path) });
  assert.equal(started.status, "requested");
  assert.equal(fake.calls.requested, 1);
  assert.equal(fake.calls.registered, 1);

  fake.emit("registration", { value: APNS_TOKEN });
  await flush();
  assert.equal(requests[0]!.url, NATIVE_PUSH_API);
  assert.equal(requests[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(requests[0]!.init.body)), { platform: "ios", token: APNS_TOKEN });
  assert.deepEqual(JSON.parse(map.get(NATIVE_PUSH_TOKEN_STORAGE_KEY)!), { platform: "ios", token: APNS_TOKEN });

  fake.emit("pushNotificationActionPerformed", { notification: { data: { url: "/portal/orders/123" } } });
  fake.emit("pushNotificationActionPerformed", { notification: { data: { url: "https://pirate.example/" } } });
  fake.emit("pushNotificationActionPerformed", { notification: { data: { url: "/admin" } } });
  assert.deepEqual(opened, ["/portal/orders/123"]);

  started.stop();
  assert.equal(fake.calls.removed, 3);

  // Déconnexion : le jeton de ce téléphone est retiré pour ce compte.
  await releaseNativePush({ fetch: fetchImpl, storage });
  assert.equal(requests[1]!.init.method, "DELETE");
  assert.deepEqual(JSON.parse(String(requests[1]!.init.body)), { platform: "ios", token: APNS_TOKEN });
  assert.equal(map.has(NATIVE_PUSH_TOKEN_STORAGE_KEY), false);
  await releaseNativePush({ fetch: async () => assert.fail("rien à retirer"), storage });
});

test("notifications natives : refus → aucun enregistrement", async () => {
  const fake = fakePushPlugin({ check: "denied" });
  assert.equal((await startNativePush({ runtime: ANDROID, enabled: true, plugin: async () => fake.plugin })).status, "denied");
  assert.equal(fake.calls.registered, 0);
});

test("page ouverte depuis une notification : espaces client et livreur seulement", () => {
  for (const ok of ["/portal", "/portal/orders?id=1", "/driver", "/driver/missions#x"]) assert.equal(safeNotificationPath(ok), ok);
  for (const ko of [undefined, 3, "", "/admin", "//pirate.example/portal", "https://annona.fr/portal", "/portalx", "/driver/../admin", "/portal\\..\\admin"]) {
    assert.equal(safeNotificationPath(ko), null, String(ko));
  }
});

test("dans l'application, le réglage push web du livreur renvoie aux réglages du téléphone", () => {
  assert.equal(getDriverPushAvailability({ native: true, publicKey: "k", supported: false, ios: true, standalone: false, permission: null }), "native");
  assert.equal(getDriverPushAvailability({ publicKey: "k", supported: true, ios: true, standalone: false, permission: null }), "install-required");
});

// --- Notifications natives : serveur -----------------------------------------------------------

test("jeton natif : validé, rangé dans la table des abonnements avec un préfixe reconnaissable", () => {
  assert.equal(nativePushTokenSchema.safeParse({ platform: "ios", token: APNS_TOKEN }).success, true);
  assert.equal(nativePushTokenSchema.safeParse({ platform: "android", token: FCM_TOKEN }).success, true);
  assert.equal(nativePushTokenSchema.safeParse({ platform: "web", token: APNS_TOKEN }).success, false);
  assert.equal(nativePushTokenSchema.safeParse({ platform: "ios", token: "court" }).success, false);
  assert.equal(nativePushTokenSchema.safeParse({ platform: "ios", token: `${APNS_TOKEN}/../x` }).success, false);
  const row = nativeSubscription({ platform: "android", token: FCM_TOKEN });
  assert.equal(row.endpoint, `native:android:${FCM_TOKEN}`);
  assert.deepEqual(parseNativeEndpoint(row.endpoint), { platform: "android", token: FCM_TOKEN });
  assert.equal(parseNativeEndpoint("https://fcm.googleapis.com/fcm/send/x"), null);
  assert.equal(nativeEndpoint({ platform: "ios", token: APNS_TOKEN }), `native:ios:${APNS_TOKEN}`);
});

function pem(type: "ec" | "rsa") {
  const pair = type === "ec"
    ? generateKeyPairSync("ec", { namedCurve: "P-256" })
    : generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { privateKey: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), publicKey: pair.publicKey };
}

test("clés : sans variables APNs ni FCM, envoi inactif ; avec, configuration lue (clé aux \\n échappés)", () => {
  assert.deepEqual(getNativePushConfig({}), { apns: null, fcm: null });
  const ec = pem("ec");
  const rsa = pem("rsa");
  const config = getNativePushConfig({
    APNS_KEY_ID: "KEY123", APNS_TEAM_ID: "TEAM123", APNS_PRIVATE_KEY: ec.privateKey.replace(/\n/g, "\\n"),
    FCM_PROJECT_ID: "annona", FCM_CLIENT_EMAIL: "push@annona.iam.gserviceaccount.com", FCM_PRIVATE_KEY: rsa.privateKey,
  });
  assert.equal(config.apns?.topic, MOBILE_APP_ID);
  assert.equal(config.apns?.production, true);
  assert.ok(config.apns?.privateKey.includes("\n-----END PRIVATE KEY-----"));
  assert.equal(config.fcm?.projectId, "annona");
  assert.equal(getNativePushConfig({ APNS_KEY_ID: "K", APNS_TEAM_ID: "T" }).apns, null, "clé manquante");
});

test("jetons d'authentification signés : ES256 (Apple) et RS256 (Google) vérifiables", () => {
  for (const [type, algorithm] of [["ec", "ES256"], ["rsa", "RS256"]] as const) {
    const key = pem(type);
    const jwt = signJwt({ kid: "K" }, { iss: "T", iat: 1 }, key.privateKey, algorithm);
    const [header, claims, signature] = jwt.split(".");
    assert.deepEqual(JSON.parse(Buffer.from(header!, "base64url").toString()), { kid: "K", alg: algorithm, typ: "JWT" });
    assert.deepEqual(JSON.parse(Buffer.from(claims!, "base64url").toString()), { iss: "T", iat: 1 });
    const ok = algorithm === "ES256"
      ? verify("sha256", Buffer.from(`${header}.${claims}`), { key: key.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature!, "base64url"))
      : verify("sha256", Buffer.from(`${header}.${claims}`), key.publicKey, Buffer.from(signature!, "base64url"));
    assert.equal(ok, true, algorithm);
  }
  const note = { title: "Livreur en approche", body: "Votre livraison arrive.", url: "/portal" };
  assert.deepEqual(apnsPayload(note), { aps: { alert: { title: note.title, body: note.body }, sound: "default" }, url: "/portal" });
  assert.deepEqual(fcmMessage("t", note).message.data, { url: "/portal" });
});

const MESSAGE: NotificationMessage = {
  type: "APPROACH",
  title: "Livreur en approche",
  body: "Votre livraison arrive.",
  href: "/portal",
  email: { subject: "s", text: "t" },
  senderName: null,
};
const RECIPIENT = { userId: "u1", companyId: "c1", email: null, emailCopy: false };
const CONTEXT = { eventKey: "k", replayWindow: null };
const APNS_ONLY: NativePushConfig = { apns: { keyId: "K", teamId: "T", privateKey: "x", topic: MOBILE_APP_ID, production: false }, fcm: null };

function fakeSubscriptions(rows: Array<{ id: string; endpoint: string }>) {
  const calls: { where?: unknown; deleted?: unknown } = {};
  const db = {
    driverPushSubscription: {
      findMany: async ({ where }: { where: unknown }) => {
        calls.where = where;
        return rows;
      },
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.deleted = where;
        return { count: 1 };
      },
    },
  };
  return { db: db as never, calls };
}

test("canal natif des notifications client : enregistré, inactif sans clés, sans lecture de la base", async () => {
  assert.ok(notificationChannels().some((channel) => channel.id === "native_push"), "ajouté par registerNotificationChannel");
  const channel = nativePushChannel({ config: () => ({ apns: null, fcm: null }), db: { driverPushSubscription: { findMany: async () => assert.fail("aucune lecture") } } as never });
  assert.equal(await channel.deliver(MESSAGE, RECIPIENT, CONTEXT), "disabled");
});

test("canal natif : envoi aux appareils du compte dans son entreprise ; jeton périmé retiré ; échec sans relance", async () => {
  const rows = [
    { id: "s1", endpoint: `native:ios:${APNS_TOKEN}` },
    { id: "s2", endpoint: `native:ios:${"c".repeat(64)}` },
    { id: "s3", endpoint: `native:android:${FCM_TOKEN}` }, // pas de clés FCM : ignoré
  ];
  const { db, calls } = fakeSubscriptions(rows);
  const sent: Array<{ token: string; url: string }> = [];
  const channel = nativePushChannel({
    config: () => APNS_ONLY,
    db,
    send: async (target, note) => {
      if (target.token.startsWith("c")) throw new NativePushError("APNS_410", true);
      sent.push({ token: target.token, url: note.url });
    },
  });
  assert.equal(await channel.deliver(MESSAGE, RECIPIENT, CONTEXT), "sent");
  assert.deepEqual(calls.where, { userId: "u1", companyId: "c1", endpoint: { startsWith: "native:" } });
  assert.deepEqual(sent, [{ token: APNS_TOKEN, url: "/portal" }]);
  assert.deepEqual(calls.deleted, { id: { in: ["s2"] } });

  const failing = nativePushChannel({ config: () => APNS_ONLY, db, send: async () => { throw new Error("réseau"); } });
  assert.equal(await failing.deliver(MESSAGE, RECIPIENT, CONTEXT), "off", "au mieux : jamais d'erreur (pas de double envoi des autres canaux)");
  const empty = nativePushChannel({ config: () => APNS_ONLY, db: fakeSubscriptions([]).db, send: async () => assert.fail() });
  assert.equal(await empty.deliver(MESSAGE, RECIPIENT, CONTEXT), "off");
  const result = await deliverToNativeDevices({ userId: "u1", companyId: "c1" }, { title: "t", body: "b", url: "/portal" }, { config: APNS_ONLY, db, send: async () => undefined });
  assert.deepEqual(result, { sent: 2, failed: 0, removed: 0, devices: 2 });
});

test("nouvelle tournée : application native du livreur servie par APNs/FCM, sans clés VAPID", async () => {
  const subscriptions = [
    { id: "w1", endpoint: "https://web.push.apple.com/w1", p256dh: "k", auth: "a" },
    { id: "n1", endpoint: `native:ios:${APNS_TOKEN}`, p256dh: "native", auth: "native" },
  ];
  const db = {
    round: { findFirst: async () => ({ id: "r1" }) },
    driverPushSubscription: { findMany: async () => subscriptions, deleteMany: async () => ({ count: 0 }) },
  } as never;
  const native: string[] = [];
  await deliverDriverMissionPush({ companyId: "c1", roundId: "r1", driverId: "u1" } as Prisma.JsonValue, {
    db,
    config: null,
    nativeConfig: APNS_ONLY,
    send: async () => assert.fail("pas de clés VAPID : pas de push web"),
    sendNative: async (target, note) => { native.push(`${target.platform}:${note.title}:${note.url}`); },
  });
  assert.deepEqual(native, [`ios:${NEW_MISSION_PUSH.title}:${NEW_MISSION_PUSH.url}`]);

  // Clés VAPID seules : la ligne native n'est jamais envoyée au service web.
  const web: string[] = [];
  await deliverDriverMissionPush({ companyId: "c1", roundId: "r1", driverId: "u1" } as Prisma.JsonValue, {
    db,
    config: { subject: "s", publicKey: "p", privateKey: "q" },
    nativeConfig: { apns: null, fcm: null },
    send: async (target) => { web.push(target.endpoint); },
    sendNative: async () => assert.fail(),
  });
  assert.deepEqual(web, ["https://web.push.apple.com/w1"]);
});

// --- Copie hors réseau des écrans livreur ------------------------------------------------------

test("service worker : seuls l'écran livreur, la lecture de la tournée et les fichiers statiques sont copiés", () => {
  const listeners: Record<string, unknown> = {};
  const self: Record<string, unknown> = {
    location: { origin: "https://app.annona.fr" },
    addEventListener: (name: string, fn: unknown) => { listeners[name] = fn; },
  };
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL, caches: {}, fetch, setTimeout, Request });
  const kind = self.annonaCacheKind as (url: URL, request: { method: string; mode?: string; headers: Headers }) => string | null;
  const get = (mode = "cors", headers: Record<string, string> = {}) => ({ method: "GET", mode, headers: new Headers(headers) });
  const at = (path: string) => new URL(path, "https://app.annona.fr");
  assert.equal(kind(at("/driver"), get("navigate")), "page");
  assert.equal(kind(at("/driver/missions"), get("navigate")), "page");
  assert.equal(kind(at("/portal"), get("navigate")), null, "portail : jamais copié");
  assert.equal(kind(at("/admin"), get("navigate")), null);
  assert.equal(kind(at("/api/driver/rounds"), get()), "data");
  assert.equal(kind(at("/api/driver/rounds"), { ...get(), method: "POST" }), null, "envois : jamais copiés");
  assert.equal(kind(at("/api/driver/stops/s1/delivered"), get()), null);
  assert.equal(kind(at("/api/portal/orders"), get()), null);
  assert.equal(kind(at("/_next/static/chunks/app.js"), get()), "static");
  assert.equal(kind(at("/driver?_rsc=abc"), get()), null, "navigation interne (RSC) : réseau seul");
  assert.equal(kind(new URL("https://tile.openstreetmap.org/1/1/1.png"), get()), null, "autre origine");
  for (const event of ["install", "activate", "fetch", "message", "push", "notificationclick"]) assert.equal(typeof listeners[event], "function", event);

  assert.deepEqual(
    driverOfflineUrls({
      origin: "https://app.annona.fr",
      pathname: "/driver",
      resources: ["https://app.annona.fr/_next/static/chunks/a.js", "https://tile.openstreetmap.org/x.png", "https://app.annona.fr/api/driver/rounds", "::"],
    }),
    ["/driver", "/api/driver/rounds", "/_next/static/chunks/a.js"]
  );
  assert.deepEqual(driverOfflineUrls({ origin: "https://a.fr", pathname: "/portal", resources: [] }), ["/api/driver/rounds"]);
});

// --- Projets natifs (contrôle statique des fichiers, pas un essai sur téléphone) -------------------

test("projets natifs : textes d'usage en français, position au premier plan seulement (ENF-04)", () => {
  const plist = readFileSync("ios/App/App/Info.plist", "utf8");
  for (const key of ["NSCameraUsageDescription", "NSLocationWhenInUseUsageDescription", "NSPhotoLibraryUsageDescription"]) assert.ok(plist.includes(`<key>${key}</key>`), key);
  assert.match(plist, /seulement pendant votre tournée/);
  assert.doesNotMatch(plist, /NSLocationAlways/, "aucune position en arrière-plan");
  assert.match(plist, /remote-notification/);
  const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  assert.match(manifest, /ACCESS_FINE_LOCATION/);
  assert.match(manifest, /POST_NOTIFICATIONS/);
  assert.doesNotMatch(manifest, /ACCESS_BACKGROUND_LOCATION/);
  const appDelegate = readFileSync("ios/App/App/AppDelegate.swift", "utf8");
  assert.match(appDelegate, /capacitorDidRegisterForRemoteNotifications/);
});
