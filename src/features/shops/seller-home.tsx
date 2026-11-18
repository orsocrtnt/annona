"use client";

import { MapPin, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useMyShop } from "@/features/shops/api";

/**
 * Lot 2, demande 1 — tablette de la boutique : la vendeuse ne voit que sa boutique (vérification 2).
 * La réception du matin (demande 6), la clôture du soir (demande 7), les commandes de gâteaux (demande 9)
 * et « Produits et prix » (demande 4) s'ajouteront ici.
 */
export function SellerHome() {
  const shop = useMyShop();
  if (shop.isLoading && !shop.data) return <PageSkeleton />;
  if (shop.error) return <p role="alert" className="text-base text-error">{shop.error.message}</p>;
  const data = shop.data;
  if (!data) return null;
  return (
    <div className="space-y-6" data-testid="seller-home">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-brand">Ma boutique</p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <Store className="h-7 w-7 text-brand" aria-hidden /> {data.name}
        </h1>
        <p className="mt-2 flex items-start gap-1.5 text-base text-muted-foreground">
          <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden />
          {[data.address, [data.postalCode, data.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bientôt sur cette tablette</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-base text-muted-foreground">
          <p>La réception de la livraison du matin, la clôture du soir et les commandes de gâteaux arrivent avec les prochaines étapes.</p>
        </CardContent>
      </Card>
    </div>
  );
}
