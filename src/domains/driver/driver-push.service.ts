import type { Prisma } from "@prisma/client";
import { permanentJobError, skippedJobError } from "@/domains/operations/operation-job.service";
import { prisma } from "@/services/prisma/client";

const MAX_SUBSCRIPTIONS_PER_DRIVER = 5;
const PUSH_TTL_SECONDS = 60 * 60;
const PUSH_TIMEOUT_MS = 10_000;

/** Texte générique : le service de notification du fabricant ne reçoit aucune donnée de mission. */
export const NEW_MISSION_PUSH = {
  title: "Nouvelle mission",
  body: "Une mission vous a été confiée. Ouvrez TutelLiv pour la voir.",
  url: "/driver/missions",
  tag: "nouvelle-mission",
} as const;

type PushTarget = { endpoint: string; p256dh: string; auth: string };
type PushConfig = { subject: string; publicKey: string; privateKey: string };
type PushSender = (target: PushTarget, payload: string, config: PushConfig) => Promise<void>;

export function getDriverPushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || "https://tutelliv.fr" };
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
  const { companyId, deliveryId, driverId } = payload;
  if (typeof companyId !== "string" || typeof deliveryId !== "string" || typeof driverId !== "string") return null;
  return { companyId, deliveryId, driverId };
}

function isGoneSubscription(error: unknown) {
  const status = error && typeof error === "object" ? (error as { statusCode?: unknown }).statusCode : null;
  return status === 404 || status === 410;
}

export async function deliverDriverMissionPush(
  payload: Prisma.JsonValue,
  deps: {
    db?: Pick<typeof prisma, "delivery" | "driverPushSubscription">;
    send?: PushSender;
    config?: PushConfig | null;
  } = {}
) {
  const input = readPayload(payload);
  if (!input) throw permanentJobError("DRIVER_PUSH_PAYLOAD_INVALID");
  const config = deps.config === undefined ? getDriverPushConfig() : deps.config;
  if (!config) throw skippedJobError("DRIVER_PUSH_NOT_CONFIGURED");
  const db = deps.db ?? prisma;
  const send = deps.send ?? sendWebPush;

  // Relu à l'envoi : une mission retirée ou réaffectée entre-temps ne sonne plus chez ce livreur.
  const mission = await db.delivery.findFirst({
    where: {
      id: input.deliveryId,
      companyId: input.companyId,
      driverId: input.driverId,
      status: "ASSIGNED",
      driver: { status: "ACTIVE", companyId: input.companyId },
    },
    select: { id: true },
  });
  if (!mission) throw skippedJobError("DRIVER_PUSH_MISSION_OBSOLETE");

  const targets = await db.driverPushSubscription.findMany({
    where: { userId: input.driverId, companyId: input.companyId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  if (targets.length === 0) throw skippedJobError("DRIVER_PUSH_NO_SUBSCRIPTION");

  const body = JSON.stringify(NEW_MISSION_PUSH);
  const results = await Promise.allSettled(targets.map((target) => send(target, body, config)));
  const gone = targets.filter((_, index) => {
    const result = results[index]!;
    return result.status === "rejected" && isGoneSubscription(result.reason);
  });
  if (gone.length > 0) {
    await db.driverPushSubscription.deleteMany({ where: { id: { in: gone.map((target) => target.id) } } });
  }
  const delivered = results.some((result) => result.status === "fulfilled");
  if (!delivered && gone.length < targets.length) throw new Error("DRIVER_PUSH_SEND_FAILED");
  if (!delivered) throw skippedJobError("DRIVER_PUSH_NO_SUBSCRIPTION");
}
