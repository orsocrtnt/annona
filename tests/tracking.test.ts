import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { updateDriverDeliveryStatusSchema } from "../src/lib/validations/delivery";
import { syncTrackingDetail } from "../src/lib/tracking/cache";
import * as policy from "../src/domains/tracking/tracking.policy";
import { DEFAULT_DRIVER_LOCATION_SETTINGS, driverLocationSettingsSchema } from "../src/lib/validations/driver-location-settings";
const now = new Date("2026-10-12T12:00:00Z");
const mission = { status: "IN_DELIVERY", missionStartedAt: new Date(+now - 60000), completedAt: null as Date | null };
const driver = { status: "ACTIVE", settings: { trackingService: { active: true, startedAt: new Date(+now - 120000).toISOString() } }, driverLocation: { latitude: 45, longitude: 3, accuracy: 8, updatedAt: new Date(+now - 10000) } };
test("TRACK-1 : service explicite, valeurs absentes ou malformées fermées", () => {
  for (const settings of [null, {}, { trackingService: { active: true } }, { trackingService: { active: "true", startedAt: now.toISOString() } }]) assert.equal(policy.trackingService(settings).active, false);
  assert.equal(policy.trackingService(driver.settings).active, true);
});
test("TRACK-1 : position fraîche datée, précision conservée ; périmée sans cible, dernière position connue gardée", () => {
  const fresh = policy.trackingPosition(mission, driver, 45, now); assert.equal(fresh.state, "FRESH"); assert.equal(fresh.estimated, false);
  const expired = policy.trackingPosition(mission, driver, 10, now); assert.equal(expired.state, "STALE"); assert.equal(expired.latitude, 45); assert.equal(expired.longitude, 3); assert.equal(expired.estimated, false); assert.equal(expired.updatedAt, driver.driverLocation.updatedAt.toISOString());
});
// 0,1° de latitude ≈ 11,12 km : à 25 km/h, environ 26 min 41 s pour la parcourir (mi-chemin vers 800 s).
const from = { latitude: 48.8, longitude: 2.35 }, target = { latitude: 48.9, longitude: 2.35 };
test("TRACK-2 : estimation en ligne droite à 25 km/h, plafonnée à la cible", () => {
  const halfway = policy.estimatePosition(from, target, 800.6); assert.ok(Math.abs(halfway.latitude - 48.85) < 0.0005, String(halfway.latitude)); assert.equal(halfway.longitude, 2.35);
  assert.deepEqual({ ...policy.estimatePosition(from, target, 3600) }, { ...target });
  assert.deepEqual({ ...policy.estimatePosition(from, target, 0) }, { ...from });
  assert.deepEqual({ ...policy.estimatePosition(from, from, 120) }, { ...from });
});
test("TRACK-2 : signal périmé, estimation pendant 3 min puis arrêt au point atteint", () => {
  const lost = (seconds: number) => ({ ...driver, driverLocation: { ...from, accuracy: 8, updatedAt: new Date(+now - seconds * 1000) } });
  const startedEarlier = { ...mission, missionStartedAt: new Date(+now - 3600_000) };
  const longService = { trackingService: { active: true, startedAt: new Date(+now - 3600_000).toISOString() } };
  const at = (seconds: number, t: typeof target | null = target) => policy.trackingPosition(startedEarlier, { ...lost(seconds), settings: longService }, 45, now, t);
  const estimated = at(120); assert.equal(estimated.state, "STALE"); assert.equal(estimated.estimated, true); assert.ok(estimated.latitude! > from.latitude && estimated.latitude! < target.latitude); assert.equal(estimated.accuracy, null); assert.equal(estimated.updatedAt, lost(120).driverLocation.updatedAt.toISOString());
  const limit = at(180); assert.equal(limit.estimated, true);
  const stopped = at(181), later = at(3600);
  assert.equal(stopped.estimated, false); assert.equal(later.estimated, false);
  assert.equal(stopped.latitude, limit.latitude, "arrêt au point estimé atteint, sans retour en arrière"); assert.equal(later.latitude, limit.latitude);
  assert.ok(stopped.latitude! > from.latitude);
  const noTarget = at(120, null); assert.equal(noTarget.estimated, false); assert.equal(noTarget.latitude, from.latitude); assert.equal(noTarget.motion, null);
  assert.equal(policy.trackingPosition(startedEarlier, { ...lost(10), settings: longService }, 45, now, target).estimated, false, "signal frais : jamais d'estimation");
});
test("TRACK-2 : trajectoire exposée pour avancer entre deux signaux, depuis le dernier relevé", () => {
  const startedEarlier = { ...mission, missionStartedAt: new Date(+now - 3600_000) };
  const service = { trackingService: { active: true, startedAt: new Date(+now - 3600_000).toISOString() } };
  const fix = new Date(+now - 10_000);
  const fresh = policy.trackingPosition(startedEarlier, { ...driver, settings: service, driverLocation: { ...from, accuracy: 8, updatedAt: fix } }, 45, now, target);
  assert.equal(fresh.state, "FRESH"); assert.equal(fresh.latitude, from.latitude, "en direct : le relevé tel quel");
  assert.deepEqual({ ...fresh.motion!.from }, { ...from }); assert.deepEqual({ ...fresh.motion!.target }, { ...target }); assert.equal(fresh.motion!.since, fix.toISOString());
  const in60 = policy.motionPositionAt(fresh.motion!, +fix + 60_000), in120 = policy.motionPositionAt(fresh.motion!, +fix + 120_000);
  assert.ok(in60.latitude > from.latitude && in120.latitude > in60.latitude, "avance avec le temps");
  assert.deepEqual({ ...policy.motionPositionAt(fresh.motion!, +fix + 3600_000) }, { ...policy.motionPositionAt(fresh.motion!, +fix + 180_000) }, "plafonnée à 3 min");
  assert.deepEqual({ ...policy.motionPositionAt(fresh.motion!, +fix - 5000) }, { ...from }, "horloge en retard : jamais avant le relevé");
  const stale = policy.trackingPosition(startedEarlier, { ...driver, settings: service, driverLocation: { ...from, accuracy: 8, updatedAt: new Date(+now - 100_000) } }, 45, now, target);
  assert.deepEqual({ latitude: stale.latitude, longitude: stale.longitude }, { ...policy.motionPositionAt(stale.motion!, +now) }, "serveur et interface calculent le même point");
});
test("TRACK-2 : prochaine étape selon le statut et le type de mission", () => {
  const base = { latitude: 48.9, longitude: 2.4, pickupLatitude: 48.7, pickupLongitude: 2.2, order: { stops: [{ latitude: null, longitude: null }, { latitude: 48.75, longitude: 2.25 }] } };
  assert.deepEqual({ ...policy.trackingTarget({ ...base, status: "IN_DELIVERY", deliveryCategory: "STANDARD" }) }, { latitude: 48.9, longitude: 2.4 });
  assert.deepEqual({ ...policy.trackingTarget({ ...base, status: "PURCHASING", deliveryCategory: "COURIER" }) }, { latitude: 48.9, longitude: 2.4 });
  assert.deepEqual({ ...policy.trackingTarget({ ...base, status: "ASSIGNED", deliveryCategory: "COURIER" }) }, { latitude: 48.75, longitude: 2.25 });
  assert.deepEqual({ ...policy.trackingTarget({ ...base, order: { stops: [] }, status: "ASSIGNED", deliveryCategory: "COURIER" }) }, { latitude: 48.7, longitude: 2.2 });
  assert.equal(policy.trackingTarget({ ...base, status: "PURCHASING", deliveryCategory: "STANDARD" }), null);
  assert.equal(policy.trackingTarget({ ...base, status: "ASSIGNED", deliveryCategory: "STANDARD" }), null);
  assert.equal(policy.trackingTarget({ status: "IN_DELIVERY", latitude: null, longitude: null }), null);
  assert.equal(policy.trackingTarget({ status: "ASSIGNED", deliveryCategory: "COURIER", order: { stops: [] } }), null);
});
test("TRACK-1 : mission affectée sans départ et états terminaux ne révèlent aucune position", () => {
  for (const status of ["PENDING", "ASSIGNED"]) assert.equal(policy.trackingPosition({ ...mission, status, missionStartedAt: null }, driver, 45, now).state, "NOT_STARTED");
  for (const status of ["DELIVERED", "FAILED", "CANCELLED", "INVOICED", "PAID"]) { const p = policy.trackingPosition({ ...mission, status }, driver, 45, now); assert.equal(p.state, "ENDED"); assert.equal(p.latitude, null); assert.equal(p.updatedAt, null); }
  assert.equal(policy.trackingPosition({ ...mission, completedAt: now }, driver, 45, now).state, "ENDED");
});
test("TRACK-1 : arrêt service ou compte, ancien signal, signal futur et absence sont explicites", () => {
  for (const d of [null, { ...driver, settings: {} }, { ...driver, status: "SUSPENDED" }]) assert.equal(policy.trackingPosition(mission, d, 45, now).state, "OFF_DUTY");
  for (const d of [{ ...driver, driverLocation: null }, { ...driver, driverLocation: { ...driver.driverLocation, updatedAt: new Date(+now - 70000) } }, { ...driver, driverLocation: { ...driver.driverLocation, updatedAt: new Date(+now + 1) } }, { ...driver, settings: { trackingService: { active: true, startedAt: now.toISOString() } } }]) assert.equal(policy.trackingPosition(mission, d, 180, now).state, "ABSENT");
});
test("TRACK-1 : chronologie stable, étapes prévues exclues, aucune coordonnée ni champ interne", () => {
  const rows = ["Livraison", "Collecte 1", "Collecté", "Mission démarrée"].map((label, i) => ({ id: String(4-i), label, description: null, occurredAt: now, latitude: 45, secret: "x" }));
  const timeline = policy.trackingTimeline(rows); assert.deepEqual(timeline.map(r => r.label), ["Mission démarrée", "Collecté"]); assert.ok(!JSON.stringify(timeline).includes("latitude")); assert.ok(!JSON.stringify(timeline).includes("secret"));
});
class ConversationError extends Error { constructor(public status: number, message: string) { super(message); } }
function moduleAt(path: string, deps: Record<string, unknown>) {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module, exports: module.exports, Date, Error, console, require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return module.exports as any;
}
function fixture() {
  const calls: any[] = [];
  let user: any = { ...driver, companyId: "a", updatedAt: new Date(1), settings: { ...driver.settings, other: { preserve: true }, miniAdmin: { modules: ["orders"] } } };
  let order: any = { id: "o", reference: "CMD", status: "IN_DELIVERY", deliveryCategory: "STANDARD", updatedAt: now, company: { settings: {} }, deliveries: [{ id: "d", ...mission, reference: "LIV", driverId: "driver", driverName: "Responsable", deliveryCategory: "STANDARD", updatedAt: now, missionAcceptedAt: null, driver: user, trackingEvents: [{ id: "e", label: "Livré", description: null, occurredAt: now, latitude: 1 }] }] };
  let foundMission: any = { id: "d", updatedAt: now }; let claim = 1;
  const db: any = {
    user: { findFirst: async (args: any) => { calls.push(["user", args]); return user; }, updateMany: async (args: any) => { calls.push(["userUpdate", args]); return { count: claim }; } },
    order: { findFirst: async (args: any) => { calls.push(["order", args]); return order; } },
    delivery: { findFirst: async (args: any) => { calls.push(["mission", args]); return foundMission; }, updateMany: async (args: any) => { calls.push(["missionUpdate", args]); return { count: claim }; } },
    driverLocation: { deleteMany: async (args: any) => { calls.push(["deleteLocation", args]); }, upsert: async (args: any) => { calls.push(["location", args]); return { updatedAt: now }; } },
  };
  const deps = { "@/services/prisma/client": { prisma: db }, "@/domains/order-conversation/order-conversation.service": { ConversationError, transaction: (fn: any) => fn(db), conversationScope: (actor: any) => ({ companyId: actor.companyId, ...(actor.role === "CLIENT" ? { customerId: actor.id } : {}) }) }, "@/lib/constants/order-status": { getFulfillmentStatusLabel: (s: string) => s }, "@/lib/validations/driver-location-settings": { DEFAULT_DRIVER_LOCATION_SETTINGS, driverLocationSettingsSchema }, "./tracking.policy": policy, "@/domains/tracking/tracking.policy": policy, "@/lib/format/person-labels": { formatDriverDisplayName: (s: string) => s } };
  return { service: moduleAt("src/domains/tracking/tracking.service.ts", deps), location: moduleAt("src/domains/driver/driver-location.service.ts", deps), calls, user, order, noUser: () => { user = null; }, noOrder: () => { order = null; }, noMission: () => { foundMission = null; }, conflict: () => { claim = 0; } };
}
const actor = { id: "client", companyId: "a", role: "CLIENT", permissions: ["dashboard:client"] };
test("TRACK-1 service : commande et enfants limités entreprise/client ; chauffeur enfants affectés seulement", async () => {
  const f = fixture(); await f.service.getOrderTracking(actor, "o"); const q = f.calls.find(c => c[0] === "order")[1]; assert.equal(q.where.customerId, "client"); assert.equal(q.where.companyId, "a"); assert.equal(q.select.deliveries.where.customerId, "client"); assert.equal(q.select.deliveries.where.companyId, "a");
  f.calls.length = 0; await f.service.getOrderTracking({ ...actor, role: "DRIVER", id: "driver" }, "o"); assert.equal(f.calls.find(c => c[0] === "order")[1].select.deliveries.where.driverId, "driver");
});
test("TRACK-1 service : projection minimale, conducteur autre entreprise masqué, commande inexistante 404", async () => {
  const f = fixture(); f.order.deliveries[0].driver.companyId = "b";
  const data = await f.service.getOrderTracking(actor, "o"); assert.equal(data.deliveries[0].position.state, "OFF_DUTY"); assert.ok(!JSON.stringify(data).includes("settings")); assert.ok(!JSON.stringify(data).includes("latitude\":1"));
  f.noOrder(); await assert.rejects(f.service.getOrderTracking(actor, "o"), (e: any) => e.status === 404);
});
test("TRACK-1 service : fusion des réglages, version et suppression ancienne position, rejeu idempotent", async () => {
  const f = fixture(); await f.service.setDriverService("driver", "a", false);
  const update = f.calls.find(c => c[0] === "userUpdate")[1]; assert.equal(update.where.updatedAt, f.user.updatedAt); assert.equal(update.data.settings.other.preserve, true); assert.equal(update.data.settings.miniAdmin.modules[0], "orders"); assert.equal(update.data.settings.trackingService.active, false); assert.equal(f.calls.filter(c => c[0] === "deleteLocation").length, 1);
  f.calls.length = 0; await f.service.setDriverService("driver", "a", true); assert.equal(f.calls.filter(c => c[0] === "userUpdate").length, 0);
});
test("TRACK-1 service : conflit de version n’efface pas de position, utilisateur hors périmètre refusé", async () => {
  const f = fixture(); f.conflict(); await assert.rejects(f.service.setDriverService("driver", "a", false), (e: any) => e.status === 409); assert.ok(!f.calls.some(c => c[0] === "deleteLocation")); f.noUser(); await assert.rejects(f.service.getDriverService("driver", "b"), (e: any) => e.status === 404);
});
test("TRACK-1 publication : état DB courant et mission démarrée exigés, hors service aucune écriture", async () => {
  const f = fixture(); f.user.settings.trackingService.active = false; await assert.rejects(f.location.upsertDriverLocation("driver", "a", { latitude: 45, longitude: 3 }), (e: any) => e.status === 409); assert.ok(!f.calls.some(c => c[0] === "location"));
  f.user.settings.trackingService.active = true; f.noMission(); await assert.rejects(f.location.upsertDriverLocation("driver", "a", { latitude: 45, longitude: 3 }), (e: any) => e.status === 409);
  const q = f.calls.find(c => c[0] === "mission")[1]; assert.equal(q.where.companyId, "a"); assert.equal(q.where.completedAt, null); assert.equal(q.where.missionStartedAt.not, null);
});
test("TRACK-1 publication : verrou mission puis utilisateur, versions inchangées, conflit sans upsert", async () => {
  const f = fixture(); await f.location.upsertDriverLocation("driver", "a", { latitude: 45, longitude: 3 });
  assert.ok(f.calls.findIndex(c => c[0] === "missionUpdate") < f.calls.findIndex(c => c[0] === "userUpdate")); assert.equal(f.calls.find(c => c[0] === "userUpdate")[1].data.updatedAt, f.user.updatedAt);
  f.calls.length = 0; f.conflict(); await assert.rejects(f.location.upsertDriverLocation("driver", "a", { latitude: 45, longitude: 3 }), (e: any) => e.status === 409); assert.ok(!f.calls.some(c => c[0] === "location"));
});
test("TRACK-1 route : auth refusée sans lecture, dossier absent 404, succès non mis en cache", async () => {
  let auth: any = { error: new Response(null, { status: 401 }) }, called = 0, missing = false;
  const route = moduleAt("src/app/api/tracking/[id]/route.ts", { "next/server": { NextResponse: Response }, "@/lib/api/conversation-auth": { conversationAuth: async () => auth }, "@/domains/order-conversation/order-conversation.service": { ConversationError }, "@/domains/tracking/tracking.service": { getOrderTracking: async () => { called++; if (missing) throw new ConversationError(404, "Commande introuvable."); return {}; } } });
  const context = { params: Promise.resolve({ id: "o" }) }; assert.equal((await route.GET(new Request("http://localhost"), context)).status, 401); assert.equal(called, 0); auth = { actor }; missing = true; assert.equal((await route.GET(new Request("http://localhost"), context)).status, 404); missing = false; const r = await route.GET(new Request("http://localhost"), context); assert.equal(r.headers.get("cache-control"), "private, no-store");
});

