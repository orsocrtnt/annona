"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BellRing, CheckCircle2, Clock, Receipt, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/features/client-portal/utils";
import { useCompanyInvoices, useRemindInvoice } from "@/features/back-office/company-invoices-hooks";
import {
  invoiceRowStatusLabel,
  reminderOutcomeMessage,
  reminderResultLabel,
} from "@/features/back-office/company-payments-labels";
import type { CompanyInvoiceFilter, CompanyInvoiceRow } from "@/domains/invoice/company-invoices.service";
import { cn, formatDate } from "@/lib/utils";

const FILTERS: { key: CompanyInvoiceFilter; label: string }[] = [
  { key: "ALL", label: "Toutes" },
  { key: "PENDING", label: "En attente" },
  { key: "OVERDUE", label: "En retard" },
  { key: "PAID", label: "Payées" },
];

const TILES = [
  { key: "PAID", label: "Payées", icon: CheckCircle2, tone: "text-success bg-success-subtle" },
  { key: "PENDING", label: "En attente", icon: Clock, tone: "text-warning bg-warning-subtle" },
  { key: "OVERDUE", label: "En retard", icon: AlertTriangle, tone: "text-error bg-error-subtle" },
] as const;

const STATUS_VARIANT = {
  PAID: "success",
  PENDING: "warning",
  OVERDUE: "error",
  DRAFT: "secondary",
  CANCELLED: "secondary",
} as const;

const EMPTY_COPY: Record<CompanyInvoiceFilter, string> = {
  ALL: "Aucune facture émise pour l'instant. Elles apparaissent ici dès leur émission depuis une commande.",
  PENDING: "Aucune facture en attente de paiement.",
  OVERDUE: "Aucune facture en retard. Les factures échues passent ici automatiquement.",
  PAID: "Aucune facture payée pour l'instant.",
};

function ReminderLine({ row }: { row: CompanyInvoiceRow }) {
  if (!row.lastReminder) return null;
  const { label, tone } = reminderResultLabel(row.lastReminder.result);
  return (
    <p className={cn("text-xs", tone === "error" ? "text-error" : tone === "warning" ? "text-warning" : "text-muted-foreground")}>
      {label} · {formatDate(row.lastReminder.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
    </p>
  );
}

function InvoiceRow({ row, onRemind, reminding }: { row: CompanyInvoiceRow; onRemind: (row: CompanyInvoiceRow) => void; reminding: boolean }) {
  const outstanding = row.status === "PENDING" || row.status === "OVERDUE";
  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center",
        row.status === "OVERDUE" ? "border-error/30" : "border-border"
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{row.reference}</span>
          <Badge variant={STATUS_VARIANT[row.status]}>{invoiceRowStatusLabel(row)}</Badge>
        </div>
        <p className="truncate text-sm text-muted-foreground">
          {row.customerName ?? "Client supprimé"}
          {row.orderId && row.orderReference ? (
            <>
              {" · "}
              <Link href={`/dashboard/orders/${row.orderId}`} className="underline-offset-2 hover:underline">
                {row.orderReference}
              </Link>
            </>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {row.status === "PAID" && row.paidAt
            ? `Payée le ${formatDate(row.paidAt)}`
            : row.dueDate
              ? `Échéance le ${formatDate(row.dueDate)}`
              : "Sans échéance"}
        </p>
        <ReminderLine row={row} />
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-base font-semibold tabular-nums">{formatCurrency(row.amount)}</span>
        {outstanding && (
          <Button
            type="button"
            variant={row.status === "OVERDUE" ? "brand" : "outline"}
            className="min-h-11 min-w-[7.5rem]"
            disabled={!row.canRemind || reminding}
            loading={reminding}
            onClick={() => onRemind(row)}
            aria-label={`${row.canRemind ? "Relancer" : "Relancée"} · facture ${row.reference}`}
            title={row.canRemind ? undefined : "Déjà relancée dans les dernières 24 h"}
          >
            <BellRing aria-hidden />
            {row.canRemind ? "Relancer" : "Relancée"}
          </Button>
        )}
      </div>
    </li>
  );
}

/** DEMO-3 : paiements côté entreprise — payées, en attente, en retard, et relance en un clic. */
export function CompanyPaymentsPanel() {
  const [filter, setFilter] = useState<CompanyInvoiceFilter>("ALL");
  const { data, isLoading, isError, error, refetch, isFetching } = useCompanyInvoices(filter);
  const remind = useRemindInvoice();
  const [remindingId, setRemindingId] = useState<string | null>(null);

  const handleRemind = async (row: CompanyInvoiceRow) => {
    setRemindingId(row.id);
    try {
      const outcome = await remind.mutateAsync(row.id);
      const message = reminderOutcomeMessage(outcome);
      if (message.kind === "success") toast.success(message.text);
      else if (message.kind === "info") toast.info(message.text);
      else toast.warning(message.text);
    } catch (err) {
      toast.error("Relance impossible", { description: err instanceof Error ? err.message : undefined });
    } finally {
      setRemindingId(null);
    }
  };

  return (
    <div className="space-y-4" data-testid="company-payments">
      <ul className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Résumé des paiements">
        {TILES.map((tile) => {
          const Icon = tile.icon;
          const active = filter === tile.key;
          return (
            <li key={tile.key}>
              <button
                type="button"
                onClick={() => setFilter(active ? "ALL" : tile.key)}
                aria-pressed={active}
                className={cn(
                  "flex min-h-11 w-full touch-manipulation flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-foreground/30" : "border-border"
                )}
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", tile.tone)}>
                    <Icon className="h-3 w-3" aria-hidden />
                  </span>
                  {tile.label}
                </span>
                <span className="text-xl font-semibold tabular-nums">
                  {isLoading ? "—" : data?.counts[tile.key] ?? 0}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted/30 p-1" role="group" aria-label="Filtrer par statut">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
            className={cn(
              "min-h-11 flex-1 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              filter === item.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Chargement des paiements">
          {[0, 1, 2].map((key) => (
            <li key={key}><Skeleton className="h-24 w-full rounded-xl" /></li>
          ))}
        </ul>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm">
              Paiements indisponibles{error instanceof Error ? ` : ${error.message}` : ""}.
            </p>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => refetch()} loading={isFetching}>
              <RotateCcw aria-hidden />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : !data || data.invoices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-muted-foreground" aria-hidden />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">{EMPTY_COPY[filter]}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <ul className="space-y-2" aria-label="Liste des paiements">
            {data.invoices.map((row) => (
              <InvoiceRow key={row.id} row={row} onRemind={handleRemind} reminding={remindingId === row.id} />
            ))}
          </ul>
          {data.invoices.length >= data.limit && (
            <p className="text-xs text-muted-foreground">
              Les {data.limit} factures les plus récentes sont affichées. Filtrez par statut ou utilisez l&apos;export comptable pour l&apos;historique complet.
            </p>
          )}
        </>
      )}
    </div>
  );
}
