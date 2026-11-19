"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Store, Truck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { ShipmentDay, ShipmentShop } from "@/domains/shop/shipment.service";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as { error?: string; data?: T };
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

/** Date du jour + `offset` jours, en « AAAA-MM-JJ », à l'heure de Paris. */
function parisDate(offset: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d! + offset));
  return date.toISOString().slice(0, 10);
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y!, m! - 1, d!)));
}

function ShopShipment({ shop, day, family }: { shop: ShipmentShop; day: ShipmentDay; family: "BREAD" | "PASTRY" }) {
  const qc = useQueryClient();
  const initial = useMemo(() => new Map(shop.lines.map((line) => [line.productId, String(line.quantity)])), [shop.lines]);
  const [quantities, setQuantities] = useState<Map<string, string>>(initial);
  const save = useMutation({
    mutationFn: () =>
      call<ShipmentShop>("/api/shipments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: day.date,
          shopId: shop.id,
          lines: day.products.map((product) => ({ productId: product.id, quantity: Number(quantities.get(product.id) || 0) })).filter((line) => line.quantity > 0),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shipments"] });
      toast.success(`Envoi vers ${shop.name} enregistré`, { description: "Il apparaît sur l'arrêt de la boutique dans la tournée du matin." });
    },
    onError: (failure: Error) => toast.error(failure.message),
  });
  const total = day.products.reduce((sum, product) => sum + Number(quantities.get(product.id) || 0), 0);
  const disabled = !shop.editable || Boolean(shop.blockedReason);
  return (
    <Card data-testid={`shipment-${shop.name}`}>
      <CardHeader className="space-y-1 pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          <Store className="h-5 w-5 text-brand" aria-hidden /> {shop.name}
          {!shop.editable ? (
            <Badge variant="outline"><Lock className="mr-1 h-3 w-3" aria-hidden /> Tournée partie</Badge>
          ) : null}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {shop.zoneName ? `Tournée ${shop.zoneName}, livraison du matin` : "Sans tournée"}
          {shop.otherFamilyItemCount > 0 ? ` · ${shop.otherFamilyItemCount} ${family === "PASTRY" ? "pains" : "pâtisseries"} déjà sur le même envoi` : ""}
        </p>
        {shop.blockedReason ? <p role="alert" className="text-sm text-error">{shop.blockedReason}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {day.products.map((product) => (
            <li key={product.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{product.name}</p>
                <p className="text-xs text-muted-foreground">{product.categoryName} · {product.unit}</p>
              </div>
              <Input
                inputMode="numeric"
                className="h-11 w-24 text-right text-base tabular-nums"
                placeholder="0"
                disabled={disabled}
                value={quantities.get(product.id) ?? ""}
                onChange={(event) => setQuantities((current) => new Map(current).set(product.id, event.target.value.replace(/\D/g, "")))}
                aria-label={`${product.name} pour ${shop.name}`}
              />
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{total} article(s)</p>
          <Button type="button" variant="brand" size="lg" loading={save.isPending} disabled={disabled} onClick={() => save.mutate()}>
            <Truck className="h-4 w-4" /> Enregistrer l&apos;envoi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Lot 2, demande 5 — envois du jour vers les boutiques : le pâtissier envoie la pâtisserie, le boulanger le pain,
 * sur le même arrêt de la boutique. Modifiable jusqu'au départ de la tournée.
 */
export function ShipmentsContent({ family }: { family: "BREAD" | "PASTRY" }) {
  const [date, setDate] = useState(() => parisDate(1));
  const day = useQuery({ queryKey: ["shipments", date], queryFn: () => call<ShipmentDay>(`/api/shipments?date=${date}`) });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Envois aux boutiques</h1>
        <p className="mt-1 text-muted-foreground">
          {family === "PASTRY" ? "Pâtisseries" : "Pain"} envoyés chaque matin aux boutiques, sans commande de leur part. Modifiable jusqu&apos;au départ de la tournée.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2].map((offset) => {
          const value = parisDate(offset);
          return (
            <Button key={offset} type="button" variant={date === value ? "brand" : "outline"} onClick={() => setDate(value)}>
              {offset === 0 ? "Aujourd'hui" : offset === 1 ? "Demain" : "Après-demain"}
            </Button>
          );
        })}
        <Input type="date" className="h-10 w-44" value={date} min={parisDate(0)} onChange={(event) => event.target.value && setDate(event.target.value)} aria-label="Date d'envoi" />
        <span className="text-sm text-muted-foreground">{longDate(date)}</span>
      </div>
      {day.isLoading && !day.data ? <PageSkeleton /> : null}
      {day.error ? <p role="alert" className="text-sm text-error">{day.error.message}</p> : null}
      {day.data && day.data.shops.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Aucune boutique : l&apos;administrateur les crée dans « Boutiques ».</p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {(day.data?.shops ?? []).map((shop) => (
          <ShopShipment key={`${day.data!.date}-${shop.id}-${shop.lines.map((line) => `${line.productId}:${line.quantity}`).join(",")}-${shop.editable}`} shop={shop} day={day.data!} family={family} />
        ))}
      </div>
    </div>
  );
}
