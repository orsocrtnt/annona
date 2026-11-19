/**
 * Lot 2, demande 7 — règles pures de la clôture du soir (sans base, utilisables par la tablette pour l'aperçu).
 *
 * Pour un produit et un jour :
 * 1. disponible = stock du matin (lots reçus avant ce jour) + reçu en bon état ce jour ;
 * 2. vendus = disponible − reste du soir (« ventes calculées ») ; les plus anciens partent en premier ;
 * 3. les produits abîmés en boutique (comptés dans le reste) sont jetés, en commençant par les plus anciens ;
 * 4. un lot qui atteint son dernier jour de vente est à jeter ; la vendeuse confirme la quantité jetée.
 *
 * Exemple du document : éclair vendu 2 jours. Lundi : 10 reçus, 3 restent, 7 vendus. Mardi : 10 reçus, 13 en
 * stock ; 11 restent, 2 vendus, pris dans le lot du lundi ; il en reste 1, à son dernier jour : à jeter. Les 10
 * du mardi restent en stock.
 */

export interface StockLot {
  id: string;
  /** « AAAA-MM-JJ ». */
  receivedOn: string;
  lastSaleDay: string;
  quantity: number;
}

export interface ClosePlan {
  morningStock: number;
  receivedGood: number;
  available: number;
  sold: number;
  /** Abîmés en boutique, jetés. */
  discardedDamaged: number;
  /** Quantité arrivée au dernier jour de vente et encore là : la tablette demande de la jeter. */
  expiring: number;
  /** Quantité jetée pour fin de vente (confirmée par la vendeuse, au plus `expiring`). */
  discardedExpired: number;
  /** Quantités des lots après la clôture, par identifiant. */
  lotsAfter: Map<string, number>;
  /** Stock gardé pour le lendemain. */
  kept: number;
}

export class StockRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

/** « AAAA-MM-JJ » + n jours. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Dernier jour de vente d'un lot : jour de réception compris (durée 2 = reçu lundi, vendu lundi et mardi). */
export function lastSaleDayOf(receivedOn: string, shelfLifeDays: number): string {
  return addDays(receivedOn, Math.max(1, shelfLifeDays) - 1);
}

/** Retire `quantity` des lots, les plus anciens d'abord (et, entre lots du même jour, dans l'ordre donné). */
function takeOldestFirst(lots: StockLot[], left: Map<string, number>, quantity: number, filter: (lot: StockLot) => boolean = () => true) {
  let rest = quantity;
  for (const lot of lots) {
    if (rest === 0) break;
    if (!filter(lot)) continue;
    const have = left.get(lot.id) ?? 0;
    const taken = Math.min(have, rest);
    left.set(lot.id, have - taken);
    rest -= taken;
  }
  return quantity - rest;
}

/**
 * Clôture d'un produit pour `date`. `remaining` = reste compté le soir (abîmés compris) ; `damaged` = abîmés en
 * boutique parmi ce reste ; `discardExpired` = quantité en fin de vente que la vendeuse confirme jeter (par
 * défaut, tout ce qui est en fin de vente).
 */
export function planClose(
  date: string,
  lotsInput: readonly StockLot[],
  input: { remaining: number; damaged?: number; discardExpired?: number | null }
): ClosePlan {
  const lots = lotsInput
    .filter((lot) => lot.receivedOn <= date)
    .slice()
    .sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.lastSaleDay.localeCompare(b.lastSaleDay));
  const morningStock = lots.filter((lot) => lot.receivedOn < date).reduce((sum, lot) => sum + lot.quantity, 0);
  const receivedGood = lots.filter((lot) => lot.receivedOn === date).reduce((sum, lot) => sum + lot.quantity, 0);
  const available = morningStock + receivedGood;
  const remaining = input.remaining;
  const damaged = input.damaged ?? 0;
  if (!Number.isInteger(remaining) || remaining < 0) throw new StockRuleError("Le reste du soir est un nombre entier positif.", "REMAINING_INVALID");
  if (remaining > available) {
    throw new StockRuleError(`Le reste (${remaining}) dépasse le stock de la journée (${available}).`, "REMAINING_TOO_HIGH");
  }
  if (!Number.isInteger(damaged) || damaged < 0 || damaged > remaining) {
    throw new StockRuleError("Les produits abîmés font partie du reste du soir.", "DAMAGED_INVALID");
  }
  const left = new Map(lots.map((lot) => [lot.id, lot.quantity]));
  const sold = available - remaining;
  takeOldestFirst(lots, left, sold);
  takeOldestFirst(lots, left, damaged);
  const isExpiring = (lot: StockLot) => lot.lastSaleDay <= date;
  const expiring = lots.filter(isExpiring).reduce((sum, lot) => sum + (left.get(lot.id) ?? 0), 0);
  const discardedExpired = input.discardExpired === undefined || input.discardExpired === null ? expiring : input.discardExpired;
  if (!Number.isInteger(discardedExpired) || discardedExpired < 0 || discardedExpired > expiring) {
    throw new StockRuleError(`Au plus ${expiring} produit(s) en fin de vente à jeter.`, "DISCARD_INVALID");
  }
  takeOldestFirst(lots, left, discardedExpired, isExpiring);
  const kept = [...left.values()].reduce((sum, quantity) => sum + quantity, 0);
  return { morningStock, receivedGood, available, sold, discardedDamaged: damaged, expiring, discardedExpired, lotsAfter: left, kept };
}

/** Quantité d'un ensemble de lots qui sera à jeter ce soir-là si elle n'est pas vendue. */
export function expiringOn(date: string, lots: readonly StockLot[]): number {
  return lots.filter((lot) => lot.receivedOn <= date && lot.lastSaleDay <= date).reduce((sum, lot) => sum + lot.quantity, 0);
}
