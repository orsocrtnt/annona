"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "./table";
import { Input } from "./input";
import { Button } from "./button";
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from "lucide-react";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";
import type { TableColumn } from "@/types";
import { getHighlightedPage } from "@/lib/table/data-grid-focus";

interface DataGridProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKey?: keyof T;
  /** Texte cherché par ligne, quand une seule colonne ne suffit pas (client, adresse, référence…). */
  searchText?: (row: T) => string;
  pageSize?: number;
  paginate?: boolean;
  showResultCount?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  tableClassName?: string;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  highlightedRowId?: string | null;
  highlightedRowLabel?: string;
}

export function DataGrid<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Rechercher...",
  searchKey,
  searchText,
  pageSize = 10,
  paginate = true,
  showResultCount = true,
  loading = false,
  emptyTitle = "Aucune donnée",
  emptyDescription = "Aucun élément à afficher pour le moment.",
  className,
  tableClassName,
  onRowClick,
  getRowId,
  highlightedRowId,
  highlightedRowLabel = "Élément ciblé",
}: DataGridProps<T>) {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const highlightedRowRef = React.useRef<HTMLTableRowElement | null>(null);
  const lastFocusedRowId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!highlightedRowId) return;
    setSearch("");
  }, [highlightedRowId]);

  const filtered = React.useMemo(() => {
    let result = [...data];
    if (search && (searchText || searchKey)) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        (searchText ? searchText(row) : String(row[searchKey!])).toLowerCase().includes(q)
      );
    }
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = String(a[sortKey] ?? "");
        const bVal = String(b[sortKey] ?? "");
        const cmp = aVal.localeCompare(bVal);
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, searchKey, searchText, sortKey, sortDir]);

  const totalPages = paginate ? Math.ceil(filtered.length / pageSize) : 1;
  const targetPage = React.useMemo(
    () =>
      getHighlightedPage(
        getRowId ? filtered.map(getRowId) : [],
        highlightedRowId,
        pageSize
      ),
    [filtered, getRowId, highlightedRowId, pageSize]
  );

  React.useEffect(() => {
    if (paginate && targetPage !== null) setPage(targetPage);
  }, [paginate, targetPage]);

  const paginated = React.useMemo(
    () =>
      paginate
        ? filtered.slice(page * pageSize, (page + 1) * pageSize)
        : filtered,
    [filtered, page, pageSize, paginate]
  );
  const highlightedVisible = Boolean(
    highlightedRowId && getRowId && paginated.some((row) => getRowId(row) === highlightedRowId)
  );

  React.useEffect(() => {
    if (!highlightedRowId) {
      lastFocusedRowId.current = null;
      return;
    }
    if (!highlightedVisible) return;
    if (lastFocusedRowId.current === highlightedRowId) return;
    highlightedRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    highlightedRowRef.current?.focus({ preventScroll: true });
    lastFocusedRowId.current = highlightedRowId;
  }, [highlightedRowId, highlightedVisible]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const getColumnClassName = (col: TableColumn<T>) =>
    cn(col.className, col.hideOnMobile && "max-md:hidden");

  const hasMobileHiddenColumns = columns.some((col) => col.hideOnMobile);

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {searchable && (
        <div className="relative w-full max-w-sm max-md:max-w-none">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="pl-9"
          />
        </div>
      )}

      {paginated.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border max-md:-mx-1 max-md:overflow-x-auto">
            <Table className={cn("w-full text-xs", tableClassName ?? "table-fixed")}>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={String(col.key)} className={getColumnClassName(col)}>
                      {col.sortable ? (
                        <button
                          type="button"
                          aria-label={`Trier par ${col.header}${sortKey === String(col.key) ? `, ordre ${sortDir === "asc" ? "croissant" : "décroissant"}` : ""}`}
                          aria-pressed={sortKey === String(col.key)}
                          // Le bouton reprend la casse de l'en-tête (le reset navigateur la supprime).
                          className="-ml-1 inline-flex min-h-6 min-w-6 items-center gap-1 rounded px-1 uppercase tracking-wider hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1"
                          onClick={() => handleSort(String(col.key))}
                        >
                          {col.header}
                          <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((row, i) => {
                  const rowId = getRowId?.(row);
                  const highlighted = Boolean(rowId && rowId === highlightedRowId);
                  return (
                  <TableRow
                    key={rowId ?? i}
                    ref={highlighted ? highlightedRowRef : undefined}
                    tabIndex={highlighted ? -1 : undefined}
                    aria-current={highlighted ? "true" : undefined}
                    aria-label={highlighted ? highlightedRowLabel : undefined}
                    data-highlighted={highlighted ? "true" : undefined}
                    className={cn(
                      onRowClick && "cursor-pointer",
                      highlighted &&
                        "bg-zinc-50 shadow-[inset_4px_0_0_#111111] outline-none ring-2 ring-inset ring-black"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col) => (
                      <TableCell key={String(col.key)} className={getColumnClassName(col)}>
                        {col.cell
                          ? col.cell(row)
                          : String(row[col.key as keyof T] ?? "")}
                      </TableCell>
                    ))}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {hasMobileHiddenColumns && (
            <p className="text-xs text-muted-foreground md:hidden">
              Faites défiler horizontalement pour voir toutes les colonnes.
            </p>
          )}

          {paginate && totalPages > 1 ? (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Page précédente"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Page suivante"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            showResultCount && filtered.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}
