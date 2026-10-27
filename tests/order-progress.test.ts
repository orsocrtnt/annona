import assert from "node:assert/strict";
import test from "node:test";
import { orderProgress } from "../src/lib/orders/progress";

test("la frise place chaque statut sur la bonne étape", () => {
  const at = (status: string) => {
    const p = orderProgress(status);
    assert.equal(p.kind, "steps");
    return p.kind === "steps" ? p.current : -1;
  };
  assert.equal(at("PENDING"), 0);
  assert.equal(at("ASSIGNED"), 1);
  assert.equal(at("PURCHASING"), 2);
  assert.equal(at("IN_DELIVERY"), 2);
  assert.equal(at("DELIVERED"), 3);
  assert.equal(at("PAID"), 3, "facturée ou payée reste livrée");
});

test("annulée ou en échec : pas de frise, un état clair", () => {
  assert.deepEqual(orderProgress("CANCELLED"), { kind: "stopped", label: "Commande annulée", tone: "neutral" });
  assert.deepEqual(orderProgress("FAILED"), { kind: "stopped", label: "Échec de livraison", tone: "danger" });
});

test("libellés adaptés au type de mission", () => {
  const courier = orderProgress("IN_DELIVERY", "COURIER");
  assert.equal(courier.kind === "steps" && courier.steps[2]!.label, "Course en cours");
  const quote = orderProgress("QUOTE_REQUESTED", "SPECIAL_MISSION");
  assert.equal(quote.kind === "steps" && quote.steps[0]!.label, "Devis demandé");
});
