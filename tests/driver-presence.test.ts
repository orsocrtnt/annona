import assert from "node:assert/strict";
import test from "node:test";
import { driverSignalLabel, formatSignalAge, getDriverPresenceColor, getDriverPresenceStatus } from "../src/lib/driver-presence";

const now = Date.parse("2026-10-27T12:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

test("présence : verte en direct, jaune pendant l'estimation, rouge signal perdu", () => {
  assert.equal(getDriverPresenceColor(true, ago(5), now), "#6BB700");
  assert.equal(getDriverPresenceColor(false, ago(60), now), "#EAA300");
  assert.equal(getDriverPresenceColor(false, ago(180), now), "#EAA300");
  assert.equal(getDriverPresenceColor(false, ago(181), now), "#C4314B");
  assert.equal(getDriverPresenceStatus(false, null, now), "lost");
});

test("la pastille passe au rouge toute seule, sans nouvelles données", () => {
  const updatedAt = ago(170);
  assert.equal(getDriverPresenceStatus(false, updatedAt, now), "recent");
  assert.equal(getDriverPresenceStatus(false, updatedAt, now + 15_000), "lost");
});

test("âge du signal lisible, de moins d'une minute à plus d'un jour", () => {
  assert.equal(formatSignalAge(ago(50), now), "Il y a moins d'1 min");
  assert.equal(formatSignalAge(ago(180), now), "Il y a 3 min");
  assert.equal(formatSignalAge(ago(2 * 3600 + 60), now), "Il y a 2 h");
  assert.equal(formatSignalAge(ago(30 * 3600), now), "Il y a plus d'un jour");
  assert.equal(formatSignalAge(ago(-30), now), "Il y a moins d'1 min", "horloge en avance : jamais d'âge négatif");
});

test("libellé sous le nom : en direct, estimée, interrompu, perdu au-delà de 3 min", () => {
  assert.equal(driverSignalLabel({ isOnline: true, updatedAt: ago(5) }, now), "En direct");
  assert.equal(driverSignalLabel({ isOnline: false, estimated: true, updatedAt: ago(120) }, now), "Il y a 2 min · Position estimée");
  assert.equal(driverSignalLabel({ isOnline: false, updatedAt: ago(120) }, now), "Il y a 2 min");
  assert.equal(driverSignalLabel({ isOnline: false, estimated: true, updatedAt: ago(180) }, now), "Il y a 3 min · Position estimée");
  assert.equal(driverSignalLabel({ isOnline: false, estimated: true, updatedAt: ago(181) }, now), "Il y a 3 min · Signal perdu", "l'estimation des données reçues est dépassée localement");
  assert.equal(driverSignalLabel({ isOnline: false, updatedAt: null }, now), "Signal inconnu");
});

test("le libellé avance avec l'heure, sans nouvelles données", () => {
  const signal = { isOnline: false, estimated: true, updatedAt: ago(60) };
  assert.equal(driverSignalLabel(signal, now), "Il y a 1 min · Position estimée");
  assert.equal(driverSignalLabel(signal, now + 60_000), "Il y a 2 min · Position estimée");
});
