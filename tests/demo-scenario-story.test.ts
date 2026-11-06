import assert from "node:assert/strict";
import test from "node:test";
import {
  buildScenario,
  buildScenarioHistory,
  demoScenarioAnchor,
  parisClockOffsetHours,
  type ScenarioItem,
} from "../src/domains/demo/demo-scenario.service";
import { computeDispatchIncidents } from "../src/lib/dispatch/dispatch-incidents";
import { toParisDateTimeInput } from "../src/lib/format/paris-datetime-input";

const ACTIVE = new Set(["PENDING", "ASSIGNED", "PURCHASING", "IN_DELIVERY"]);
const HOUR = 60 * 60 * 1000;
// Mercredi 5 novembre 2026, 11 h 07 à Paris (UTC+1) : arrondi à 11 h 00.
const REFERENCE = new Date("2026-11-05T10:07:00.000Z");

const at = (anchor: Date, offsetHours: number) => new Date(anchor.getTime() + offsetHours * HOUR);
const count = (items: ScenarioItem[], status: string) => items.filter((item) => item.deliveryStatus === status).length;

test("DEMO-REFONTE : l'ancrage est arrondi au quart d'heure", () => {
  assert.equal(demoScenarioAnchor(REFERENCE).toISOString(), "2026-11-05T10:00:00.000Z");
  assert.equal(demoScenarioAnchor(new Date("2026-11-05T10:08:00.000Z")).toISOString(), "2026-11-05T10:15:00.000Z");
});

test("DEMO-REFONTE : une journée de 14 livraisons (+ 1 commande récurrente), comptes par état conformes au document", () => {
  const anchor = demoScenarioAnchor(REFERENCE);
  const items = buildScenario(anchor);
  assert.equal(items.length, 14);
  assert.equal(count(items, "DELIVERED"), 4);
  assert.equal(count(items, "IN_DELIVERY") + count(items, "PURCHASING"), 4, "3 en route + 1 en retard en route");
  assert.equal(count(items, "PURCHASING"), 1);
  assert.equal(items.filter((item) => item.deliveryStatus === "IN_DELIVERY" && (item.pickupStops?.length ?? 0) > 1).length, 1);
  assert.equal(count(items, "PENDING"), 2);
  assert.ok(items.filter((item) => item.deliveryStatus === "PENDING").every((item) => !item.assignDriver));
  assert.equal(count(items, "ASSIGNED"), 4, "2 affectées aujourd'hui + 2 demain");

  for (const item of items.filter((candidate) => candidate.deliveryStatus === "DELIVERED")) {
    assert.ok(item.completedAtOffsetHours! >= -5 && item.completedAtOffsetHours! <= -1 && item.requestedDeliveryDateOffsetHours > item.completedAtOffsetHours!, item.label);
    assert.ok(item.proof?.recipientName, `${item.label} : preuve`);
  }
  assert.equal(items.filter((item) => item.invoice?.status === "PAID").length, 1);
  assert.equal(items.filter((item) => item.supportTicket).length, 1, "un seul ticket de support");

  const tomorrow = items.filter((item) => item.requestedDeliveryDateOffsetHours > 12);
  assert.deepEqual(
    tomorrow.map((item) => toParisDateTimeInput(at(anchor, item.requestedDeliveryDateOffsetHours))),
    ["2026-11-06T10:00", "2026-11-06T14:30"]
  );
});

test("DEMO-REFONTE : les vues Client et Livreur ont de quoi faire les étapes « À essayer »", () => {
  const items = buildScenario(demoScenarioAnchor(REFERENCE));
  const client = items.filter((item) => item.clientIndex === 0);
  assert.ok(client.some((item) => item.deliveryStatus === "IN_DELIVERY"), "client : un livreur à suivre");
  assert.ok(client.some((item) => item.invoice), "client : une facture");
  assert.ok(client.some((item) => item.proof), "client : une preuve");
  const driver = items.filter((item) => item.driverIndex === 0);
  assert.ok(driver.some((item) => item.deliveryStatus === "IN_DELIVERY"), "livreur : une mission à terminer");
  assert.ok(items.every((item) => item.clientIndex !== undefined), "chaque élément a son client");
});

