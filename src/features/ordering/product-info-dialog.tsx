"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { allergenLabel, allergenSummary } from "@/domains/catalog/allergens";
import type { PortalProduct } from "@/domains/order/merchant-order.types";
import { ProductThumb } from "@/features/catalog/product-thumb";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

/** Lot 1, demande 3 : le client touche un produit du catalogue et voit la liste de ses allergènes. */
export function ProductInfoDialog({ product, onClose }: { product: PortalProduct | null; onClose: () => void }) {
  return (
    <Dialog open={product !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      {product ? (
        <DialogContent className="sm:max-w-md" data-testid="product-info">
          <DialogHeader>
            <DialogTitle className="pr-8">{product.name}</DialogTitle>
            <DialogDescription>
              {formatCents(product.unitPriceCents)} {fr.common.exclVat} · {product.unit}
            </DialogDescription>
          </DialogHeader>
          <ProductThumb productId={product.id} photoVersion={product.photoVersion} className="h-40 w-full rounded-xl" />
          <section aria-labelledby="product-allergens-title" className="space-y-2">
            <h3 id="product-allergens-title" className="text-sm font-semibold">{fr.order.allergens}</h3>
            {product.allergens && product.allergens.length > 0 ? (
              <ul className="flex flex-wrap gap-2" data-testid="product-allergens">
                {product.allergens.map((code) => (
                  <li key={code} className="rounded-full border bg-muted px-3 py-1 text-sm">{allergenLabel(code)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground" data-testid="product-allergens">{allergenSummary(product.allergens)}</p>
            )}
          </section>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}
