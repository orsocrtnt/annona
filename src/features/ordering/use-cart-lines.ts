"use client";

import { useMemo } from "react";
import type { PortalCatalog, PortalProduct } from "@/domains/order/merchant-order.types";
import { computeTotals, lineAmountCents, type PricedLine } from "@/domains/catalog/pricing";
import { promoQuantityFor } from "@/domains/catalog/promotion";
import { useCartStore } from "@/features/ordering/cart-store";

export interface CartLine {
  product: PortalProduct;
  categoryName: string;
  quantity: number;
  /** Lot 1, demande 2 : unités au prix promo (estimation ; le serveur les retient à la validation). */
  promoQuantity: number;
  lineTotalCents: number;
}

function priced(product: PortalProduct, quantity: number): PricedLine {
  return {
    quantity,
    unitPriceCents: product.unitPriceCents,
    vatRateBasisPoints: product.vatRateBasisPoints,
    promoQuantity: product.promo ? promoQuantityFor(quantity, product.promo.remaining) : 0,
    promoUnitPriceCents: product.promo?.unitPriceCents ?? null,
  };
}

/** Lignes du panier au prix appliqué du catalogue (RG-05), promotions comprises, et totaux (`computeTotals`). */
export function useCartLines(catalog: PortalCatalog | undefined) {
  const quantities = useCartStore((state) => state.quantities);
  return useMemo(() => {
    const byId = new Map<string, { product: PortalProduct; categoryName: string }>();
    for (const category of catalog?.categories ?? []) {
      for (const product of category.products) byId.set(product.id, { product, categoryName: category.name });
    }
    const lines: CartLine[] = [];
    let unavailable = 0;
    for (const [productId, quantity] of Object.entries(quantities)) {
      const entry = byId.get(productId);
      if (!entry) {
        unavailable += 1;
        continue;
      }
      const line = priced(entry.product, quantity);
      lines.push({ ...entry, quantity, promoQuantity: line.promoQuantity ?? 0, lineTotalCents: lineAmountCents(line) });
    }
    // Ordre du catalogue.
    const order = [...byId.keys()];
    lines.sort((a, b) => order.indexOf(a.product.id) - order.indexOf(b.product.id));
    const totals = computeTotals(lines.map((line) => priced(line.product, line.quantity)));
    return { lines, totals, unavailable, byId };
  }, [catalog, quantities]);
}
