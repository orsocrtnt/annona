import type { Prisma } from "@prisma/client";
import {
  canSendTo,
  getNativePushConfig,
  isGoneNativeToken,
  isNativeEndpoint,
  nativePushConfigured,
  parseNativeEndpoint,
  sendNativePush,
  type NativePushConfig,
  type NativePushSender,
  type NativePushTarget,
} from "@/domains/notification/native-push.service";
import { permanentJobError, skippedJobError } from "@/domains/operations/operation-job.service";
import { prisma } from "@/services/prisma/client";

const MAX_SUBSCRIPTIONS_PER_DRIVER = 5;
const PUSH_TTL_SECONDS = 60 * 60;
const PUSH_TIMEOUT_MS = 10_000;

/** Texte générique : le service de notification du fabricant ne reçoit aucune donnée de tournée. */
export const NEW_MISSION_PUSH = {
  title: "Nouvelle tournée",
  body: "Une tournée vous a été attribuée. Ouvrez Annona pour la voir.",
  url: "/driver",
  tag: "nouvelle-tournee",
} as const;

type PushTarget = { endpoint: string; p256dh: string; auth: string };
type PushConfig = { subject: string; publicKey: string; privateKey: string };
type PushSender = (target: PushTarget, payload: string, config: PushConfig) => Promise<void>;

export function getDriverPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || "https://annona.fr" };
}

const sendWebPush: PushSender = async (target, payload, config) => {
  const { default: webPush } = await import("web-push");
  await webPush.sendNotification(
    { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
    payload,
    {
      vapidDetails: config,
      TTL: PUSH_TTL_SECONDS,
      urgency: "high",
      timeout: PUSH_TIMEOUT_MS,
    }
  );
};

export async function saveDriverPushSubscription(
  user: { id: string; companyId: string },
  input: { endpoint: string; keys: { p256dh: string; auth: string } },
  db: Pick<typeof prisma, "driverPushSubscription"> = prisma
) {
  // Même navigateur repris par un autre livreur : l'abonnement change de compte, il n'est jamais partagé.
  const data = { userId: user.id, companyId: user.companyId, p256dh: input.keys.p256dh, auth: input.keys.auth };
  await db.driverPushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: data,
    create: { ...data, endpoint: input.endpoint },
  });
  const extra = await db.driverPushSubscription.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    skip: MAX_SUBSCRIPTIONS_PER_DRIVER,
    select: { id: true },
  });
  if (extra.length > 0) {
    await db.driverPushSubscription.deleteMany({ where: { id: { in: extra.map((row) => row.id) } } });
  }
}

export async function removeDriverPushSubscription(
  userId: string,
  endpoint: string,
  db: Pick<typeof prisma, "driverPushSubscription"> = prisma
) {
  await db.driverPushSubscription.deleteMany({ where: { userId, endpoint } });
}

function readPayload(payload: Prisma.JsonValue) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return null;
  const { companyId, roundId, driverId } = payload;
  if (typeof companyId !== "string" || typeof roundId !== "string" || typeof driverId !== "string") return null;
  return { companyId, roundId, driverId };
}

function isGoneSubscription(error: unknown) {
  const status = error && typeof error === "object" ? (error as { statusCode?: unknown }).statusCode : null;
  return status === 404 || status === 410;
}

export async function deliverDriverMissionPush(
  payload: Prisma.JsonValue,
  deps: {
    db?: Pick<typeof prisma, "round" | "driverPushSubscription">;
    send?: PushSender;
    config?: PushConfig | null;
    /** MOBILE-1 : clés APNs / FCM des applications natives (lues dans l'environnement par défaut). */
    nativeConfig?: NativePushConfig;
    sendNative?: NativePushSender;
  } = {}
) {
  const input = readPayload(payload);
  if (!input) throw permanentJobError("DRIVER_PUSH_PAYLOAD_INVALID");
  const config = deps.config === undefined ? getDriverPushConfig() : deps.config;
  const nativeConfig = deps.nativeConfig ?? getNativePushConfig();
  if (!config && !nativePushConfigured(nativeConfig)) throw skippedJobError("DRIVER_PUSH_NOT_CONFIGURED");
  const db = deps.db ?? prisma;
  const send = deps.send ?? sendWebPush;
  const sendNative = deps.sendNative ?? sendNativePush;

  // Relu à l'envoi : une tournée retirée ou réattribuée entre-temps ne sonne plus chez ce livreur.
  const round = await db.round.findFirst({
    where: {
      id: input.roundId,
      companyId: input.companyId,
      driverId: input.driverId,
      status: "ASSIGNED",
      driver: { status: "ACTIVE", companyId: input.companyId },
    },
    select: { id: true },
  });
  if (!round) throw skippedJobError("DRIVER_PUSH_MISSION_OBSOLETE");

  const subscriptions = await db.driverPushSubscription.findMany({
    where: { userId: input.driverId, companyId: input.companyId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  // Navigateur (web push, clés VAPID) ou application native (APNs / FCM) : chacun seulement si configuré.
  type Target = { subscription: (typeof subscriptions)[number]; native: NativePushTarget | null };
  const targets = subscriptions.flatMap((subscription): Target[] => {
    if (!isNativeEndpoint(subscription.endpoint)) return config ? [{ subscription, native: null }] : [];
    const native = parseNativeEndpoint(subscription.endpoint);
    return native && canSendTo(native, nativeConfig) ? [{ subscription, native }] : [];
  });
  if (targets.length === 0) throw skippedJobError("DRIVER_PUSH_NO_SUBSCRIPTION");

  const body = JSON.stringify(NEW_MISSION_PUSH);
  const results = await Promise.allSettled(
    targets.map(({ subscription, native }) =>
      native
        ? sendNative(native, { title: NEW_MISSION_PUSH.title, body: NEW_MISSION_PUSH.body, url: NEW_MISSION_PUSH.url }, nativeConfig)
        : send(subscription, body, config!)
    )
  );
  const gone = targets.filter(({ native }, index) => {
    const result = results[index]!;
    if (result.status !== "rejected") return false;
    return native ? isGoneNativeToken(result.reason) : isGoneSubscription(result.reason);
  });
  if (gone.length > 0) {
    await db.driverPushSubscription.deleteMany({ where: { id: { in: gone.map(({ subscription }) => subscription.id) } } });
  }
  const delivered = results.some((result) => result.status === "fulfilled");
  if (!delivered && gone.length < targets.length) throw new Error("DRIVER_PUSH_SEND_FAILED");
  if (!delivered) throw skippedJobError("DRIVER_PUSH_NO_SUBSCRIPTION");
}
