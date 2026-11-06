import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarDays, parisInstant, parisToday, parseCalendarDate } from "../src/lib/time/paris";

test("Heure de Paris : heure d'hiver UTC+1 et heure d'été UTC+2", () => {
  assert.equal(parisInstant("2026-10-29", "09:00")?.toISOString(), "2026-10-29T08:00:00.000Z");
  assert.equal(parisInstant("2026-10-28", "17:00")?.toISOString(), "2026-10-28T16:00:00.000Z");
  // Le 29 mars 2026, Paris passe à UTC+2.
  assert.equal(parisInstant("2026-03-29", "09:00")?.toISOString(), "2026-03-29T07:00:00.000Z");
  assert.equal(parisInstant("2026-03-28", "17:00")?.toISOString(), "2026-03-28T16:00:00.000Z");
});

test("Heure de Paris : « aujourd'hui » suit Paris, pas UTC", () => {
  assert.deepEqual(parisToday(new Date("2026-10-28T23:30:00.000Z")), { date: "2026-10-29", weekday: "jeudi" });
  assert.deepEqual(parisToday(new Date("2026-10-28T22:59:00.000Z")), { date: "2026-10-28", weekday: "mercredi" });
});

test("Heure de Paris : date ou heure invalide jamais inventée", () => {
  assert.equal(parisInstant("2026-02-31", "09:00"), null);
  assert.equal(parisInstant("2026-02-10", "25:99"), null);
  assert.equal(parseCalendarDate("2026-13-01"), null);
  assert.deepEqual(addCalendarDays({ year: 2026, month: 12, day: 31 }, 1), { year: 2027, month: 1, day: 1 });
});
