import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as eligibility from "../src/lib/dispatch/driver-eligibility";
import * as dispatchSettings from "../src/lib/validations/dispatch-settings";
import * as dispatchScore from "../src/lib/dispatch/dispatch-score";
import * as travelTime from "../src/lib/dispatch/travel-time";
import * as proximity from "../src/lib/dispatch/dispatch-proximity";
import * as trackingPolicy from "../src/domains/tracking/tracking.policy";

type Row = Record<string, unknown>;
function load<T>(file: string, deps: Record<string, unknown>): T {
  const module = { exports: {} };
  runInNewContext(ts.transpileModule(readFileSync(resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { Date, Math, Error, Promise, console, exports: module.exports, module,
    require: (id: string) => { assert.ok(id in deps, id); return deps[id]; } });
  return module.exports as T;
}
const initialVersion = new Date("2026-10-09T09:00:00.000Z");
function fixture(options: { failEvent?: boolean; race?: boolean } = {}) {
  let row: Row = { id: "delivery", companyId: "company", orderId: "order", driverId: "driver", driverName: "Test Livreur", status: "ASSIGNED", missionStartedAt: null, missionAcceptedAt: null, updatedAt: initialVersion };
  let orderStatus = "ASSIGNED";
  let events: Row[] = [];
  const same = (a: unknown, b: unknown) => a instanceof Date && b instanceof Date ? +a === +b : a === b;
  const matches = (where: Row) => Object.entries(where).every(([key, value]) => same(row[key], value));
  const tx = {
    delivery: {
      findFirst: async ({ where }: { where: Row }) => matches(where) ? { ...row } : null,
      findUniqueOrThrow: async () => ({ ...row }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (options.race) row = { ...row, driverId: "other", updatedAt: new Date(+initialVersion + 1) };
        if (!matches(where)) return { count: 0 };
        row = { ...row, ...data }; return { count: 1 };
      },
    },
    order: { updateMany: async () => { orderStatus = "PENDING"; return { count: 1 }; } },
    trackingEvent: { create: async ({ data }: { data: Row }) => { if (options.failEvent) throw new Error("EVENT_FAILURE"); events.push(data); return data; } },
  };
  let queue = Promise.resolve();
  const prisma = { ...tx, $transaction: <T>(fn: (transaction: typeof tx) => Promise<T>) => {
    const result = queue.then(async () => {
      const saved = { row: { ...row }, orderStatus, events: [...events] };
      try { return await fn(tx); } catch (error) { row = saved.row; orderStatus = saved.orderStatus; events = saved.events; throw error; }
    });
    queue = result.then(() => undefined, () => undefined); return result;
  } };
  const { acknowledgeDeliveryMissionByDriver: acknowledge } = load<{
    acknowledgeDeliveryMissionByDriver: (driver: string, company: string, id: string, input: { action: "accept" | "decline"; expectedUpdatedAt: Date; reason?: string }) => Promise<Row | null>;
  }>("src/domains/delivery/acknowledge-delivery-mission.service.ts", { "@/services/prisma/client": { prisma },
    // Notification de prise en charge couverte par tests/mission-acceptance-notification.test.ts.
    "@/domains/client-portal/notify.service": { queueDeliveryAcceptedNotification: async () => null },
    "@/domains/operations/operation-job.service": { kickOperationJob: () => undefined } });
  const { startDeliveryMissionByDriver: start } = load<{
    startDeliveryMissionByDriver: (driver: string, company: string, id: string, expected?: Date) => Promise<Row | null>;
  }>("src/domains/delivery/start-delivery-mission.service.ts", { "@/services/prisma/client": { prisma } });
  return { acknowledge, start, row: () => row, events: () => events, order: () => orderStatus,
    change: (data: Row) => { row = { ...row, ...data }; } };
}
const accept = { action: "accept" as const, expectedUpdatedAt: initialVersion };

test("ACK : confirmation datée distincte du départ et rejeu sans doublon", async () => {
  const f = fixture(); const result = await f.acknowledge("driver", "company", "delivery", accept);
  assert.ok(result?.missionAcceptedAt instanceof Date); assert.equal(result.missionStartedAt, null);
  assert.equal(result.status, "ASSIGNED"); assert.equal(f.order(), "ASSIGNED");
  await f.acknowledge("driver", "company", "delivery", { ...accept, expectedUpdatedAt: result.updatedAt as Date });
  assert.equal(f.events().length, 1); assert.equal(f.events()[0]?.occurredAt, result.missionAcceptedAt);
});
test("ACK : double clic concurrent produit une date et un événement", async () => {
  const f = fixture(); const results = await Promise.allSettled([f.acknowledge("driver", "company", "delivery", accept), f.acknowledge("driver", "company", "delivery", accept)]);
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(results.filter(r => r.status === "rejected").length, 1); assert.equal(f.events().length, 1);
});
test("ACK : refus avant ou après confirmation rend la mission et conserve la trace", async () => {
  for (const confirmed of [false, true]) {
    const f = fixture();
    if (confirmed) await f.acknowledge("driver", "company", "delivery", accept);
    await f.acknowledge("driver", "company", "delivery", { action: "decline", expectedUpdatedAt: f.row().updatedAt as Date, reason: "Indisponible" });
    assert.equal(f.row().driverId, null); assert.equal(f.row().missionAcceptedAt, null);
    assert.equal(f.row().status, "PENDING"); assert.equal(f.order(), "PENDING");
    assert.match(String(f.events().at(-1)?.description), /Test Livreur.*Indisponible/);
    assert.equal(f.events().filter(e => e.label === "Prise en charge confirmée").length, confirmed ? 1 : 0);
  }
});
test("ACK : motif vide interdit sans mutation", async () => {
  const f = fixture(); await assert.rejects(f.acknowledge("driver", "company", "delivery", { action: "decline", expectedUpdatedAt: initialVersion, reason: "  " }), /MISSION_DECLINE_REASON_REQUIRED/);
  assert.equal(f.row().driverId, "driver"); assert.equal(f.events().length, 0);
});
test("ACK : mauvais livreur et autre entreprise ne voient aucune mission", async () => {
  const f = fixture(); assert.equal(await f.acknowledge("other", "company", "delivery", accept), null);
  assert.equal(await f.acknowledge("driver", "foreign", "delivery", accept), null); assert.equal(f.events().length, 0);
});
test("ACK : retour A → B → A invalide la carte ancienne", async () => {
  const f = fixture(); f.change({ updatedAt: new Date(+initialVersion + 2) });
  for (const action of ["accept", "decline"] as const) await assert.rejects(f.acknowledge("driver", "company", "delivery", { ...accept, action, reason: "Indisponible" }), /MISSION_ACK_CONFLICT/);
  assert.equal(f.events().length, 0); assert.equal(f.row().missionAcceptedAt, null);
});
test("ACK : départ et états terminaux refusent confirmation et refus", async () => {
  for (const state of [{ missionStartedAt: new Date() }, ...["PURCHASING", "IN_DELIVERY", "DELIVERED", "FAILED", "CANCELLED", "INVOICED", "PAID"].map(status => ({ status }))]) {
    const f = fixture(); f.change(state);
    for (const action of ["accept", "decline"] as const) await assert.rejects(f.acknowledge("driver", "company", "delivery", { ...accept, action, reason: "Indisponible" }), /MISSION_ACK_CONFLICT/);
    assert.equal(f.events().length, 0);
  }
});
test("ACK : perte du CAS interdit une confirmation du mauvais livreur", async () => {
  const f = fixture({ race: true }); await assert.rejects(f.acknowledge("driver", "company", "delivery", accept), /MISSION_ACK_CONFLICT/); assert.equal(f.events().length, 0);
});
test("ACK : échec historique annule aussi le refus et le statut commande", async () => {
  const f = fixture({ failEvent: true }); await assert.rejects(f.acknowledge("driver", "company", "delivery", { action: "decline", expectedUpdatedAt: initialVersion, reason: "Indisponible" }), /EVENT_FAILURE/);
  assert.equal(f.row().driverId, "driver"); assert.equal(f.row().status, "ASSIGNED"); assert.equal(f.order(), "ASSIGNED"); assert.equal(f.events().length, 0);
});
test("ACK : démarrage exige confirmation, puis conserve sa date et refuse une carte périmée", async () => {
  const f = fixture(); await assert.rejects(f.start("driver", "company", "delivery"), /MISSION_ACCEPTANCE_REQUIRED/);
  await f.acknowledge("driver", "company", "delivery", accept);
  await assert.rejects(f.start("driver", "company", "delivery", initialVersion), /MISSION_START_CONFLICT/);
  const acceptedAt = f.row().missionAcceptedAt;
  await f.start("driver", "company", "delivery", f.row().updatedAt as Date);
  assert.ok(f.row().missionStartedAt); assert.equal(f.row().missionAcceptedAt, acceptedAt);
});
test("ACK : ancienne mission démarrée ne reçoit jamais une confirmation fabriquée", async () => {
  const f = fixture(); f.change({ missionStartedAt: new Date() });
  await assert.rejects(f.start("driver", "company", "delivery"), /MISSION_ALREADY_STARTED/);
  assert.equal(f.row().missionAcceptedAt, null); assert.equal(f.events().length, 0);
});


test("ACK : auto-dispatch traite la perte du libre choix comme conflit terminal", async () => {
  const settings = { ...dispatchSettings.DEFAULT_DISPATCH_SETTINGS, enabled: true,
    driverRules: [dispatchSettings.normalizeDispatchDriverRule({ driverId: "driver", priority: 1 })] };
  const { tryAutoAssignDelivery } = load<{
    tryAutoAssignDelivery: (company: string, id: string) => Promise<{ assigned: boolean; skippedReason: string }>;
  }>("src/domains/delivery/auto-dispatch.service.ts", {
    "@/services/prisma/client": { prisma: { delivery: { findFirst: async () => ({ id: "delivery", driverId: null, status: "PENDING", deliveryCategory: "STANDARD", postalCode: "75001" }) }, user: { findMany: async () => [] } } },
    "@/domains/company/dispatch-settings.service": { getCompanyDispatchSettings: async () => settings },
    "@/domains/company/tariff-settings.service": { getCompanyTariffSettings: async () => ({ tariffZones: [] }) },
    "@/lib/tariff/find-tariff-zone": { findTariffZoneForPostalCode: () => null },
    "@/domains/delivery/delivery.service": {
      getCompanyDriversWithActivity: async () => [{ id: "driver", assigned: 0 }],
      assignDeliveryToDriver: async () => { throw new Error("DELIVERY_NOT_AVAILABLE"); },
    },
    "@/lib/dispatch/driver-eligibility": eligibility,
    "@/lib/dispatch/dispatch-proximity": proximity,
    "@/domains/tracking/tracking.policy": trackingPolicy,
    "@/lib/query/list-limits": { AUTO_DISPATCH_QUEUE_TAKE: 100 },
    "@/lib/validations/dispatch-settings": dispatchSettings,
    "@/lib/dispatch/dispatch-score": dispatchScore,
    "@/lib/dispatch/travel-time": travelTime,
  });
  const result = await tryAutoAssignDelivery("company", "delivery");
  assert.equal(result.assigned, false);
  assert.equal(result.skippedReason, "Déjà assignée entre-temps");
});
