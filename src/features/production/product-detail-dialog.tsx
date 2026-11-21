"use client";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProductionProductDetail, ProductionTotalProduct } from "@/domains/production/production.types";

function pickup(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
}

/**
 * RETOURS-1 (tour de Théo, 21 novembre) : le pâtissier touche un produit du total (« Fraisier ») et voit pour qui
 * est chaque pièce : client ou boutique, particulier (nom, téléphone, retrait), taille, inscription, instructions
 * de la commande, allergènes déclarés du produit.
 */
export function ProductDetailDialog({
  product,
  detail,
  onClose,
}: {
  product: ProductionTotalProduct | null;
  detail: ProductionProductDetail | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={product !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {product ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {product.name} · <span className="tabular-nums">{product.quantity}</span>
              </DialogTitle>
              <DialogDescription>Pour qui est chaque pièce, avec ses instructions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1 text-sm" data-testid="product-detail-allergens">
              <span className="font-medium">Allergènes du produit : </span>
              {detail?.allergens === null || !detail ? (
                <span className="text-muted-foreground">non déclarés dans le catalogue</span>
              ) : detail.allergens.length === 0 ? (
                <span className="text-muted-foreground">aucun</span>
              ) : (
                <span className="inline-flex flex-wrap gap-1 align-middle">
                  {detail.allergens.map((label) => <Badge key={label} variant="warning">{label}</Badge>)}
                </span>
              )}
            </div>
            <ul className="space-y-3" data-testid="product-detail-recipients">
              {(detail?.recipients ?? []).map((row) => (
                <li key={row.lineId} className="space-y-1 rounded-xl border p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-base font-semibold">{row.customer ? row.customer.name : row.merchantName}</p>
                    <span className="text-lg font-semibold tabular-nums">× {row.quantity}</span>
                  </div>
                  {row.customer ? (
                    <p className="text-sm text-muted-foreground">
                      Particulier · <span className="whitespace-nowrap tabular-nums">{row.customer.phone}</span> · retrait {pickup(row.customer.pickupAt)} à {row.merchantName}
                    </p>
                  ) : null}
                  {row.servings ? <p className="text-sm">{row.servings} personnes</p> : null}
                  {row.inscription ? (
                    <p className="text-sm">
                      <span className="font-medium">Inscription : </span>
                      <span className="font-medium text-brand">« {row.inscription} »</span>
                    </p>
                  ) : null}
                  {row.note ? (
                    <p className="rounded-md bg-warning-subtle px-2 py-1 text-sm text-warning" data-testid="product-detail-note">
                      <span className="font-medium">Allergies / instructions : </span>
                      {row.note}
                    </p>
                  ) : null}
                  {row.notes ? (
                    <p className="text-sm">
                      <span className="font-medium">Pour toute la commande : </span>
                      {row.notes}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
