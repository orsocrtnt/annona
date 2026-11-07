"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { catalogApi } from "@/features/catalog/api";
import { useDeletePrice, useProducts, useUpsertPrice } from "@/features/catalog/hooks";
import { fr } from "@/lib/i18n/fr";
import { formatCents } from "@/lib/format/money";
import { parseEurosToCents } from "@/lib/validations/catalog";

const t = fr.merchants;

/** ADM-03 depuis la fiche client : prix spécifiques de ce client (même calcul que partout : RG-05). */
export function MerchantPricesPanel({ merchantId }: { merchantId: string }) {
  const prices = useQuery({ queryKey: ["catalog", "merchant-prices", merchantId], queryFn: () => catalogApi.prices({ merchantId }) });
  const products = useProducts();
  const upsert = useUpsertPrice();
  const remove = useDeletePrice();
  const [productId, setProductId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = (products.data ?? []).find((product) => product.id === productId);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const priceCents = parseEurosToCents(price);
    if (!productId) return setError(t.chooseProduct);
    if (priceCents === null) return setError("Saisissez un prix, par exemple 0,95.");
    setError(null);
    upsert.mutate(
      { merchantId, productId, priceCents },
      {
        onSuccess: () => {
          toast.success(fr.catalog.specificPriceSaved);
          setProductId("");
          setPrice("");
        },
        onError: (mutationError) => toast.error(mutationError.message),
      }
    );
  };

  const rows = [...(prices.data ?? [])].sort((a, b) => a.productName.localeCompare(b.productName, "fr"));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.prices}</CardTitle>
        <CardDescription>{t.pricesHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{prices.isLoading ? "…" : t.noPrices}</p>
        ) : (
          <ul className="divide-y rounded-lg border" data-testid="merchant-price-list">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{row.productName}</span>
                <span className="text-xs text-muted-foreground line-through tabular-nums">{formatCents(row.basePriceCents)}</span>
                <span className="font-medium tabular-nums">{formatCents(row.priceCents)}</span>
                <Button
                  type="button" variant="ghost" size="icon-sm" aria-label={`${fr.common.delete} le prix de ${row.productName}`}
                  loading={remove.isPending && remove.variables === row.id}
                  onClick={() => remove.mutate(row.id, { onSuccess: () => toast.success(fr.catalog.specificPriceRemoved), onError: (e) => toast.error(e.message) })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger aria-label={t.product}>
                <SelectValue placeholder={t.chooseProduct} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(products.data ?? []).filter((product) => product.active).map((product) => (
                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected ? <p className="mt-1 text-xs text-muted-foreground">{t.basePrice(formatCents(selected.basePriceCents))}</p> : null}
          </div>
          <Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0,95" aria-label={fr.catalog.specificPrice} className="sm:w-28" />
          <Button type="submit" variant="outline" loading={upsert.isPending}>{fr.catalog.addSpecificPrice}</Button>
        </form>
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
