"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { ProductRow } from "@/domains/catalog/catalog.types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as { error?: string; data?: T };
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const KEY = ["bakery", "products"] as const;

function Row({ product }: { product: ProductRow }) {
  const qc = useQueryClient();
  const [days, setDays] = useState(String(product.shelfLifeDays));
  const save = useMutation({
    mutationFn: () =>
      call<ProductRow>(`/api/bakery/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shelfLifeDays: Number(days) }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(`Durée de vente de ${product.name} enregistrée`);
    },
    onError: (failure: Error) => toast.error(failure.message),
  });
  const valid = /^\d+$/.test(days) && Number(days) >= 1 && Number(days) <= 60;
  return (
    <li className="flex flex-wrap items-center gap-3 px-3 py-3" data-testid={`bread-${product.name}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.categoryName} · {product.unit}</p>
      </div>
      <Input
        inputMode="numeric"
        className="h-11 w-20 text-right text-base tabular-nums"
        value={days}
        onChange={(event) => setDays(event.target.value.replace(/\D/g, ""))}
        aria-label={`Durée de vente de ${product.name} (jours)`}
      />
      <span className="text-sm text-muted-foreground">jour(s)</span>
      <Button type="button" variant="outline" loading={save.isPending} disabled={!valid || days === String(product.shelfLifeDays)} onClick={() => save.mutate()}>
        Enregistrer
      </Button>
    </li>
  );
}

/** Lot 2, demande 3 : le boulanger règle la durée de vente en boutique de chaque pain (jour de réception compris). */
export function BreadShelfLife() {
  const products = useQuery({ queryKey: KEY, queryFn: () => call<ProductRow[]>("/api/bakery/products") });
  if (products.isLoading && !products.data) return <PageSkeleton />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Durée de vente des produits de production</h1>
        <p className="mt-1 text-muted-foreground">Nombre de jours de vente en point de vente, jour de réception compris (1 = vendu le jour même).</p>
      </div>
      {products.error ? <p role="alert" className="text-sm text-error">{products.error.message}</p> : null}
      <ul className="divide-y rounded-xl border bg-card">
        {(products.data ?? []).map((product) => <Row key={`${product.id}-${product.shelfLifeDays}`} product={product} />)}
      </ul>
    </div>
  );
}
