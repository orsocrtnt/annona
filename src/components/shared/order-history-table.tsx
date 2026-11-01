"use client";

import * as React from "react";
import { Download, FilterX, Search, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MOBILE_CARDS_QUERY } from "@/lib/table/mobile-cards";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { FULFILLMENT_STATUS_LABELS } from "@/lib/constants/order-status";
import {
  orderHistorySearchParams,
  ORDER_HISTORY_PAGE_SIZES,
  type OrderHistoryPage,
  type OrderHistoryQuery,
} from "@/lib/query/order-history";
import type { DeliveryCategory, OrderStatus } from "@prisma/client";
import type { TableColumn } from "@/types";

const ALL_STATUSES = Object.keys(FULFILLMENT_STATUS_LABELS) as OrderStatus[];
const ALL_CATEGORIES = Object.keys(DELIVERY_CATEGORY_LABELS) as DeliveryCategory[];

interface OrderHistoryTableProps<T extends Record<string, unknown>> {
  result?: OrderHistoryPage<T>;
  columns: TableColumn<T>[];
  query: OrderHistoryQuery;
  onQueryChange: React.Dispatch<React.SetStateAction<OrderHistoryQuery>>;
  exportPath: string;
  loading?: boolean;
  statusOptions?: OrderStatus[];
  searchPlaceholder?: string;
  emptyTitle: string;
  emptyDescription: string;
}

const MOBILE_ROWS = 8;

export function OrderHistoryTable<T extends Record<string, unknown>>({
  result,
  columns,
  query,
  onQueryChange,
  exportPath,
  loading = false,
  statusOptions = ALL_STATUSES,
  searchPlaceholder = "Référence, client, adresse…",
  emptyTitle,
  emptyDescription,
}: OrderHistoryTableProps<T>) {
  const [search, setSearch] = React.useState(query.search ?? "");
  // Téléphone : recherche seule, filtres et export derrière un bouton, 8 cartes puis « Afficher plus ».
  const isMobile = useMediaQuery(MOBILE_CARDS_QUERY);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [mobileLimit, setMobileLimit] = React.useState(MOBILE_ROWS);
  const showFilters = !isMobile || filtersOpen;
  const activeFilters = [query.status, query.category, query.from, query.to].filter(Boolean).length;
  const items = result?.items ?? [];
  const shownItems = isMobile ? items.slice(0, mobileLimit) : items;

  React.useEffect(() => {
    const normalized = search.trim();
    if (normalized === (query.search ?? "")) return;
    const timeout = window.setTimeout(() => {
      onQueryChange((current) => ({ ...current, page: 1, search: normalized || undefined }));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [onQueryChange, query.search, search]);

  const change = (partial: Partial<OrderHistoryQuery>) => {
    onQueryChange((current) => ({ ...current, ...partial, page: 1 }));
  };
  const clearFilters = () => {
    setSearch("");
    onQueryChange((current) => ({
      page: 1,
      pageSize: current.pageSize,
      history: current.history,
    }));
  };
  const exportQuery = orderHistorySearchParams(query, { includePage: false });
  const exportHref = `${exportPath}${exportQuery.size ? `?${exportQuery}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 max-md:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(16rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label="Rechercher dans l'historique"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="md:hidden"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal /> Filtres{activeFilters > 0 ? ` (${activeFilters})` : ""}
        </Button>
        {showFilters && <div className="contents max-md:col-span-2 max-md:grid max-md:gap-3">
        <Select value={query.status ?? "all"} onValueChange={(value) => change({ status: value === "all" ? undefined : value as OrderStatus })}>
          <SelectTrigger aria-label="Filtrer par statut"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {statusOptions.map((status) => <SelectItem key={status} value={status}>{FULFILLMENT_STATUS_LABELS[status]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={query.category ?? "all"} onValueChange={(value) => change({ category: value === "all" ? undefined : value as DeliveryCategory })}>
          <SelectTrigger aria-label="Filtrer par type"><SelectValue placeholder="Tous les types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {ALL_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{DELIVERY_CATEGORY_LABELS[category]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={clearFilters} type="button"><FilterX /> Effacer</Button>
        </div>}
      </div>

      {showFilters && <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted-foreground">
          Du
          <Input type="date" value={query.from ?? ""} onChange={(event) => change({ from: event.target.value || undefined })} className="mt-1 w-auto" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Au
          <Input type="date" value={query.to ?? ""} min={query.from} onChange={(event) => change({ to: event.target.value || undefined })} className="mt-1 w-auto" />
        </label>
        <Select value={String(query.pageSize)} onValueChange={(value) => change({ pageSize: Number(value) as 25 | 50 | 100 })}>
          <SelectTrigger className="w-36" aria-label="Résultats par page"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ORDER_HISTORY_PAGE_SIZES.map((size) => <SelectItem key={size} value={String(size)}>{size} par page</SelectItem>)}
          </SelectContent>
        </Select>
        <Button asChild variant="outline" className="sm:ml-auto">
          <a href={exportHref} download><Download /> Exporter tout le résultat</a>
        </Button>
      </div>}

      <DataGrid
        data={shownItems}
        columns={columns}
        searchable={false}
        paginate={false}
        showResultCount={false}
        loading={loading && !result}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
      {shownItems.length < items.length && (
        <Button type="button" variant="outline" className="w-full" onClick={() => setMobileLimit((limit) => limit + MOBILE_ROWS)}>
          Afficher plus
        </Button>
      )}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            {result.total} résultat{result.total > 1 ? "s" : ""} · page {result.page} sur {result.totalPages}
            {loading && <span role="status" className="ml-2 text-xs">Actualisation…</span>}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={!result.hasPreviousPage || loading} onClick={() => onQueryChange((current) => ({ ...current, page: current.page - 1 }))}>
              <ChevronLeft /> Précédente
            </Button>
            <Button variant="outline" size="sm" disabled={!result.hasNextPage || loading} onClick={() => onQueryChange((current) => ({ ...current, page: current.page + 1 }))}>
              Suivante <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
