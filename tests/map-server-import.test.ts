import assert from "node:assert/strict";
import test from "node:test";

// Client components are evaluated during Next's server rendering too. Importing
// either entry must stay safe without a browser (Leaflet itself reads window).
test("MAP-1 : widgets du tableau de bord importables côté serveur sans window", async () => {
  assert.equal(typeof window, "undefined");
  const widgets = await import("../src/features/back-office/dashboard-map-widgets");
  assert.equal(typeof widgets.DriversMapWidget, "function");
  assert.equal(typeof widgets.DeliveriesMapWidget, "function");
});

test("MAP-1 : carte client importable côté serveur sans window", async () => {
  assert.equal(typeof window, "undefined");
  const portal = await import("../src/features/client-portal/portal-deliveries-map");
  assert.equal(typeof portal.PortalDeliveriesMap, "function");
});
