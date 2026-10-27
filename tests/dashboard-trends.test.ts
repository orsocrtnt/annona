import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardTrends,
  countDeliveredBetween,
  deliveredByHour,
  wasLateAt,
  type TrendDelivery,
} from "../src/lib/dashboard/trends";

const at = (iso: string) => new Date(iso);

function delivery(partial: Partial<TrendDelivery>): TrendDelivery {
  return {
    status: "IN_DELIVERY",
    createdAt: at("2026-10-20T08:00:00"),
    completedAt: null,
    requestedDeliveryDate: null,
    ...partial,
  };
}

test("une mission est en retard à un instant si son échéance est passée et qu'elle n'est pas encore terminée", () => {
  const late = delivery({ requestedDeliveryDate: at("2026-10-25T10:00:00") });
  assert.equal(wasLateAt(late, at("2026-10-25T12:00:00")), true);
  assert.equal(wasLateAt(late, at("2026-10-25T09:00:00")), false, "avant l'échéance");

  const finishedLate = delivery({
    status: "DELIVERED",
    requestedDeliveryDate: at("2026-10-25T10:00:00"),
    completedAt: at("2026-10-25T15:00:00"),
  });
  assert.equal(wasLateAt(finishedLate, at("2026-10-25T12:00:00")), true, "encore ouverte à 12 h");
  assert.equal(wasLateAt(finishedLate, at("2026-10-25T16:00:00")), false, "terminée à 16 h");

  const notYetCreated = delivery({ createdAt: at("2026-10-26T08:00:00"), requestedDeliveryDate: at("2026-10-26T09:00:00") });
  assert.equal(wasLateAt(notYetCreated, at("2026-10-25T12:00:00")), false, "n'existait pas encore");

  const cancelled = delivery({ status: "CANCELLED", requestedDeliveryDate: at("2026-10-25T10:00:00") });
  assert.equal(wasLateAt(cancelled, at("2026-10-25T12:00:00")), false, "annulée sans heure connue : exclue");
});

test("les livraisons terminées se comptent par fenêtre et par heure", () => {
  const rows = [
    delivery({ status: "DELIVERED", completedAt: at("2026-10-26T09:15:00") }),
    delivery({ status: "DELIVERED", completedAt: at("2026-10-26T09:45:00") }),
    delivery({ status: "DELIVERED", completedAt: at("2026-10-26T14:00:00") }),
    delivery({ status: "FAILED", completedAt: at("2026-10-26T10:00:00") }),
  ];
  assert.equal(countDeliveredBetween(rows, at("2026-10-26T00:00:00"), at("2026-10-26T12:00:00")), 2);
  const hours = deliveredByHour(rows, at("2026-10-26T00:00:00"), at("2026-10-26T15:00:00"));
  assert.equal(hours.length, 24);
  assert.equal(hours[9], 2);
  assert.equal(hours[14], 1);
  assert.equal(hours[10], 0, "un échec n'est pas une livraison");
});

test("les tendances comparent à hier à la même heure", () => {
  const rows = [
    delivery({ status: "DELIVERED", completedAt: at("2026-10-25T09:00:00") }),
    delivery({ status: "DELIVERED", completedAt: at("2026-10-25T18:00:00") }),
    delivery({ status: "DELIVERED", completedAt: at("2026-10-26T08:00:00") }),
    delivery({ status: "DELIVERED", completedAt: at("2026-10-26T09:00:00") }),
    delivery({ status: "DELIVERED", completedAt: at("2026-10-26T10:00:00") }),
    delivery({ requestedDeliveryDate: at("2026-10-26T07:00:00") }),
  ];
  const trends = buildDashboardTrends(rows, at("2026-10-26T00:00:00"), at("2026-10-26T12:00:00"));
  assert.equal(trends.deliveredToday, 3);
  assert.equal(trends.deliveredYesterdaySameTime, 1, "la livraison d'hier à 18 h ne compte pas");
  assert.equal(trends.lateNow, 1);
  assert.equal(trends.lateYesterdaySameTime, 0);
});
