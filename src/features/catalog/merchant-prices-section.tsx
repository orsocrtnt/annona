"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProductRow } from "@/features/catalog/api";
import { useDeletePrice, useMerchantChoices, useProductPrices, useUpsertPrice } from "@/features/catalog/hooks";
import { fr } from "@/lib/i18n/fr";
import { formatCents } from "@/lib/format/money";
import { parseEurosToCents } from "@/lib/validations/catalog";

const t = fr.catalog;

/** ADM-03 / RG-05 : prix spécifiques d'un produit (liste, ajout ou remplacement, suppression). */
export function MerchantPricesSection({ product }: { product: ProductRow }) {
  const prices = useProductPrices(product.id);
  const merchants = useMerchantChoices(true);
  const upsert = useUpsertPrice();
  const remove = useDeletePrice();
  const [merchantId, setMerchantId] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const priceCents = parseEurosToCents(price);
    if (!merchantId) return setError(t.chooseMerchant);
    if (priceCents === null) return setError("Saisissez un prix, par exemple 0,95.");
    setError(null);
    upsert.mutate(
      { merchantId, productId: product.id, priceCents },
      {
        onSuccess: () => {
          toast.success(t.specificPriceSaved);
          setMerchantId("");
          setPrice("");
        },
        onError: (mutationError) => toast.error(mutationError.message),
      }
    );
  };

  const rows = prices.data ?? [];

  return (
    <section className="space-y-3" aria-labelledby="specific-prices-title">
      <div>
        <h3 id="specific-prices-title" className="text-sm font-semibold">{t.specificPrices}</h3>
        <p className="text-xs text-muted-foreground">
          {t.specificPricesHint} {t.basePrice.replace(" (€)", "")} : {formatCents(product.basePriceCents)}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{prices.isLoading ? "…" : t.noSpecificPrice}</p>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="specific-price-list">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{row.merchantName}</span>
              <span className="font-medium tabular-nums">{formatCents(row.priceCents)}</span>
              <Button
                type="button" variant="ghost" size="icon-sm" aria-label={`${fr.common.delete} le prix de ${row.merchantName}`}
                loading={remove.isPending && remove.variables === row.id}
                onClick={() => remove.mutate(row.id, { onSuccess: () => toast.success(t.specificPriceRemoved), onError: (e) => toast.error(e.message) })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <Select value={merchantId} onValueChange={setMerchantId}>
            <SelectTrigger aria-label={t.merchant}>
              <SelectValue placeholder={t.chooseMerchant} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {(merchants.data ?? []).map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="0,95"
          aria-label={t.specificPrice}
          className="sm:w-28"
        />
        <Button type="submit" variant="outline" loading={upsert.isPending}>{t.addSpecificPrice}</Button>
      </form>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </section>
  );
}
