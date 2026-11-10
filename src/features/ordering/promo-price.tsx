import { badgeVariants } from "@/components/ui/badge";
import type { PortalProduct } from "@/domains/order/merchant-order.types";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

/**
 * Lot 1, demande 2 : prix d'un produit du catalogue client. En promotion : étiquette « Promo », ancien
 * prix barré, nouveau prix. Sinon : prix appliqué (négocié ou de base).
 */
export function ProductPrice({ product, className }: { product: PortalProduct; className?: string }) {
  if (!product.promo) {
    return (
      <span className={cn("font-semibold text-foreground tabular-nums", className)} data-testid="portal-product-price">
        {formatCents(product.unitPriceCents)}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-1.5", className)}>
      <span className={cn(badgeVariants({ variant: "warning" }), "self-center")} data-testid="portal-product-promo">{fr.promotions.badge}</span>
      <s className="tabular-nums" data-testid="portal-product-old-price" aria-label={`Ancien prix ${formatCents(product.unitPriceCents)}`}>
        {formatCents(product.unitPriceCents)}
      </s>
      <span className="font-semibold text-foreground tabular-nums" data-testid="portal-product-price">{formatCents(product.promo.unitPriceCents)}</span>
    </span>
  );
}
