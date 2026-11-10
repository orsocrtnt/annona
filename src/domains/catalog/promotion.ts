/**
 * Lot 1, demande 2 — règles pures des promotions (utilisables côté navigateur).
 *
 * - Prix promo = prix saisi, ou prix de base du produit diminué du pourcentage (arrondi au centime).
 * - Une promotion est en cours jusqu'à sa date de fin incluse (fuseau de l'entreprise), tant qu'elle
 *   n'a pas été arrêtée et que la quantité limitée (tous clients confondus) n'est pas atteinte.
 * - Le client paie le moins cher de son prix normal (prix négocié ou de base) et du prix promo : une
 *   promotion plus chère que son prix négocié ne lui est ni montrée ni appliquée.
 * - Au-delà de la quantité restante, les unités sont au prix normal (la 51ᵉ d'une limite de 50).
 */

export type PromotionState = "ACTIVE" | "ENDED" | "STOPPED" | "SOLD_OUT";

export interface PromotionTerms {
  promoPriceCents: number | null;
  discountPercent: number | null;
}

/** Prix promo HT d'un produit, avant comparaison avec le prix négocié du client. */
export function promotionPriceCents(terms: PromotionTerms, basePriceCents: number): number {
  if (typeof terms.promoPriceCents === "number") return terms.promoPriceCents;
  const percent = terms.discountPercent ?? 0;
  return Math.round((basePriceCents * (100 - percent)) / 100);
}

/** État d'une promotion à la date `today` (« AAAA-MM-JJ ») avec `used` unités déjà retenues. */
export function promotionState(
  promotion: { endsOn: string; stoppedAt: Date | string | null; quantityLimit: number | null },
  today: string,
  used: number
): PromotionState {
  if (promotion.stoppedAt) return "STOPPED";
  if (promotion.endsOn < today) return "ENDED";
  if (promotion.quantityLimit !== null && used >= promotion.quantityLimit) return "SOLD_OUT";
  return "ACTIVE";
}

/** Unités encore disponibles ; `null` = sans limite. */
export function remainingQuantity(quantityLimit: number | null, used: number): number | null {
  return quantityLimit === null ? null : Math.max(0, quantityLimit - used);
}

/** Unités d'une ligne au prix promo, compte tenu de la quantité restante. */
export function promoQuantityFor(quantity: number, remaining: number | null): number {
  return Math.max(0, remaining === null ? quantity : Math.min(quantity, remaining));
}

/** La promotion s'adresse-t-elle à ce client ? */
export function promotionTargets(promotion: { allMerchants: boolean; merchantIds: readonly string[] }, merchantId: string): boolean {
  return promotion.allMerchants || promotion.merchantIds.includes(merchantId);
}
