import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  deliverDriverMissionPush,
  NEW_MISSION_PUSH,
  saveDriverPushSubscription,
} from "../src/domains/driver/driver-push.service";
import { getDriverPushAvailability, vapidKeyToBytes } from "../src/features/driver/driver-push";
import { driverPushSubscriptionSchema, isAllowedPushEndpoint } from "../src/lib/validations/driver-push";

const CONFIG = { subject: "https://tutelliv.fr", publicKey: "pub", privateKey: "priv" };
const PAYLOAD = { kind: "NEW_MISSION", companyId: "c1", deliveryId: "d1", driverId: "u1" };
const target = (id: string) => ({ id, endpoint: `https://web.push.apple.com/${id}`, p256dh: "k", auth: "a" });

type Where = Record<string, unknown>;
function fakeDb(options: { mission?: boolean; targets?: ReturnType<typeof target>[] }) {
  const calls: { missionWhere?: Where; targetWhere?: Where; deleted?: unknown } = {};
  const db = {
    delivery: {
      findFirst: async ({ where }: { where: Where }) => {
        calls.missionWhere = where;
        return options.mission === false ? null : { id: "d1" };
      },
    },
    driverPushSubscription: {
      findMany: async ({ where }: { where: Where }) => {
        calls.targetWhere = where;
        return options.targets ?? [];
      },
      deleteMany: async ({ where }: { where: unknown }) => {
        calls.deleted = where;
        return { count: 1 };
      },
    },
  };
  return { db: db as unknown as NonNullable<Parameters<typeof deliverDriverMissionPush>[1]>["db"], calls };
}
const failure = (statusCode: number) => Object.assign(new Error("push"), { statusCode });