test("TRACK-1 route service : identité authentifiée imposée, corps strict, aucune écriture invalide", async () => {
  let called = 0; const calls: any[] = [];
  const route = moduleAt("src/app/api/driver/service/route.ts", { "next/server": { NextResponse: Response }, zod: { z }, "@/lib/api/auth-guard": { requireDriverRole: async () => ({ context: { user: { id: "current", companyId: "a" } } }) }, "@/domains/order-conversation/order-conversation.service": { ConversationError }, "@/domains/tracking/tracking.service": { getDriverService: async (...args: any[]) => { calls.push(args); return { active: false }; }, setDriverService: async (...args: any[]) => { called++; calls.push(args); return { active: true }; } } });
  for (const body of [{ active: true, driverId: "other" }, { active: "true" }, {}]) assert.equal((await route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }))).status, 400);
  assert.equal(called, 0); assert.equal((await route.GET()).status, 200); assert.equal(calls[0][0], "current");
  assert.equal((await route.POST(new Request("http://localhost", { method: "POST", body: JSON.stringify({ active: true }) }))).status, 200); assert.equal(calls[1][0], "current"); assert.equal(calls[1][1], "a");
});

test("TRACK-1 carte chauffeurs : destination ne devient jamais position, signal autorisé seul fait marqueur", async () => {
  let locations: any[] = [];
  let missingDestination = false;
  const service = moduleAt("src/domains/delivery/dispatch-map.service.ts", {
    "@/services/prisma/client": { prisma: { user: { findMany: async () => [{ id: "driver", firstName: "D", lastName: "A" }] }, delivery: { findMany: async () => [{ id: "d", reference: "LIV", driverId: "driver", status: "IN_DELIVERY", deliveryCategory: "STANDARD", address: "Destination", latitude: missingDestination ? null : 48, longitude: missingDestination ? null : 2, companyId: "a", driverName: "Driver", missionStartedAt: new Date(0), missionAcceptedAt: new Date(0), completedAt: null, createdAt: now, driver: null, customer: null, order: { id: "o", customer: null, customerEmail: null, items: [], stops: [] }, trackingEvents: [{ id: "e", label: "Contrôle", description: null, latitude: 45, longitude: 3, occurredAt: now }] }] } } },
    "@/domains/delivery/delivery.service": { repairCourierDeliveryIfNeeded: async () => {} },
    "@/domains/driver/driver-location.service": { getCompanyDriverLocations: async () => locations },
    "@/domains/company/location-settings.service": { getCompanyLocationSettings: async () => DEFAULT_DRIVER_LOCATION_SETTINGS },
    "@/domains/tracking/tracking.policy": policy,
    "@/lib/geocoding": { geocodeManyCapped: async () => new Map(), isLegacyFakeTrackingCoord: () => false },
    "@/lib/constants/order-status": { getFulfillmentStatusLabel: (s: string) => s },
    "@/lib/validations/driver-location-settings": { DEFAULT_DRIVER_LOCATION_SETTINGS },
    "@/lib/format/person-labels": { formatDriverDisplayName: (s: string) => s, formatClientFromParts: () => "Client" },
  });
  const adminMap = await service.getDispatchMapDeliveries("a"); assert.equal(adminMap.deliveries[0].trackingSteps[0].latitude, 45);
  const clientMap = await service.getClientDeliveriesMap("client", "a"); assert.equal(clientMap.active[0].trackingSteps[0].latitude, null); assert.equal(clientMap.history[0].trackingSteps[0].longitude, null);
  const absent = await service.getDispatchDriversMap("a"); assert.equal(absent.drivers[0].latitude, null); assert.equal(absent.points.filter((p: any) => p.kind === "driver").length, 0); assert.equal(absent.points.filter((p: any) => p.kind === "destination").length, 1);
  locations = [{ id: "driver", latitude: 45, longitude: 3, updatedAt: now.toISOString(), positionState: "FRESH" }];
  const fresh = await service.getDispatchDriversMap("a"); assert.equal(fresh.drivers[0].latitude, 45); assert.equal(fresh.points.find((p: any) => p.kind === "driver").latitude, 45); assert.equal(fresh.drivers[0].updatedAt, now.toISOString());
  missingDestination = true;
  const degraded = await service.getDispatchMapDeliveries("a");
  assert.equal(degraded.deliveries.length, 1); assert.equal(degraded.deliveries[0].destination, null);
  assert.equal(degraded.points.filter((p: any) => p.kind === "destination").length, 0);
  const degradedClient = await service.getClientDeliveriesMap("client", "a"); assert.equal(degradedClient.active[0].destination, null);
  const degradedDrivers = await service.getDispatchDriversMap("a"); assert.equal(degradedDrivers.drivers[0].inTransit, 1);
  assert.equal(degradedDrivers.drivers[0].missions[0].latitude, null); assert.equal(degradedDrivers.points.filter((p: any) => p.kind === "destination").length, 0);
});

