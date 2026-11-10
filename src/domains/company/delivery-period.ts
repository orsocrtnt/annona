/**
 * Lot 1, demande 1 — moments de livraison d'une tournée. Le client ne voit que « Matin » ou « Soir »,
 * sans heure ; le boulanger et l'administrateur voient « Sud matin », « Sud soir ». Module pur
 * (utilisable côté navigateur).
 */
export const DELIVERY_PERIODS = ["MORNING", "EVENING"] as const;
export type DeliveryPeriodValue = (typeof DELIVERY_PERIODS)[number];

/** « Matin » / « Soir » : seul libellé montré au client. */
export function periodLabel(period: DeliveryPeriodValue): string {
  return period === "MORNING" ? "Matin" : "Soir";
}

/** « Sud matin » : libellé du créneau d'une tournée (listes du boulanger, tournées du jour). */
export function zoneSlotLabel(zoneName: string, period: DeliveryPeriodValue): string {
  return `${zoneName} ${period === "MORNING" ? "matin" : "soir"}`;
}
