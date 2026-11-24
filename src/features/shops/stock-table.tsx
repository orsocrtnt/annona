"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StockView } from "@/domains/shop/shop-stock.service";
import { groupStockByShop } from "@/domains/shop/stock-groups";
import { longDay, shopCall } from "@/features/shops/shop-client";

const dash = (value: number | null) => (value === null ? "—" : value);


/**
 * Lot 2, demande 8 — « Stock boutiques » : pour chaque boutique et chaque produit, le stock, les quantités à jeter
 * ce soir et, pour le jour consulté (la veille par défaut), reçus, abîmés à la livraison, vendus et jetés. Une
 * boutique ou toutes ; jours passés consultables. `endpoint` : `/api/stock` (administration, laboratoire) ou
 * `/api/shop/stock` (la vendeuse, sa boutique seulement).
 */
export function StockTable({ endpoint, title = "Stock des points de vente", showShopFilter = true }: { endpoint: string; title?: string; showShopFilter?: boolean }) {
  const [date, setDate] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string>("ALL");
  const query = new URLSearchParams();
  if (date) query.set("date", date);
  if (showShopFilter && shopId !== "ALL") query.set("shopId", shopId);
  const stock = useQuery({ queryKey: ["stock", endpoint, date, shopId], queryFn: () => shopCall<StockView>(`${endpoint}?${query.toString()}`) });
  const all = useQuery({ queryKey: ["stock", endpoint, "shops"], queryFn: () => shopCall<StockView>(endpoint), enabled: showShopFilter });
  const shops = [...new Map((all.data?.rows ?? []).map((row) => [row.shopId, row.shopName])).entries()];
  const data = stock.data;
  const [search, setSearch] = useState("");
  const groups = groupStockByShop(data?.rows ?? [], search);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Boxes className="h-6 w-6 text-brand" aria-hidden /> {title}</h1>
        <p className="mt-1 text-muted-foreground">Stock et produits à jeter ce soir ; reçus, abîmés, vendus et jetés du jour choisi.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {showShopFilter ? (
          <Select value={shopId} onValueChange={setShopId}>
            <SelectTrigger className="h-10 w-56" aria-label="Point de vente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les points de vente</SelectItem>
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
      {data && data.rows.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">Aucun stock en point de vente.</p> : null}
      {data && data.rows.length > 0 ? (
        <Input
          type="search"
          className="h-10 max-w-sm"
          placeholder="Chercher un produit"
          aria-label="Chercher un produit"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
      {data && data.rows.length > 0 && groups.length === 0 ? <p className="text-muted-foreground">Aucun produit ne correspond.</p> : null}
      {groups.map((group) => (
        <section key={group.shopId} className="overflow-hidden rounded-xl border bg-card" data-testid={`stock-shop-${group.shopName}`}>
          <header className="flex flex-wrap items-baseline justify-between gap-2 border-b bg-muted/40 px-4 py-3">
            <h2 className="text-lg font-semibold">{group.shopName}</h2>
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums font-medium text-foreground">{group.inStock}</span> en stock
              {group.toDiscard > 0 ? (
                <> · <span className="tabular-nums font-semibold text-error">{group.toDiscard}</span> à jeter ce soir</>
              ) : null}
            </p>
          </header>
          <div className="overflow-x-auto">
            <Table data-testid="stock-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead className="text-right">En stock</TableHead>
                  <TableHead className="text-right">À jeter ce soir</TableHead>
                  <TableHead className="border-l text-right">Reçus</TableHead>
                  <TableHead className="text-right">Abîmés</TableHead>
                  <TableHead className="text-right">Vendus</TableHead>
                  <TableHead className="text-right">Jetés</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.rows.map((row) => (
                  <TableRow
                    key={`${row.shopId}-${row.productId}`}
                    data-testid={`stock-${row.shopName}-${row.productName}`}
                    className={row.inStock === 0 ? "text-muted-foreground" : undefined}
                  >
                    <TableCell className="font-medium">{row.productName}</TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums">{row.inStock}</TableCell>
                    <TableCell className={`text-right tabular-nums ${row.toDiscardTonight ? "font-semibold text-error" : ""}`}>{row.toDiscardTonight || "—"}</TableCell>
                    <TableCell className="border-l text-right tabular-nums">{dash(row.day.received)}</TableCell>
                    <TableCell className="text-right tabular-nums">{dash(row.day.damagedOnDelivery)}</TableCell>
                    <TableCell className="text-right tabular-nums">{dash(row.day.sold)}</TableCell>
                    <TableCell className="text-right tabular-nums">{dash(row.day.discarded)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
      {groups.length > 0 && data ? (
        <p className="text-xs text-muted-foreground">Reçus, abîmés à la livraison, vendus et jetés : chiffres du {longDay(data.date)}.</p>
      ) : null}
    </div>
  );
}