test("TRACK-1 transition : statut ASSIGNED exclu des entrées, 400 avant service de mutation", async () => {
  let mutations = 0;
  const route = moduleAt("src/app/api/driver/missions/[id]/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/api/auth-guard": { requireDriverRole: async () => ({ context: { user: { id: "driver", companyId: "a" } } }) },
    "@/services/prisma/client": { prisma: { delivery: { findFirst: async () => ({ companyId: "a" }) } } },
    "@/domains/delivery/delivery.service": { updateDeliveryStatusByDriver: async () => { mutations++; } },
    "@/lib/validations/delivery": { updateDriverDeliveryStatusSchema },
    "@/domains/delivery/driver-proximity.service": { DriverProximityError: Error },
    "@/lib/storage/pod": {}, "@/lib/pod/codes": {},
  });
  const response = await route.PATCH(new Request("http://localhost", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "ASSIGNED" }) }), { params: Promise.resolve({ id: "d" }) });
  assert.equal(response.status, 400); assert.equal(mutations, 0);
});

test("TRACK-1 cache : en-tête et historique logistiques synchronisés sans prix/preuve/coordonnées perdus", () => {
  const current = { id: "o", status: "ASSIGNED", updatedAt: new Date(1).toISOString(), totalAmount: "79.90", deliveries: [{ id: "d", status: "ASSIGNED", updatedAt: new Date(1).toISOString(), driverName: "Ancien", podPhotoUrl: "signed", trackingEvents: [{ id: "e", label: "Action", occurredAt: now.toISOString(), latitude: 45 }, { id: "p", label: "Livraison" }] }] };
  const data = { orderId: "o", status: "IN_DELIVERY", updatedAt: now.toISOString(), deliveries: [{ id: "d", status: "IN_DELIVERY", updatedAt: now.toISOString(), driverName: "Nouveau", missionAcceptedAt: null, missionStartedAt: now.toISOString(), completedAt: null, timeline: [{ id: "e", label: "Action", description: null, occurredAt: now.toISOString() }] }] };
  const next = syncTrackingDetail(current, data, "order") as typeof current;
  assert.equal(next.status, "IN_DELIVERY"); assert.equal(next.deliveries[0]!.driverName, "Nouveau"); assert.equal(next.totalAmount, "79.90"); assert.equal(next.deliveries[0]!.podPhotoUrl, "signed"); assert.equal(next.deliveries[0]!.trackingEvents.length, 1); assert.equal(next.deliveries[0]!.trackingEvents[0]!.latitude, 45); assert.ok(!("missionStartedAt" in next.deliveries[0]!));
  assert.equal(syncTrackingDetail(undefined, data, "order"), undefined);
  const unrelated = { ...current, id: "other" }; assert.equal(syncTrackingDetail(unrelated, data, "order"), unrelated);
  const newer = { ...current, updatedAt: new Date(+now+1).toISOString(), status: "DELIVERED", deliveries: current.deliveries.map(d => ({ ...d, updatedAt: new Date(+now+1).toISOString() })) };
  assert.equal(syncTrackingDetail(newer, data, "order"), newer);
});

