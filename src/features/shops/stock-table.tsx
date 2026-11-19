"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StockView } from "@/domains/shop/shop-stock.service";
import { longDay, shopCall } from "@/features/shops/shop-client";

const dash = (value: number | null) => (value === null ? "—" : value);

/**
 * Lot 2, demande 8 — « Stock boutiques » : pour chaque boutique et chaque produit, le stock, les quantités à jeter
 * ce soir et, pour le jour consulté (la veille par défaut), reçus, abîmés à la livraison, vendus et jetés. Une
 * boutique ou toutes ; jours passés consultables. `endpoint` : `/api/stock` (administration, laboratoire) ou
 * `/api/shop/stock` (la vendeuse, sa boutique seulement).
 */
export function StockTable({ endpoint, title = "Stock boutiques", showShopFilter = true }: { endpoint: string; title?: string; showShopFilter?: boolean }) {
  const [date, setDate] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string>("ALL");
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (showShopFilter && shopId !== "ALL") query.set("shopId", shopId);
  const stock = useQuery({ queryKey: ["stock", endpoint, date, shopId], queryFn: () => shopCall<StockView>(`${endpoint}?${query.toString()}`) });
  const all = useQuery({ queryKey: ["stock", endpoint, "shops"], queryFn: () => shopCall<StockView>(endpoint), enabled: showShopFilter });
  const shops = [...new Map((all.data?.rows ?? []).map((row) => [row.shopId, row.shopName])).entries()];
  const data = stock.data;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Boxes className="h-6 w-6 text-brand" aria-hidden /> {title}</h1>
        <p className="mt-1 text-muted-foreground">Stock et produits à jeter ce soir ; reçus, abîmés, vendus et jetés du jour choisi.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {showShopFilter ? (
          <Select value={shopId} onValueChange={setShopId}>
            <SelectTrigger className="h-10 w-56" aria-label="Boutique">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Toutes les boutiques</SelectItem>
              {shops.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          Jour consulté
          <Input type="date" className="h-10 w-44" value={date ?? data?.date ?? ""} max={data?.today} onChange={(event) => setDate(event.target.value || null)} />
        </label>
        {data ? <span className="text-sm text-muted-foreground">{longDay(data.date)}</span> : null}
      </div>
      {stock.isLoading && !data ? <PageSkeleton /> : null}
      {stock.error ? <p role="alert" className="text-sm text-error">{stock.error.message}</p> : null}
      {data && data.rows.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Aucun stock en boutique.</p> : null}
      {data && data.rows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table data-testid="stock-table">
            <TableHeader>
              <TableRow>
                {showShopFilter ? <TableHead>Boutique</TableHead> : null}
                <TableHead>Produit</TableHead>
                <TableHead className="text-right">En stock</TableHead>
                <TableHead className="text-right">À jeter ce soir</TableHead>
                <TableHead className="text-right">Reçus</TableHead>
                <TableHead className="text-right">Abîmés livraison</TableHead>
                <TableHead className="text-right">Vendus</TableHead>
                <TableHead className="text-right">Jetés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={`${row.shopId}-${row.productId}`} data-testid={`stock-${row.shopName}-${row.productName}`}>
                  {showShopFilter ? <TableCell>{row.shopName}</TableCell> : null}
                  <TableCell className="font-medium">{row.productName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.inStock}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.toDiscardTonight || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{dash(row.day.received)}</TableCell>
                  <TableCell className="text-right tabular-nums">{dash(row.day.damagedOnDelivery)}</TableCell>
                  <TableCell className="text-right tabular-nums">{dash(row.day.sold)}</TableCell>
                  <TableCell className="text-right tabular-nums">{dash(row.day.discarded)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
