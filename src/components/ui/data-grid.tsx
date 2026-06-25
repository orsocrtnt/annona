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

interface DataGridProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKey?: keyof T;
  pageSize?: number;
  paginate?: boolean;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
  tableClassName?: string;
  onRowClick?: (row: T) => void;
}

export function DataGrid<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = true,
  searchPlaceholder = "Rechercher...",
  searchKey,
  pageSize = 10,
  paginate = true,
  loading = false,
  emptyTitle = "Aucune donnée",
  emptyDescription = "Aucun élément à afficher pour le moment.",
  className,
  tableClassName,
  onRowClick,
}: DataGridProps<T>) {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");

  const filtered = React.useMemo(() => {
    let result = [...data];
    if (search && searchKey) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        String(row[searchKey]).toLowerCase().includes(q)
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
  }, [data, search, searchKey, sortKey, sortDir]);

  const totalPages = paginate ? Math.ceil(filtered.length / pageSize) : 1;
  const paginated = paginate
    ? filtered.slice(page * pageSize, (page + 1) * pageSize)
    : filtered;

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
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => handleSort(String(col.key))}
                        >
                          {col.header}
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((row, i) => (
                  <TableRow
                    key={i}
                    className={onRowClick ? "cursor-pointer" : undefined}
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
                ))}
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
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            filtered.length > 0 && (
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
