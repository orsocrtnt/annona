import assert from "node:assert/strict";
import test from "node:test";
import { driverSignalLabel, formatSignalAge, getDriverPresenceColor, TEAMS_PRESENCE } from "../src/lib/driver-presence";

const now = Date.parse("2026-10-27T12:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

test("présence : vert en direct, jaune sinon, plus jamais de rouge", () => {
  assert.equal(getDriverPresenceColor(true), "#6BB700");
  assert.equal(getDriverPresenceColor(false), "#EAA300");
  assert.deepEqual(Object.keys(TEAMS_PRESENCE).sort(), ["online", "recent"]);
});

test("âge du signal lisible, de moins d'une minute à plus d'un jour", () => {
  assert.equal(formatSignalAge(ago(50), now), "Il y a moins d'1 min");
  assert.equal(formatSignalAge(ago(180), now), "Il y a 3 min");
  assert.equal(formatSignalAge(ago(2 * 3600 + 60), now), "Il y a 2 h");
  assert.equal(formatSignalAge(ago(30 * 3600), now), "Il y a plus d'un jour");
  assert.equal(formatSignalAge(ago(-30), now), "Il y a moins d'1 min", "horloge en avance : jamais d'âge négatif");
});

test("libellé sous le nom : en direct, estimée, interrompu, perdu au-delà de 10 min", () => {
  assert.equal(driverSignalLabel({ isOnline: true, updatedAt: ago(5) }, now), "En direct");
  assert.equal(driverSignalLabel({ isOnline: false, estimated: true, updatedAt: ago(180) }, now), "Il y a 3 min · Position estimée");
  assert.equal(driverSignalLabel({ isOnline: false, updatedAt: ago(180) }, now), "Il y a 3 min");
  assert.equal(driverSignalLabel({ isOnline: false, updatedAt: ago(600) }, now), "Il y a 10 min");
  assert.equal(driverSignalLabel({ isOnline: false, updatedAt: ago(601) }, now), "Il y a 10 min · Signal perdu");
  assert.equal(driverSignalLabel({ isOnline: false, updatedAt: null }, now), "Signal inconnu");
});

test("le libellé avance avec l'heure, sans nouvelles données", () => {
  const signal = { isOnline: false, estimated: true, updatedAt: ago(120) };
  assert.equal(driverSignalLabel(signal, now), "Il y a 2 min · Position estimée");
  assert.equal(driverSignalLabel(signal, now + 60_000), "Il y a 3 min · Position estimée");
});
