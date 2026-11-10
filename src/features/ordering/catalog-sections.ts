import type { PortalCategory, PortalProduct } from "@/domains/order/merchant-order.types";
import { fr } from "@/lib/i18n/fr";

export const PROMO_SECTION_ID = "promotions";

/**
 * Sections de l'écran « Commander » (CLI-03), filtrées par la recherche. Lot 1, demande 2 : les produits
 * en promotion pour ce client passent en tête, dans une section « Promotions », et quittent leur catégorie.
 */
export function catalogSections(categories: readonly PortalCategory[], query: string): PortalCategory[] {
  const needle = query.trim().toLocaleLowerCase("fr");
  const matches = (product: PortalProduct) => !needle || product.name.toLocaleLowerCase("fr").includes(needle);
  const promotions = categories.flatMap((category) => category.products.filter((product) => product.promo && matches(product)));
  const sections = categories
    .map((category) => ({ ...category, products: category.products.filter((product) => !product.promo && matches(product)) }))
    .filter((category) => category.products.length > 0);
  return promotions.length > 0 ? [{ id: PROMO_SECTION_ID, name: fr.promotions.section, products: promotions }, ...sections] : sections;
}
