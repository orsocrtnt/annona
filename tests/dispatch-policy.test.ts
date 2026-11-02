import assert from "node:assert/strict";
import test from "node:test";
import {
  getAssignmentBlockReason,
  getCancellationBlockReason,
  getUnassignmentBlockReason,
} from "../src/domains/delivery/dispatch-policy";
import {
  getDriverEligibilityReasons,
  isOnlySoftIneligibility,
  splitEligibilityReasons,
} from "../src/lib/dispatch/driver-eligibility";
import {
  DEFAULT_DISPATCH_SETTINGS,
  normalizeDispatchDriverRule,
  type CompanyDispatchSettings,
} from "../src/lib/validations/dispatch-settings";

test("affectation : seules les livraisons en attente ou assignées avant départ sont modifiables", () => {
  assert.equal(
    getAssignmentBlockReason({ status: "PENDING", driverId: null, missionStartedAt: null }),
    null
  );
  assert.equal(
    getAssignmentBlockReason({ status: "ASSIGNED", driverId: "driver-a", missionStartedAt: null }),
    null
  );
  assert.equal(
    getAssignmentBlockReason({
      status: "ASSIGNED",
      driverId: "driver-a",
      missionStartedAt: "2026-10-09T08:00:00.000Z",
    }),
    "DELIVERY_MISSION_STARTED"
  );
  assert.equal(
    getAssignmentBlockReason({ status: "PURCHASING", driverId: "driver-a", missionStartedAt: null }),
    "DELIVERY_MISSION_STARTED"
  );
  assert.equal(
    getAssignmentBlockReason({ status: "DELIVERED", driverId: "driver-a", missionStartedAt: null }),
    "DELIVERY_NOT_ASSIGNABLE"
  );
  assert.equal(
    getAssignmentBlockReason({ status: "CANCELLED", driverId: null, missionStartedAt: null }),
    "DELIVERY_CANCELLED"
  );
});

test("affectation : les combinaisons statut/livreur incohérentes déclenchent un conflit", () => {
  assert.equal(
    getAssignmentBlockReason({ status: "PENDING", driverId: "driver-a", missionStartedAt: null }),
    "DELIVERY_STATUS_CONFLICT"
  );
  assert.equal(
    getAssignmentBlockReason({ status: "ASSIGNED", driverId: null, missionStartedAt: null }),
    "DELIVERY_STATUS_CONFLICT"
  );
});

test("désaffectation : elle est idempotente avant affectation et interdite après démarrage", () => {
  assert.equal(
    getUnassignmentBlockReason({ status: "PENDING", driverId: null, missionStartedAt: null }),
    null
  );
  assert.equal(
    getUnassignmentBlockReason({ status: "ASSIGNED", driverId: "driver-a", missionStartedAt: null }),
    null
  );
  assert.equal(
    getUnassignmentBlockReason({
      status: "ASSIGNED",
      driverId: "driver-a",
      missionStartedAt: "2026-10-09T08:00:00.000Z",
    }),
    "DELIVERY_MISSION_STARTED"
  );
  assert.equal(
    getUnassignmentBlockReason({ status: "IN_DELIVERY", driverId: "driver-a", missionStartedAt: null }),
    "DELIVERY_MISSION_STARTED"
  );
});

test("annulation : une mission démarrée exige un motif et un état terminal reste protégé", () => {
  const active = { status: "IN_DELIVERY" as const, driverId: "driver-a", missionStartedAt: null };
  assert.equal(getCancellationBlockReason(active), "CANCELLATION_REASON_REQUIRED");
  assert.equal(getCancellationBlockReason(active, "Client absent"), null);
  assert.equal(
    getCancellationBlockReason({ status: "PENDING", driverId: null, missionStartedAt: null }),
    null
  );
  assert.equal(
    getCancellationBlockReason({ status: "DELIVERED", driverId: "driver-a", missionStartedAt: null }),
    "DELIVERY_NOT_CANCELLABLE"
  );
  assert.equal(
    getCancellationBlockReason({ status: "CANCELLED", driverId: null, missionStartedAt: null }),
    null
  );
});

function settingsFor(
  rule: Parameters<typeof normalizeDispatchDriverRule>[0],
  maxActiveDeliveriesPerDriver = 3
): CompanyDispatchSettings {
  return {
    ...DEFAULT_DISPATCH_SETTINGS,
    maxActiveDeliveriesPerDriver,
    driverRules: [normalizeDispatchDriverRule(rule)],
  };
}

const standardDelivery = {
  deliveryCategory: "STANDARD" as const,
  postalCode: "75009",
  pickupPostalCode: null,
};

test("éligibilité : pause, catégorie et zone sont des règles dures non forçables", () => {
  const paused = getDriverEligibilityReasons(
    { id: "driver-a" },
    standardDelivery,
    settingsFor({ driverId: "driver-a", priority: 1, dispatchStatus: "PAUSED" }),
    []
  );
  assert.deepEqual(paused, ["DISPATCH_PAUSED"]);
  assert.deepEqual(splitEligibilityReasons(paused), { soft: [], hard: ["DISPATCH_PAUSED"] });
  assert.equal(isOnlySoftIneligibility(paused), false);

  const category = getDriverEligibilityReasons(
    { id: "driver-a" },
    standardDelivery,
    settingsFor({
      driverId: "driver-a",
      priority: 1,
      allowedCategories: { STANDARD: false, COURIER: true, SPECIAL_MISSION: true },
    }),
    []
  );
  assert.deepEqual(category, ["CATEGORY_NOT_ALLOWED"]);
  assert.equal(isOnlySoftIneligibility(category), false);

  const zone = getDriverEligibilityReasons(
    { id: "driver-a" },
    standardDelivery,
    settingsFor({ driverId: "driver-a", priority: 1, postalCodePrefixes: ["69"] }),
    []
  );
  assert.deepEqual(zone, ["ZONE_NOT_COVERED"]);
  assert.equal(isOnlySoftIneligibility(zone), false);
});

test("éligibilité : seule une limite de capacité peut être forcée", () => {
  const capacityOnly = getDriverEligibilityReasons(
    { id: "driver-a", assigned: 1 },
    standardDelivery,
    settingsFor({ driverId: "driver-a", priority: 1 }, 1),
    []
  );
  assert.deepEqual(capacityOnly, ["MAX_LOAD_REACHED"]);
  assert.deepEqual(splitEligibilityReasons(capacityOnly), {
    soft: ["MAX_LOAD_REACHED"],
    hard: [],
  });
  assert.equal(isOnlySoftIneligibility(capacityOnly), true);

  const mixed = getDriverEligibilityReasons(
    { id: "driver-a", assigned: 1 },
    standardDelivery,
    settingsFor({ driverId: "driver-a", priority: 1, dispatchStatus: "PAUSED" }, 1),
    []
  );
  assert.deepEqual(mixed, ["DISPATCH_PAUSED", "MAX_LOAD_REACHED"]);
  assert.equal(isOnlySoftIneligibility(mixed), false);
});
