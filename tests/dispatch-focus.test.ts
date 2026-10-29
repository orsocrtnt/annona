import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { DeliveryStatus } from "@prisma/client";
import {
  buildDispatchTargetHref,
  resolveDispatchFocus,
  type DispatchFocusableDelivery,
} from "../src/features/back-office/dispatch-focus";
import { isLateDashboardDrillDown } from "../src/features/back-office/dashboard-drill-down";
import { getHighlightedPage } from "../src/lib/table/data-grid-focus";

const now = new Date("2026-10-16T12:00:00.000Z");

function delivery(
  id: string,
  input: { status?: DeliveryStatus; due?: string | null; completedAt?: string | null } = {}
): DispatchFocusableDelivery {
  return {
    id,
    status: input.status ?? "ASSIGNED",
    completedAt: input.completedAt ?? null,
    order: {
      requestedDeliveryDate: input.due ?? "2026-10-16T11:00:00.000Z",
    },
  };
}

test("DISPATCH-2 : un lien retard cible exactement la livraison demandée", () => {
  const params = new URLSearchParams("delivery=liv-17&focus=late");
  const rows = Array.from({ length: 30 }, (_, index) => delivery(`liv-${index}`));
  const focus = resolveDispatchFocus(params, rows, now);

  assert.equal(focus.state, "ready");
  assert.equal(focus.state === "ready" ? focus.delivery.id : null, "liv-17");
  assert.equal(focus.state === "ready" ? focus.reason : null, "late");
  assert.equal(getHighlightedPage(rows.map((row) => row.id), "liv-17", 15), 1);
  assert.equal(getHighlightedPage(rows.map((row) => row.id), "liv-99", 15), null);
});

test("DISPATCH-2 : disparition du retard et cible hors périmètre ont la même réponse neutre", () => {
  const params = new URLSearchParams("delivery=liv-target&focus=late");
  const noLongerLate = resolveDispatchFocus(
    params,
    [delivery("liv-target", { due: "2026-10-16T13:00:00.000Z" })],
    now
  );
  const inaccessible = resolveDispatchFocus(params, [delivery("other-company")], now);

  assert.deepEqual(noLongerLate, { state: "unavailable", reason: "late" });
  assert.deepEqual(inaccessible, { state: "unavailable", reason: "late" });
});

test("DISPATCH-2 : un lien dispatch ordinaire continue à accepter une livraison non en retard", () => {
  const focus = resolveDispatchFocus(
    new URLSearchParams("delivery=liv-future"),
    [delivery("liv-future", { due: "2026-10-17T12:00:00.000Z" })],
    now
  );
  assert.equal(focus.state, "ready");
  assert.equal(focus.state === "ready" ? focus.reason : null, "delivery");
});

test("DISPATCH-2 : seuls les drill-down réellement en retard marquent le lien", () => {
  assert.equal(
    isLateDashboardDrillDown({ scope: "alert", key: "late", title: "Retards" }),
    true
  );
  assert.equal(
    isLateDashboardDrillDown({ scope: "today", key: "late", title: "Retards" }),
    true
  );
  assert.equal(
    isLateDashboardDrillDown({ scope: "period", key: "late", title: "Retards" }),
    true
  );
  assert.equal(
    isLateDashboardDrillDown({ scope: "alert", key: "unassigned", title: "Sans livreur" }),
    false
  );
  assert.equal(buildDispatchTargetHref("liv/a b", true), "/dispatch?delivery=liv%2Fa+b&focus=late");
});

test("DISPATCH-2 : la grille et la carte exposent le focus visuel et clavier", () => {
  const grid = readFileSync("src/components/ui/data-grid.tsx", "utf8");
  const mapPanel = readFileSync(
    "src/features/back-office/dispatch-deliveries-map-panel.tsx",
    "utf8"
  );
  const mapPage = readFileSync("src/features/back-office/dispatch-unified-map.tsx", "utf8");

  assert.match(grid, /data-highlighted/);
  assert.match(grid, /aria-current/);
  assert.match(grid, /scrollIntoView/);
  assert.match(grid, /focus\(\{ preventScroll: true \}\)/);
  assert.match(mapPanel, /focusSelectedId/);
  assert.match(mapPage, /searchParams\.get\("delivery"\)/);
  assert.match(mapPage, /router\.replace/);
});
