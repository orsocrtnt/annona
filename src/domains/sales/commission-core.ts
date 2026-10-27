import { createHash } from "node:crypto";

export const SALES_COMMISSION_RATE_BPS = {
  REFERRER: 1_500,
  ASSISTED: 2_500,
  AUTONOMOUS: 3_500,
} as const;

export type SalesCommissionLevel = keyof typeof SALES_COMMISSION_RATE_BPS;

export type SalesAttributionSnapshot = {
  schemaVersion: 1;
  sellerReference: string;
  level: SalesCommissionLevel;
  rateBps: number;
  attributedAt: string;
  eligibleUntil: string;
  initialContractHash: string;
  eligibleLines: Array<{
    code: string;
    name: string;
    quantity: number;
    unitHtCents: number;
  }>;
};

export type SalesSettlement = {
  key: string;
  receivedAt: Date;
  status: "PAID" | "OPEN" | "VOID" | "UNCOLLECTIBLE";
  reason: "subscription_create" | "subscription_cycle" | "subscription_update" | "subscription_usage";
  currency: "EUR";
  paidHtCents: number;
  lines: Array<{ code: string; paidHtCents: number }>;
};

export type TheoreticalCommission = {
  entryKey: string;
  settlementKey: string;
  eligible: boolean;
  explanation: "ELIGIBLE" | "NOT_PAID" | "OUTSIDE_WINDOW" | "LATER_CHANGE_OR_USAGE";
  eligibleHtCents: number;
  rateBps: number;
  commissionCents: number;
};

const MAX_CENTS = 99_999_999;

function assertDate(value: Date, code: string) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error(code);
}

function boundedText(value: string, max: number, code: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) throw new Error(code);
  return normalized;
}

function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new Error("SALES_COMMISSION_AMOUNT_INVALID");
  }
  return value;
}

export function addUtcMonths(date: Date, months: number) {
  const targetMonth = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetYear,
    normalizedMonth,
    Math.min(date.getUTCDate(), lastDay),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds()
  ));
}

export function createSalesAttributionSnapshot(input: {
  sellerReference: string;
  level: SalesCommissionLevel;
  startsAt: Date;
  initialContractHash: string;
  initialLines: Array<{ code: string; name: string; quantity: number; unitHtCents: number }>;
}): SalesAttributionSnapshot {
  assertDate(input.startsAt, "SALES_ATTRIBUTION_DATE_INVALID");
  const sellerReference = boundedText(input.sellerReference, 160, "SALES_SELLER_REFERENCE_INVALID");
  const initialContractHash = boundedText(input.initialContractHash, 160, "SALES_CONTRACT_HASH_INVALID");
  const seenCodes = new Set<string>();
  const eligibleLines = input.initialLines.map((line) => {
    const code = boundedText(line.code, 120, "SALES_LINE_INVALID");
    const name = boundedText(line.name, 160, "SALES_LINE_INVALID");
    if (seenCodes.has(code) || !Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new Error("SALES_LINE_INVALID");
    }
    seenCodes.add(code);
    cents(line.unitHtCents);
    cents(line.quantity * line.unitHtCents);
    return { code, name, quantity: line.quantity, unitHtCents: line.unitHtCents };
  });
  if (eligibleLines.length === 0) throw new Error("SALES_LINE_INVALID");

  return {
    schemaVersion: 1,
    sellerReference,
    level: input.level,
    rateBps: SALES_COMMISSION_RATE_BPS[input.level],
    attributedAt: input.startsAt.toISOString(),
    eligibleUntil: addUtcMonths(input.startsAt, 12).toISOString(),
    initialContractHash,
    eligibleLines,
  };
}

function emptyCommission(
  attribution: SalesAttributionSnapshot,
  settlement: SalesSettlement,
  explanation: Exclude<TheoreticalCommission["explanation"], "ELIGIBLE">
): TheoreticalCommission {
  return {
    entryKey: commissionEntryKey(attribution, settlement.key),
    settlementKey: settlement.key,
    eligible: false,
    explanation,
    eligibleHtCents: 0,
    rateBps: attribution.rateBps,
    commissionCents: 0,
  };
}

export function commissionEntryKey(attribution: SalesAttributionSnapshot, settlementKey: string) {
  return createHash("sha256")
    .update(`${attribution.initialContractHash}:${boundedText(settlementKey, 160, "SALES_SETTLEMENT_KEY_INVALID")}`)
    .digest("hex");
}

export function calculateTheoreticalCommission(
  attribution: SalesAttributionSnapshot,
  settlement: SalesSettlement
): TheoreticalCommission {
  assertDate(settlement.receivedAt, "SALES_SETTLEMENT_DATE_INVALID");
  cents(settlement.paidHtCents);
  if (settlement.currency !== "EUR") throw new Error("SALES_COMMISSION_CURRENCY_INVALID");

  const seenCodes = new Set<string>();
  let describedPaidHtCents = 0;
  const paidByCode = new Map<string, number>();
  for (const line of settlement.lines) {
    const code = boundedText(line.code, 120, "SALES_SETTLEMENT_LINE_INVALID");
    if (seenCodes.has(code)) throw new Error("SALES_SETTLEMENT_LINE_INVALID");
    seenCodes.add(code);
    describedPaidHtCents = cents(describedPaidHtCents + cents(line.paidHtCents));
    paidByCode.set(code, line.paidHtCents);
  }
  if (describedPaidHtCents !== settlement.paidHtCents) {
    throw new Error("SALES_SETTLEMENT_LINES_MISMATCH");
  }

  if (settlement.status !== "PAID") return emptyCommission(attribution, settlement, "NOT_PAID");
  const receivedAt = settlement.receivedAt.getTime();
  if (receivedAt < Date.parse(attribution.attributedAt) || receivedAt >= Date.parse(attribution.eligibleUntil)) {
    return emptyCommission(attribution, settlement, "OUTSIDE_WINDOW");
  }
  if (settlement.reason !== "subscription_create" && settlement.reason !== "subscription_cycle") {
    return emptyCommission(attribution, settlement, "LATER_CHANGE_OR_USAGE");
  }

  let eligibleHtCents = 0;
  for (const line of attribution.eligibleLines) {
    const initialMaximum = cents(line.quantity * line.unitHtCents);
    eligibleHtCents = cents(eligibleHtCents + Math.min(initialMaximum, paidByCode.get(line.code) ?? 0));
  }
  const numerator = eligibleHtCents * attribution.rateBps;
  if (!Number.isSafeInteger(numerator) || numerator % 10_000 !== 0) {
    throw new Error("SALES_COMMISSION_ROUNDING_RULE_REQUIRED");
  }

  return {
    entryKey: commissionEntryKey(attribution, settlement.key),
    settlementKey: settlement.key,
    eligible: true,
    explanation: "ELIGIBLE",
    eligibleHtCents,
    rateBps: attribution.rateBps,
    commissionCents: numerator / 10_000,
  };
}
