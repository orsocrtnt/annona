import assert from "node:assert/strict";
import test from "node:test";
import { addDays } from "../src/lib/dashboard/period-stats";
import { buildSevenDayHistory, historyStart } from "../src/lib/dashboard/seven-day-history";
import {
  DEFAULT_DASHBOARD_LAYOUT,
  getVisibleDashboardWidgets,
  normalizeDashboardLayout,
  toggleDashboardWidget,
} from "../src/lib/dashboard/dashboard-layout";

const today = new Date(2026, 9, 30, 0, 0, 0, 0);
const at = (dayOffset: number, hour: number) => new Date(addDays(today, dayOffset).getTime() + hour * 3_600_000);

test("7 derniers jours : sept cases du plus ancien à aujourd'hui, livrées, dont en retard, échecs", () => {
  const history = buildSevenDayHistory(
    [
      { status: "DELIVERED", completedAt: at(0, 10), requestedDeliveryDate: at(0, 12) },
      { status: "DELIVERED", completedAt: at(0, 15), requestedDeliveryDate: at(0, 12) },
      { status: "DELIVERED", completedAt: at(-6, 9), requestedDeliveryDate: null },
      { status: "FAILED", completedAt: at(-2, 11), requestedDeliveryDate: at(-2, 10) },
      // Hors fenêtre ou incomplètes : ignorées.
      { status: "DELIVERED", completedAt: at(-7, 23), requestedDeliveryDate: null },
      { status: "IN_DELIVERY", completedAt: null, requestedDeliveryDate: at(0, 9) },
      { status: "CANCELLED", completedAt: at(-1, 9), requestedDeliveryDate: null },
    ],
    today
  );
  assert.equal(history.length, 7);
  assert.equal(history[0]!.date, addDays(today, -6).toISOString());
  assert.equal(history[6]!.date, today.toISOString());
  assert.deepEqual(history[6], { date: today.toISOString(), delivered: 2, deliveredLate: 1, failed: 0 });
  assert.deepEqual(history[0], { date: addDays(today, -6).toISOString(), delivered: 1, deliveredLate: 0, failed: 0 });
  assert.equal(history[4]!.failed, 1);
  assert.equal(history.reduce((sum, day) => sum + day.delivered, 0), 3);
  assert.equal(historyStart(today).toISOString(), addDays(today, -6).toISOString());
});

test("7 derniers jours : affiché par défaut, y compris pour une disposition enregistrée avant son ajout", () => {
  const visible = (layout: Parameters<typeof normalizeDashboardLayout>[0]) => getVisibleDashboardWidgets(normalizeDashboardLayout(layout)).map((w) => w.type);
  assert.ok(visible(null).includes("history-7d"));
  const older = { defaultPeriod: "7d" as const, widgets: DEFAULT_DASHBOARD_LAYOUT.widgets.filter((w) => w.type !== "history-7d") };
  assert.ok(visible(older).includes("history-7d"));
});

test("retards en permanence : sans bloc d'alertes, « En retard » revient en tête et ne peut pas être masqué", () => {
  const base = normalizeDashboardLayout(null);
  const withoutRow = toggleDashboardWidget(base.widgets, "alerts-row", false);
  const visible = getVisibleDashboardWidgets({ ...base, widgets: withoutRow }).map((w) => w.type);
  assert.equal(visible[0], "alert-late");
  const hiddenLate = toggleDashboardWidget(withoutRow, "alert-late", false);
  assert.ok(getVisibleDashboardWidgets({ ...base, widgets: hiddenLate }).some((w) => w.type === "alert-late"));
  // Avec le bloc d'alertes visible, la case seule reste facultative.
  const both = toggleDashboardWidget(base.widgets, "alert-late", false);
  assert.ok(!getVisibleDashboardWidgets({ ...base, widgets: both }).some((w) => w.type === "alert-late"));
  // Disposition enregistrée sans aucune alerte : corrigée à la lecture.
  const stored = { defaultPeriod: "7d" as const, widgets: base.widgets.map((w) => (w.type === "alerts-row" || w.type === "alert-late" ? { ...w, visible: false } : w)) };
  assert.equal(getVisibleDashboardWidgets(normalizeDashboardLayout(stored))[0]!.type, "alert-late");
});
