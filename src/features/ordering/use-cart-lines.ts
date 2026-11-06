"use client";

import { useMemo } from "react";
import type { PortalCatalog, PortalProduct } from "@/domains/order/merchant-order.types";
import { computeTotals } from "@/domains/catalog/pricing";
import { useCartStore } from "@/features/ordering/cart-store";

export interface CartLine {
  product: PortalProduct;
  categoryName: string;
  quantity: number;
  lineTotalCents: number;
}

/** Lignes du panier au prix appliqué du catalogue (RG-05) et totaux (calcul unique `computeTotals`). */
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
      lines.push({ ...entry, quantity, lineTotalCents: quantity * entry.product.unitPriceCents });
    }
    // Ordre du catalogue.
    const order = [...byId.keys()];
    lines.sort((a, b) => order.indexOf(a.product.id) - order.indexOf(b.product.id));
    const totals = computeTotals(
      lines.map((line) => ({ quantity: line.quantity, unitPriceCents: line.product.unitPriceCents, vatRateBasisPoints: line.product.vatRateBasisPoints }))
    );
    return { lines, totals, unavailable, byId };
  }, [catalog, quantities]);
}
