/** FACT-1 (RG-07) — statut de règlement calculé, jamais saisi : à régler, partiellement réglée, réglée. */
export type SettlementStatus = "TO_PAY" | "PARTIAL" | "PAID";

/** Statut de règlement à partir des montants (centimes). */
export function settlementStatus(totalCents: number, paidCents: number): SettlementStatus {
  if (paidCents >= totalCents) return "PAID";
  return paidCents > 0 ? "PARTIAL" : "TO_PAY";
}
