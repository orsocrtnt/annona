import * as React from "react";
import { cn } from "@/lib/utils";
import type { TableColumn } from "@/types";
import { splitCardColumns } from "@/lib/table/mobile-cards";

interface DataGridCardsProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  getRowId?: (row: T) => string;
  highlightedRowId?: string | null;
  highlightedRowLabel?: string;
  highlightedRef?: React.Ref<HTMLLIElement>;
  onRowClick?: (row: T) => void;
}

function cellContent<T>(column: TableColumn<T>, row: T): React.ReactNode {
  return column.cell ? column.cell(row) : String((row as Record<string, unknown>)[column.key as string] ?? "");
}

/** Version « cartes » d'un DataGrid pour les écrans étroits : une carte par ligne, aucune colonne perdue. */
export function DataGridCards<T>({
  rows,
  columns,
  getRowId,
  highlightedRowId,
  highlightedRowLabel = "Élément ciblé",
  highlightedRef,
  onRowClick,
}: DataGridCardsProps<T>) {
  const { title, fields, actions } = splitCardColumns(columns);
  return (
    <ul className="space-y-3" data-testid="data-grid-cards">
      {rows.map((row, index) => {
        const rowId = getRowId?.(row);
        const highlighted = Boolean(rowId && rowId === highlightedRowId);
        return (
          <li
            key={rowId ?? index}
            ref={highlighted ? highlightedRef : undefined}
            tabIndex={highlighted ? -1 : undefined}
            aria-current={highlighted ? "true" : undefined}
            aria-label={highlighted ? highlightedRowLabel : undefined}
            data-highlighted={highlighted ? "true" : undefined}
            onClick={() => onRowClick?.(row)}
            className={cn(
              "min-w-0 space-y-3 break-words rounded-xl border border-border bg-card p-4 text-sm",
              onRowClick && "cursor-pointer",
              highlighted && "outline-none ring-2 ring-foreground dark:ring-brand"
            )}
          >
            {title ? <div className="min-w-0 text-base font-medium">{cellContent(title, row)}</div> : null}
            {fields.length > 0 ? (
              <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-2">
                {fields.map((column) => (
                  <React.Fragment key={String(column.key)}>
                    <dt className="text-xs text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0">{cellContent(column, row)}</dd>
                  </React.Fragment>
                ))}
              </dl>
            ) : null}
            {actions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {actions.map((column) => (
                  <React.Fragment key={String(column.key)}>{cellContent(column, row)}</React.Fragment>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