test("TRACK-2 services : signal perdu depuis 2 min, livreur gardé et estimé sur les trois cartes et le suivi", async () => {
  const lostAt = new Date(Date.now() - 120_000);
  const startedAt = new Date(Date.now() - 3600_000);
  const lostDriver = { companyId: "a", status: "ACTIVE", settings: { trackingService: { active: true, startedAt: startedAt.toISOString() } }, driverLocation: { latitude: 48.8, longitude: 2.35, accuracy: 8, updatedAt: lostAt } };
  const delivery = { id: "d", reference: "LIV", companyId: "a", driverId: "driver", driverName: "Driver", status: "IN_DELIVERY", deliveryCategory: "STANDARD", address: "Destination", latitude: 48.9, longitude: 2.35, pickupLatitude: null, pickupLongitude: null, missionStartedAt: startedAt, missionAcceptedAt: startedAt, completedAt: null, createdAt: startedAt, updatedAt: startedAt, driver: lostDriver, customer: null, order: { id: "o", customer: null, customerEmail: null, items: [], stops: [] }, trackingEvents: [] };
  const assertEstimated = (point: { latitude: number | null; estimated: boolean }) => { assert.equal(point.estimated, true); assert.ok(point.latitude! > 48.8 && point.latitude! < 48.9, String(point.latitude)); };

  const prisma = { user: { findMany: async () => [{ id: "driver", firstName: "D", lastName: "A", status: "ACTIVE", settings: lostDriver.settings, driverLocation: lostDriver.driverLocation, deliveriesAsDriver: [delivery], _count: { deliveriesAsDriver: 1 } }] }, delivery: { findMany: async () => [delivery] } };
  const common = { "@/services/prisma/client": { prisma }, "@/domains/tracking/tracking.policy": policy, "@/lib/validations/driver-location-settings": { DEFAULT_DRIVER_LOCATION_SETTINGS }, "@/lib/format/person-labels": { formatDriverDisplayName: (s: string) => s, formatClientFromParts: () => "Client" } };
  const location = moduleAt("src/domains/driver/driver-location.service.ts", { ...common, "@/domains/order-conversation/order-conversation.service": { ConversationError, transaction: (fn: any) => fn(prisma) } });
  const [live] = await location.getCompanyDriverLocations("a", 45);
  assertEstimated(live); assert.equal(live.isOnline, false); assert.equal(live.positionState, "STALE"); assert.equal(live.updatedAt, lostAt.toISOString());

  const map = moduleAt("src/domains/delivery/dispatch-map.service.ts", { ...common,
    "@/domains/delivery/delivery.service": { repairCourierDeliveryIfNeeded: async () => {} },
    "@/domains/driver/driver-location.service": { getCompanyDriverLocations: async () => [live] },
    "@/domains/company/location-settings.service": { getCompanyLocationSettings: async () => DEFAULT_DRIVER_LOCATION_SETTINGS },
    "@/lib/geocoding": { geocodeManyCapped: async () => new Map(), isLegacyFakeTrackingCoord: () => false },
    "@/lib/constants/order-status": { getFulfillmentStatusLabel: (s: string) => s },
  });
  const adminMap = await map.getDispatchMapDeliveries("a", 45);
  assertEstimated(adminMap.deliveries[0].driverLocation); assert.equal(adminMap.deliveries[0].driverLocation.isOnline, false);
  assert.equal(adminMap.points.find((p: any) => p.kind === "driver").address, "Position estimée du livreur");
  const clientMap = await map.getClientDeliveriesMap("client", "a", 45);
  assertEstimated(clientMap.active[0].driverLocation);
  const drivers = await map.getDispatchDriversMap("a");
  assert.equal(drivers.drivers[0].estimated, true); assert.equal(drivers.points.filter((p: any) => p.kind === "driver").length, 1);

  const f = fixture(); f.order.deliveries[0] = { ...f.order.deliveries[0], ...delivery, driver: { ...lostDriver } };
  const tracking = await f.service.getOrderTracking(actor, "o");
  assertEstimated(tracking.deliveries[0].position); assert.ok(!JSON.stringify(tracking).includes("settings"));
});
