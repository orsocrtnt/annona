/**
 * MOBILE-1, ENF-01 — notifications natives des applications iOS (APNs) et Android (FCM).
 *
 * Stockage : la table existante `driver_push_subscriptions` (sans migration). Un jeton natif y est
 * rangé avec `endpoint = "native:<ios|android>:<jeton>"` et des clés `p256dh`/`auth` à « native » :
 * le jeton change de compte si l'appareil est repris par un autre utilisateur (clé unique), et
 * l'envoi web (`web-push`) ignore ces lignes. Commerçants et livreurs y sont rangés de la même façon.
 *
 * Envoi : inactif sans clés (comme l'e-mail sans Resend). Avec `APNS_*` (clé .p8 d'Apple) ou `FCM_*`
 * (compte de service Firebase), le message part directement chez Apple ou Google ; seuls le titre,
 * le texte et la page à ouvrir sont transmis.
 */
import { createPrivateKey, sign } from "node:crypto";
import { MOBILE_APP_ID } from "@/lib/native/app-config";
import type { NativePushPlatform, NativePushTokenInput } from "@/lib/validations/native-push";
import { prisma } from "@/services/prisma/client";

export const NATIVE_ENDPOINT_PREFIX = "native:";
const NATIVE_KEYS = { p256dh: "native", auth: "native" } as const;
const SEND_TIMEOUT_MS = 10_000;

export interface NativePushTarget {
  platform: NativePushPlatform;
  token: string;
}

export interface NativePushNotification {
  title: string;
  body: string;
  /** Page de l'application ouverte au toucher (`/portal…` ou `/driver…`). */
  url: string;
}

export interface ApnsConfig {
  keyId: string;
  teamId: string;
  privateKey: string;
  topic: string;
  production: boolean;
}

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export interface NativePushConfig {
  apns: ApnsConfig | null;
  fcm: FcmConfig | null;
}

export function nativeEndpoint(target: NativePushTarget): string {
  return `${NATIVE_ENDPOINT_PREFIX}${target.platform}:${target.token}`;
}

export function isNativeEndpoint(endpoint: string): boolean {
  return endpoint.startsWith(NATIVE_ENDPOINT_PREFIX);
}

export function parseNativeEndpoint(endpoint: string): NativePushTarget | null {
  const match = /^native:(ios|android):([A-Za-z0-9:_-]+)$/.exec(endpoint);
  if (!match) return null;
  return { platform: match[1] as NativePushPlatform, token: match[2]! };
}

/** Les clés privées collées dans une variable d'environnement gardent souvent leurs `\n` échappés. */
function readPem(value: string | undefined): string | null {
  const pem = value?.trim().replace(/\\n/g, "\n");
  return pem && pem.includes("PRIVATE KEY") ? pem : null;
}

export function getNativePushConfig(env: Record<string, string | undefined> = process.env): NativePushConfig {
  const apnsKey = readPem(env.APNS_PRIVATE_KEY);
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  const fcmKey = readPem(env.FCM_PRIVATE_KEY);
  const projectId = env.FCM_PROJECT_ID?.trim();
  const clientEmail = env.FCM_CLIENT_EMAIL?.trim();
  return {
    apns: apnsKey && keyId && teamId
      ? {
          keyId,
          teamId,
          privateKey: apnsKey,
          topic: env.APNS_TOPIC?.trim() || MOBILE_APP_ID,
          // Applications de TestFlight et de l'App Store : production ; installées depuis Xcode : development.
          production: (env.APNS_ENVIRONMENT?.trim() || "production") !== "development",
        }
      : null,
    fcm: fcmKey && projectId && clientEmail ? { projectId, clientEmail, privateKey: fcmKey } : null,
  };
}

export function nativePushConfigured(config: NativePushConfig): boolean {
  return config.apns !== null || config.fcm !== null;
}

export function canSendTo(target: NativePushTarget, config: NativePushConfig): boolean {
  return target.platform === "ios" ? config.apns !== null : config.fcm !== null;
}

// --- Enregistrement des jetons ---------------------------------------------------------------

/** Ligne d'abonnement d'un appareil natif, enregistrée par `saveDriverPushSubscription` (même limite par compte). */
export function nativeSubscription(input: NativePushTokenInput) {
  return { endpoint: nativeEndpoint(input), keys: { ...NATIVE_KEYS } };
}

export async function removeNativePushToken(
  userId: string,
  input: NativePushTokenInput,
  db: Pick<typeof prisma, "driverPushSubscription"> = prisma
) {
  await db.driverPushSubscription.deleteMany({ where: { userId, endpoint: nativeEndpoint(input) } });
}

// --- Envoi (APNs, FCM) ------------------------------------------------------------------------

export class NativePushError extends Error {
  constructor(message: string, readonly gone = false) {
    super(message);
    this.name = "NativePushError";
  }
}

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

