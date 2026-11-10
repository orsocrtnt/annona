/**
 * Prix appliqué (RG-05, ADM-03, critère de recette 3) : source unique du calcul.
 *
 * Prix appliqué = prix spécifique du commerçant s'il existe, sinon prix de base du produit.
 * Lot 1, demande 2 : une ligne peut en plus porter une part au prix promo (`promoQuantity`), retenue à
 * la validation par `promotion.service.ts` ; `computeTotals` et `lineAmountCents` en tiennent compte.
 * Catalogue client, panier, totaux, recopie de commande et, plus tard, verrouillage (prix figé)
 * et factures passent tous par `resolveUnitPrice` ou `loadAppliedPrices` : aucun autre code ne
 * choisit entre prix de base et prix spécifique.
 *
 * Montants en centimes HT ; TVA en points de base (550 = 5,5 %).
 */
import type { Prisma, PrismaClient } from "@prisma/client";

export interface PricedProduct {
  id: string;
  basePriceCents: number;
  vatRateBasisPoints: number;
}

export interface AppliedPrice {
  unitPriceCents: number;
  vatRateBasisPoints: number;
  /** Vrai quand le prix vient d'un prix spécifique du commerçant (RG-05). */
  isSpecific: boolean;
}

/** RG-05 : prix spécifique du commerçant s'il existe, sinon prix de base. */
export function resolveUnitPrice(
  product: Pick<PricedProduct, "basePriceCents">,
  specificPriceCents?: number | null
): number {
  return typeof specificPriceCents === "number" ? specificPriceCents : product.basePriceCents;
}

/** Prix appliqués d'une liste de produits pour un commerçant, à partir de ses prix spécifiques. */
export function applyPrices(
  products: readonly PricedProduct[],
  specificPrices: ReadonlyArray<{ productId: string; priceCents: number }>
): Map<string, AppliedPrice> {
  const specific = new Map(specificPrices.map((row) => [row.productId, row.priceCents]));
  return new Map(
    products.map((product) => {
      const specificPrice = specific.get(product.id);
      return [
        product.id,
        {
          unitPriceCents: resolveUnitPrice(product, specificPrice),
          vatRateBasisPoints: product.vatRateBasisPoints,
          isSpecific: specificPrice !== undefined,
        },
      ];
    })
  );
}

type PricingDb = Pick<PrismaClient | Prisma.TransactionClient, "product" | "merchantPrice">;

/**
 * Charge les prix appliqués d'un commerçant, bornés à son entreprise (PLA-01).
 * `productIds` absent : tout le catalogue de l'entreprise.
 */
export async function loadAppliedPrices(
  db: PricingDb,
  companyId: string,
  merchantId: string,
  productIds?: readonly string[]
): Promise<Map<string, AppliedPrice>> {
  const idFilter = productIds ? { id: { in: [...productIds] } } : {};
  const [products, specificPrices] = await Promise.all([
    db.product.findMany({
      where: { companyId, ...idFilter },
      select: { id: true, basePriceCents: true, vatRateBasisPoints: true },
    }),
    db.merchantPrice.findMany({
      where: { companyId, merchantId, ...(productIds ? { productId: { in: [...productIds] } } : {}) },
      select: { productId: true, priceCents: true },
    }),
  ]);
  return applyPrices(products, specificPrices);
}

export interface PricedLine {
  quantity: number;
  unitPriceCents: number;
  vatRateBasisPoints: number;
  /**
   * Lot 1, demande 2 : unités au prix promo (les premières de la ligne), retenues à la validation.
   * Absent ou 0 : toute la ligne au prix `unitPriceCents`.
   */
  promoQuantity?: number | null;
  promoUnitPriceCents?: number | null;
}

/**
 * Lot 1, demande 2 : unités de la ligne payées au prix promo. Jamais plus que la quantité (livrée ou
 * commandée) ; aucune si le prix promo n'est pas strictement plus bas que le prix normal de la ligne
 * (« il paie le moins cher des deux prix »).
 */
export function promoUnits(line: PricedLine): number {
  const promoPrice = line.promoUnitPriceCents;
  if (!line.promoQuantity || typeof promoPrice !== "number" || promoPrice >= line.unitPriceCents) return 0;
  return Math.max(0, Math.min(line.promoQuantity, line.quantity));
}

/** Montant HT d'une ligne : part promo au prix promo, le reste au prix normal. */
export function lineAmountCents(line: PricedLine): number {
  const promo = promoUnits(line);
  return promo * (line.promoUnitPriceCents ?? 0) + (line.quantity - promo) * line.unitPriceCents;
}

export interface OrderTotals {
  /** Total HT. */
  subtotalCents: number;
  vatCents: number;
  /** Total TTC. */
  totalCents: number;
  itemCount: number;
}

/** Totaux HT, TVA (arrondie par taux) et TTC d'un ensemble de lignes au prix appliqué. */
export function computeTotals(lines: readonly PricedLine[]): OrderTotals {
  const byRate = new Map<number, number>();
  let subtotalCents = 0;
  let itemCount = 0;
  for (const line of lines) {
    const lineTotal = lineAmountCents(line);
    subtotalCents += lineTotal;
    itemCount += line.quantity;
    byRate.set(line.vatRateBasisPoints, (byRate.get(line.vatRateBasisPoints) ?? 0) + lineTotal);
  }
  let vatCents = 0;
  for (const [rate, base] of byRate) vatCents += Math.round((base * rate) / 10_000);
  return { subtotalCents, vatCents, totalCents: subtotalCents + vatCents, itemCount };
}

/**
 * Prix appliqués de plusieurs commerçants en un aller-retour (verrouillage LOCK-1, listes du
 * back-office) : même règle `resolveUnitPrice`, bornée à l'entreprise (PLA-01).
 * Renvoie, par commerçant, la table produit → prix appliqué.
 */
export async function loadAppliedPricesByMerchant(
  db: PricingDb,
  companyId: string,
  merchantIds: readonly string[],
  productIds: readonly string[]
): Promise<Map<string, Map<string, AppliedPrice>>> {
  const result = new Map<string, Map<string, AppliedPrice>>();
  if (merchantIds.length === 0 || productIds.length === 0) {
    for (const merchantId of merchantIds) result.set(merchantId, new Map());
    return result;
  }
  const [products, specificPrices] = await Promise.all([
    db.product.findMany({
      where: { companyId, id: { in: [...productIds] } },
      select: { id: true, basePriceCents: true, vatRateBasisPoints: true },
    }),
    db.merchantPrice.findMany({
      where: { companyId, merchantId: { in: [...merchantIds] }, productId: { in: [...productIds] } },
      select: { merchantId: true, productId: true, priceCents: true },
    }),
  ]);
  for (const merchantId of merchantIds) {
    result.set(merchantId, applyPrices(products, specificPrices.filter((row) => row.merchantId === merchantId)));
  }
  return result;
}