test("DEMO-REFONTE : à l'ouverture, une seule alerte, le retard voulu, livreurs en service ou non", () => {
  const anchor = demoScenarioAnchor(REFERENCE);
  const items = buildScenario(anchor);
  for (const onDuty of [true, false]) {
    const incidents = computeDispatchIncidents(
      items.filter((item) => ACTIVE.has(item.deliveryStatus)).map((item, index) => ({
        id: `d${index}`,
        reference: `LIV-${index}`,
        status: item.deliveryStatus,
        driverId: item.assignDriver ? `driver-${item.driverIndex}` : null,
        driverName: item.assignDriver ? "Livreur" : null,
        driverActive: true,
        driverOnDuty: onDuty,
        missionStarted: item.missionStartedAtOffsetHours != null,
        deadline: at(anchor, item.requestedDeliveryDateOffsetHours),
      })),
      anchor
    );
    assert.deepEqual(incidents.map((incident) => incident.kind), ["LATE"], `en service : ${onDuty}`);
  }
  const late = items.filter((item) => ACTIVE.has(item.deliveryStatus) && item.requestedDeliveryDateOffsetHours < 0);
  assert.equal(late.length, 1);
  assert.equal(Math.round(late[0]!.requestedDeliveryDateOffsetHours * 60), -25);
});

test("DEMO-REFONTE : sept jours d'historique, au plus une livraison en retard", () => {
  const anchor = demoScenarioAnchor(REFERENCE);
  const history = buildScenarioHistory(anchor);
  const days = new Map<string, number>();
  for (const item of history) {
    assert.equal(item.deliveryStatus, "DELIVERED");
    const day = toParisDateTimeInput(at(anchor, item.completedAtOffsetHours!)).slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  assert.equal(days.size, 7);
  assert.ok([...days.values()].every((perDay) => perDay >= 2 && perDay <= 4));
  assert.ok(!days.has("2026-11-05"), "rien d'historique aujourd'hui");
  assert.equal(history.filter((item) => item.requestedDeliveryDateOffsetHours < item.completedAtOffsetHours!).length, 1);
});

test("DEMO-REFONTE : aucune mention « démo », « test » ou « E2E » dans les textes visibles", () => {
  const anchor = demoScenarioAnchor(REFERENCE);
  const texts = [...buildScenario(anchor), ...buildScenarioHistory(anchor)].flatMap((item) => [
    item.notes,
    item.deliveryInstructions,
    item.proof?.recipientName,
    item.supportTicket?.subject,
    item.supportTicket?.message,
    ...(item.items ?? []).map((line) => line.name),
    ...(item.pickupStops ?? []).flatMap((stop) => [stop.label, ...stop.items.map((line) => line.name)]),
    ...item.tracking.flatMap((event) => [event.label, event.description]),
  ]).filter((text): text is string => Boolean(text));
  for (const text of texts) assert.doesNotMatch(text, /d[ée]mo|\btest|e2e/i, text);
});

test("DEMO-REFONTE : en journée, les échéances du jour restent entre 7 h et 20 h à Paris", () => {
  const anchor = demoScenarioAnchor(REFERENCE);
  for (const item of buildScenario(anchor)) {
    const local = toParisDateTimeInput(at(anchor, item.requestedDeliveryDateOffsetHours));
    if (!local.startsWith("2026-11-05")) continue;
    const hour = Number(local.slice(11, 13));
    assert.ok(hour >= 7 && hour < 20, `${item.label} : ${local}`);
  }
  assert.equal(parisClockOffsetHours(anchor, 1, "10:00"), 23, "T = 11 h à Paris : demain 10 h = T + 23 h");
});
