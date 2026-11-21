"use client";

import { MapPin, Store } from "lucide-react";
import Link from "next/link";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useMyShop } from "@/features/shops/api";

/**
 * Lot 2, demande 1 — tablette de la boutique : la vendeuse ne voit que sa boutique (vérification 2).
 * Raccourcis vers la réception du matin (demande 6), la clôture du soir (demande 7), le stock (demande 8) et
 * « Produits et prix » (demande 4).
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
      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { href: "/shop/reception", title: "Réception du matin", text: "Compter l'envoi du laboratoire : reçus et abîmés." },
          { href: "/shop/closing", title: "Clôture du soir", text: "Noter le reste ; ventes calculées, produits à jeter." },
          { href: "/shop/stock", title: "Stock", text: "Stock de la boutique et produits à jeter ce soir." },
          { href: "/shop/cakes", title: "Commandes de gâteaux", text: "Prendre la commande d'un client, marquer « soldée » au retrait." },
          { href: "/shop/settings", title: "Paramètres", text: "Produits et prix (code responsable)." },
        ].map((tile) => (
          <Link key={tile.href} href={tile.href} className="rounded-2xl border bg-card p-6 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <p className="text-xl font-semibold">{tile.title}</p>
            <p className="mt-1 text-base text-muted-foreground">{tile.text}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
