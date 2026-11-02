import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_DELIVERY_OPTIONS } from "../src/domains/company/company-settings.service";
import { getAdminEditableOrderStatuses } from "../src/lib/constants/order-status";
import { createClientOrderSchema } from "../src/lib/validations/order";

test("SPECIAL-1 : la catégorie reste désactivée par défaut", () => {
  assert.equal(DEFAULT_DELIVERY_OPTIONS.deliveryCategories.SPECIAL_MISSION, false);
});

test("SPECIAL-1 : la demande exige une description et au moins une adresse complète", () => {
  const missing = createClientOrderSchema.safeParse({
    deliveryCategory: "SPECIAL_MISSION",
    missionDescription: "Trop court",
    stops: [],
    items: [],
  });
  assert.equal(missing.success, false);
  if (!missing.success) {
    const paths = missing.error.issues.map((issue) => issue.path.join("."));
    assert.ok(paths.includes("missionDescription"));
    assert.ok(paths.includes("stops"));
  }

  const incompleteStop = createClientOrderSchema.safeParse({
    deliveryCategory: "SPECIAL_MISSION",
    missionDescription: "Transporter du mobilier fragile entre trois sites",
    stops: [{ address: "1 rue A", city: "", postalCode: "75" }],
    items: [],
  });
  assert.equal(incompleteStop.success, false);
  if (!incompleteStop.success) {
    const paths = incompleteStop.error.issues.map((issue) => issue.path.join("."));
    assert.ok(paths.includes("stops.0.city"));
    assert.ok(paths.includes("stops.0.postalCode"));
  }
});

test("SPECIAL-1 : les adresses valides conservent leur ordre et sont normalisées", () => {
  const parsed = createClientOrderSchema.parse({
    deliveryCategory: "SPECIAL_MISSION",
    missionDescription: "Transporter du mobilier fragile entre trois sites",
    stops: [
      { label: "Départ", address: " 1 rue A ", city: " Paris ", postalCode: " 75001 " },
      { label: "Étape", address: " 2 rue B ", city: " Paris ", postalCode: " 75002 " },
      { label: "Arrivée", address: " 3 rue C ", city: " Paris ", postalCode: " 75003 " },
    ],
    items: [],
  });
  assert.deepEqual(
    parsed.stops?.map((stop) => [stop.label, stop.address, stop.city, stop.postalCode]),
    [
      ["Départ", "1 rue A", "Paris", "75001"],
      ["Étape", "2 rue B", "Paris", "75002"],
      ["Arrivée", "3 rue C", "Paris", "75003"],
    ]
  );
});

test("SPECIAL-1 : une demande de devis ne propose que conserver, convertir ou annuler", () => {
  assert.deepEqual(
    getAdminEditableOrderStatuses("QUOTE_REQUESTED", "SPECIAL_MISSION"),
    ["QUOTE_REQUESTED", "PENDING", "CANCELLED"]
  );
  assert.deepEqual(getAdminEditableOrderStatuses("PENDING", "SPECIAL_MISSION"), ["PENDING", "CANCELLED"]);
  assert.ok(getAdminEditableOrderStatuses("IN_DELIVERY", "SPECIAL_MISSION").includes("DELIVERED"));
});
