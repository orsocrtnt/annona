import assert from "node:assert/strict";
import test from "node:test";
import {
  SALES_COMMISSION_RATE_BPS,
  calculateTheoreticalCommission,
  createSalesAttributionSnapshot,
  type SalesCommissionLevel,
  type SalesSettlement,
} from "../src/domains/sales/commission-core";

const startsAt = new Date("2026-01-31T12:30:00.000Z");

function attribution(level: SalesCommissionLevel = "REFERRER") {
  return createSalesAttributionSnapshot({
    sellerReference: "seller-internal-01",
    level,
    startsAt,
    initialContractHash: "contract-initial-01",
    initialLines: [
      { code: "plan:STARTER", name: "Starter", quantity: 1, unitHtCents: 7_900 },
      { code: "AUTO_DISPATCH", name: "Dispatch automatique", quantity: 1, unitHtCents: 2_900 },
    ],
  });
}

function settlement(patch: Partial<SalesSettlement> = {}): SalesSettlement {
  return {
    key: "invoice-01",
    receivedAt: new Date("2026-02-01T00:00:00.000Z"),
    status: "PAID",
    reason: "subscription_create",
    currency: "EUR",
    paidHtCents: 12_000,
    lines: [
      { code: "plan:STARTER", paidHtCents: 7_900 },
      { code: "AUTO_DISPATCH", paidHtCents: 2_900 },
      { code: "LATER_OPTION", paidHtCents: 1_200 },
    ],
    ...patch,
  };
}

test("SALES-1 : les trois niveaux figent 15/25/35 % et une fenêtre de douze mois", () => {
  assert.deepEqual(SALES_COMMISSION_RATE_BPS, {
    REFERRER: 1_500,
    ASSISTED: 2_500,
    AUTONOMOUS: 3_500,
  });
  for (const level of Object.keys(SALES_COMMISSION_RATE_BPS) as SalesCommissionLevel[]) {
    const snapshot = attribution(level);
    assert.equal(snapshot.rateBps, SALES_COMMISSION_RATE_BPS[level]);
    assert.equal(snapshot.attributedAt, "2026-01-31T12:30:00.000Z");
    assert.equal(snapshot.eligibleUntil, "2027-01-31T12:30:00.000Z");
  }
});

test("SALES-1 : seuls les montants HT encaissés des lignes initiales produisent la commission théorique", () => {
  const result = calculateTheoreticalCommission(attribution("REFERRER"), settlement());
  assert.deepEqual({
    eligible: result.eligible,
    explanation: result.explanation,
    eligibleHtCents: result.eligibleHtCents,
    rateBps: result.rateBps,
    commissionCents: result.commissionCents,
  }, {
    eligible: true,
    explanation: "ELIGIBLE",
    eligibleHtCents: 10_800,
    rateBps: 1_500,
    commissionCents: 1_620,
  });
  assert.equal(result.entryKey, calculateTheoreticalCommission(attribution("REFERRER"), settlement()).entryKey);
});

test("SALES-1 : une quantité ajoutée du même produit reste plafonnée à la vente initiale", () => {
  const result = calculateTheoreticalCommission(attribution("ASSISTED"), settlement({
    paidHtCents: 13_700,
    lines: [
      { code: "plan:STARTER", paidHtCents: 7_900 },
      { code: "AUTO_DISPATCH", paidHtCents: 5_800 },
    ],
  }));
  assert.equal(result.eligibleHtCents, 10_800);
  assert.equal(result.commissionCents, 2_700);
});

test("SALES-1 : impayé, changement, usage et borne exacte des douze mois ne commissionnent pas", () => {
  assert.equal(calculateTheoreticalCommission(attribution(), settlement({ status: "OPEN" })).explanation, "NOT_PAID");
  assert.equal(calculateTheoreticalCommission(attribution(), settlement({ reason: "subscription_update" })).explanation, "LATER_CHANGE_OR_USAGE");
  assert.equal(calculateTheoreticalCommission(attribution(), settlement({ reason: "subscription_usage" })).explanation, "LATER_CHANGE_OR_USAGE");
  assert.equal(calculateTheoreticalCommission(attribution(), settlement({
    receivedAt: new Date("2027-01-31T12:30:00.000Z"),
  })).explanation, "OUTSIDE_WINDOW");
});

test("SALES-1 : aucune allocation ou règle d'arrondi non décidée n'est inventée", () => {
  assert.throws(
    () => calculateTheoreticalCommission(attribution(), settlement({ paidHtCents: 1 })),
    /SALES_SETTLEMENT_LINES_MISMATCH/
  );
  const oneCent = createSalesAttributionSnapshot({
    sellerReference: "seller-rounding",
    level: "REFERRER",
    startsAt,
    initialContractHash: "contract-rounding",
    initialLines: [{ code: "plan:TEST", name: "Test", quantity: 1, unitHtCents: 1 }],
  });
  assert.throws(
    () => calculateTheoreticalCommission(oneCent, settlement({
      paidHtCents: 1,
      lines: [{ code: "plan:TEST", paidHtCents: 1 }],
    })),
    /SALES_COMMISSION_ROUNDING_RULE_REQUIRED/
  );
});