/** Jeton signé (JWT) : ES256 pour Apple, RS256 pour Google. */
export function signJwt(
  header: Record<string, string>,
  claims: Record<string, string | number>,
  privateKeyPem: string,
  algorithm: "ES256" | "RS256"
): string {
  const unsigned = `${base64url(JSON.stringify({ ...header, alg: algorithm, typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const key = createPrivateKey(privateKeyPem);
  const signature = algorithm === "ES256"
    ? sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" })
    : sign("sha256", Buffer.from(unsigned), key);
  return `${unsigned}.${base64url(signature)}`;
}

const tokenCache = new Map<string, { value: string; until: number }>();

function cached(key: string, ttlMs: number, now: number, create: () => string): string {
  const hit = tokenCache.get(key);
  if (hit && hit.until > now) return hit.value;
  const value = create();
  tokenCache.set(key, { value, until: now + ttlMs });
  return value;
}

/** Corps APNs : alerte visible, son par défaut, page à ouvrir dans `url`. */
export function apnsPayload(notification: NativePushNotification) {
  return { aps: { alert: { title: notification.title, body: notification.body }, sound: "default" }, url: notification.url };
}

/** Message FCM v1 : notification visible et page à ouvrir dans `data.url`. */
export function fcmMessage(token: string, notification: NativePushNotification) {
  return {
    message: {
      token,
      notification: { title: notification.title, body: notification.body },
      data: { url: notification.url },
      android: { priority: "high" },
    },
  };
}

async function sendApns(token: string, notification: NativePushNotification, config: ApnsConfig) {
  // Apple accepte un même jeton d'authentification pendant une heure : renouvelé toutes les 50 min.
  const now = Date.now();
  const jwt = cached(`apns:${config.teamId}:${config.keyId}`, 50 * 60_000, now, () =>
    signJwt({ kid: config.keyId }, { iss: config.teamId, iat: Math.floor(now / 1000) }, config.privateKey, "ES256"));
  const { connect } = await import("node:http2");
  const origin = config.production ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com";
  const body = JSON.stringify(apnsPayload(notification));
  await new Promise<void>((resolve, reject) => {
    const session = connect(origin);
    const fail = (error: unknown) => {
      session.close();
      reject(error instanceof Error ? error : new NativePushError("APNS_SEND_FAILED"));
    };
    session.on("error", fail);
    const request = session.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": config.topic,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    request.setTimeout(SEND_TIMEOUT_MS, () => {
      request.close();
      fail(new NativePushError("APNS_TIMEOUT"));
    });
    let status = 0;
    let response = "";
    request.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      response += chunk;
    });
    request.on("end", () => {
      session.close();
      if (status === 200) return resolve();
      const reason = (() => {
        try {
          return String((JSON.parse(response) as { reason?: unknown }).reason ?? "");
        } catch {
          return "";
        }
      })();
      // 410 : appli désinstallée ; jeton illisible ou d'un autre environnement : à oublier.
      const gone = status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic";
      reject(new NativePushError(`APNS_${status}${reason ? `_${reason}` : ""}`, gone));
    });
    request.on("error", fail);
    request.end(body);
  });
}

async function fcmAccessToken(config: FcmConfig, fetchImpl: typeof fetch): Promise<string> {
  const key = `fcm:${config.clientEmail}`;
  const hit = tokenCache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const iat = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {},
    {
      iss: config.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    },
    config.privateKey,
    "RS256"
  );
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) throw new NativePushError(`FCM_AUTH_${response.status}`);
  const data = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string") throw new NativePushError("FCM_AUTH_INVALID");
  const ttl = typeof data.expires_in === "number" ? data.expires_in : 3600;
  tokenCache.set(key, { value: data.access_token, until: Date.now() + Math.max(60, ttl - 300) * 1000 });
  return data.access_token;
}

async function sendFcm(token: string, notification: NativePushNotification, config: FcmConfig, fetchImpl: typeof fetch) {
  const accessToken = await fcmAccessToken(config, fetchImpl);
  const response = await fetchImpl(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(fcmMessage(token, notification)),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  // 404 UNREGISTERED : appli désinstallée ou jeton remplacé.
  const gone = response.status === 404 || text.includes("UNREGISTERED");
  throw new NativePushError(`FCM_${response.status}`, gone);
}

export type NativePushSender = (target: NativePushTarget, notification: NativePushNotification, config: NativePushConfig) => Promise<void>;

export const sendNativePush: NativePushSender = async (target, notification, config) => {
  if (target.platform === "ios") {
    if (!config.apns) throw new NativePushError("APNS_NOT_CONFIGURED");
    await sendApns(target.token, notification, config.apns);
    return;
  }
  if (!config.fcm) throw new NativePushError("FCM_NOT_CONFIGURED");
  await sendFcm(target.token, notification, config.fcm, fetch);
};

export function isGoneNativeToken(error: unknown): boolean {
  return error instanceof NativePushError && error.gone;
}

/**
 * Envoie à chaque appareil natif d'un compte ; les jetons refusés définitivement sont oubliés.
 * Renvoie le nombre d'envois réussis et d'appareils retirés.
 */
export async function deliverToNativeDevices(
  recipient: { userId: string; companyId: string },
  notification: NativePushNotification,
  deps: {
    db?: Pick<typeof prisma, "driverPushSubscription">;
    config?: NativePushConfig;
    send?: NativePushSender;
  } = {}
): Promise<{ sent: number; failed: number; removed: number; devices: number }> {
  const config = deps.config ?? getNativePushConfig();
  const db = deps.db ?? prisma;
  const send = deps.send ?? sendNativePush;
  const rows = await db.driverPushSubscription.findMany({
    where: { userId: recipient.userId, companyId: recipient.companyId, endpoint: { startsWith: NATIVE_ENDPOINT_PREFIX } },
    select: { id: true, endpoint: true },
  });
  const targets = rows
    .map((row) => ({ id: row.id, target: parseNativeEndpoint(row.endpoint) }))
    .filter((row): row is { id: string; target: NativePushTarget } => row.target !== null && canSendTo(row.target, config));
  const results = await Promise.allSettled(targets.map((row) => send(row.target, notification, config)));
  const gone = targets.filter((_, index) => {
    const result = results[index]!;
    return result.status === "rejected" && isGoneNativeToken(result.reason);
  });
  if (gone.length > 0) {
    await db.driverPushSubscription.deleteMany({ where: { id: { in: gone.map((row) => row.id) } } });
  }
  const sent = results.filter((result) => result.status === "fulfilled").length;
  return { sent, failed: results.length - sent - gone.length, removed: gone.length, devices: targets.length };
}