test("seuls les services de notification connus sont acceptés", () => {
  for (const ok of [
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://web.push.apple.com/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ]) assert.ok(isAllowedPushEndpoint(ok), ok);
  for (const refused of [
    "http://web.push.apple.com/abc",
    "https://169.254.169.254/latest",
    "https://localhost/abc",
    "https://push.apple.com.attaquant.example/abc",
    "https://web.push.apple.com:8443/abc",
    "https://user:pw@web.push.apple.com/abc",
    "pas une url",
  ]) assert.equal(isAllowedPushEndpoint(refused), false, refused);
  assert.equal(driverPushSubscriptionSchema.safeParse({ endpoint: "https://web.push.apple.com/a", keys: { p256dh: "a b", auth: "c" } }).success, false);
});

test("le message envoyé ne contient aucune donnée de mission ni d'identifiant", async () => {
  const { db, calls } = fakeDb({ targets: [target("s1")] });
  const sent: string[] = [];
  await deliverDriverMissionPush(PAYLOAD, { db, config: CONFIG, send: async (_t, body) => { sent.push(body); } });
  assert.deepEqual(JSON.parse(sent[0]!), NEW_MISSION_PUSH);
  for (const secret of ["d1", "u1", "c1"]) assert.ok(!sent[0]!.includes(`"${secret}"`));
  assert.deepEqual(calls.targetWhere, { userId: "u1", companyId: "c1" }, "abonnements du seul livreur, dans son entreprise");
  assert.deepEqual(calls.missionWhere, {
    id: "d1", companyId: "c1", driverId: "u1", status: "ASSIGNED",
    driver: { status: "ACTIVE", companyId: "c1" },
  });
});

test("sans clés, sans abonnement ou mission réaffectée : la tâche est close sans envoi ni erreur", async () => {
  const cases: Array<[string, Parameters<typeof fakeDb>[0], typeof CONFIG | null]> = [
    ["DRIVER_PUSH_NOT_CONFIGURED", { targets: [target("s1")] }, null],
    ["DRIVER_PUSH_MISSION_OBSOLETE", { mission: false, targets: [target("s1")] }, CONFIG],
    ["DRIVER_PUSH_NO_SUBSCRIPTION", { targets: [] }, CONFIG],
  ];
  for (const [code, options, config] of cases) {
    const { db } = fakeDb(options);
    await assert.rejects(
      deliverDriverMissionPush(PAYLOAD, { db, config, send: async () => assert.fail("aucun envoi attendu") }),
      (error: Error & { skipped?: boolean }) => error.message === code && error.skipped === true
    );
  }
});

test("charge illisible : échec définitif, sans nouvel essai", async () => {
  const { db } = fakeDb({});
  await assert.rejects(
    deliverDriverMissionPush({ companyId: "c1" } as Prisma.JsonValue, { db, config: CONFIG, send: async () => undefined }),
    (error: Error & { permanent?: boolean }) => error.message === "DRIVER_PUSH_PAYLOAD_INVALID" && error.permanent === true
  );
});

test("un abonnement expiré est supprimé, sans bloquer les autres appareils", async () => {
  const { db, calls } = fakeDb({ targets: [target("vieux"), target("bon")] });
  await deliverDriverMissionPush(PAYLOAD, {
    db, config: CONFIG,
    send: async (t) => { if (t.endpoint.endsWith("vieux")) throw failure(410); },
  });
  assert.deepEqual(calls.deleted, { id: { in: ["vieux"] } });
});

test("panne du service : la tâche repart en essai ; tous expirés : close sans erreur", async () => {
  const panne = fakeDb({ targets: [target("s1")] });
  await assert.rejects(
    deliverDriverMissionPush(PAYLOAD, { db: panne.db, config: CONFIG, send: async () => { throw failure(503); } }),
    (error: Error & { skipped?: boolean; permanent?: boolean }) =>
      error.message === "DRIVER_PUSH_SEND_FAILED" && !error.skipped && !error.permanent
  );
  assert.equal(panne.calls.deleted, undefined, "abonnement conservé pendant une panne");
  const expire = fakeDb({ targets: [target("s1")] });
  await assert.rejects(
    deliverDriverMissionPush(PAYLOAD, { db: expire.db, config: CONFIG, send: async () => { throw failure(404); } }),
    (error: Error & { skipped?: boolean }) => error.skipped === true
  );
});

test("un navigateur repris par un autre livreur change de compte et le nombre d'appareils est borné", async () => {
  const calls: { upsert?: { update: Where; create: Where }; deleted?: unknown; skip?: number } = {};
  const db = {
    driverPushSubscription: {
      upsert: async (args: { update: Where; create: Where }) => { calls.upsert = args; },
      findMany: async ({ skip }: { skip: number }) => { calls.skip = skip; return [{ id: "ancien" }]; },
      deleteMany: async ({ where }: { where: unknown }) => { calls.deleted = where; },
    },
  } as unknown as Parameters<typeof saveDriverPushSubscription>[2];
  await saveDriverPushSubscription(
    { id: "u2", companyId: "c2" },
    { endpoint: "https://web.push.apple.com/a", keys: { p256dh: "k", auth: "a" } },
    db
  );
  assert.equal(calls.upsert!.update.userId, "u2");
  assert.equal(calls.upsert!.update.companyId, "c2");
  assert.equal(calls.skip, 5);
  assert.deepEqual(calls.deleted, { id: { in: ["ancien"] } });
});

test("disponibilité : iPhone hors écran d'accueil, refus et clé absente", () => {
  const base = { publicKey: "k", supported: true, ios: false, standalone: false, permission: "default" };
  assert.equal(getDriverPushAvailability(base), "ready");
  assert.equal(getDriverPushAvailability({ ...base, ios: true, supported: false }), "install-required");
  assert.equal(getDriverPushAvailability({ ...base, ios: true, standalone: true }), "ready");
  assert.equal(getDriverPushAvailability({ ...base, permission: "denied" }), "denied");
  assert.equal(getDriverPushAvailability({ ...base, publicKey: undefined }), "unavailable");
  assert.equal(getDriverPushAvailability({ ...base, supported: false }), "unavailable");
});

test("la clé publique base64url est décodée en 65 octets", () => {
  const key = Buffer.alloc(65, 7).toString("base64url");
  assert.equal(vapidKeyToBytes(key).length, 65);
});

test("le service worker ne garde que les pages livreur et n'intercepte pas le réseau", () => {
  const source = readFileSync("public/sw.js", "utf8");
  assert.ok(!source.includes('"fetch"'));
  assert.match(source, /startsWith\("\/driver"\)/);
  const manifest = JSON.parse(readFileSync("public/driver.webmanifest", "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/driver");
  assert.equal(manifest.theme_color, undefined, "une couleur fixe garderait la barre du haut blanche en mode sombre");
});

test("l'affectation inscrit la notification dans la transaction, sauf prise par le livreur lui-même", () => {
  const source = readFileSync("src/domains/delivery/delivery.service.ts", "utf8");
  assert.match(source, /options\?\.selfClaimed\s*\? null\s*: await enqueueOperationJob\(tx,/);
  assert.match(source, /jobKey: `driver-push:mission:\$\{deliveryId\}:\$\{trackingEvent\.id\}`/);
  assert.match(source, /Libre affectation par le livreur[^}]+selfClaimed: true/);
});
