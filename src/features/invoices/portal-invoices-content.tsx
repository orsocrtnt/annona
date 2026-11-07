"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BillingPeriod } from "@prisma/client";
import { ChevronLeft, ChevronRight, Download, FileText } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { parisDateKey } from "@/components/shared/delivery-day-picker";
import { BILLING_PERIODS, nextPeriod, periodContaining, previousPeriod } from "@/domains/invoice/billing-period";
import { portalInvoicePdfUrl, portalStatementUrl } from "@/features/invoices/api";
import { usePortalInvoices } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/invoice-status-badge";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.invoices;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—");

function readType(value: string | null): BillingPeriod {
  return (BILLING_PERIODS as readonly string[]).includes(value ?? "") ? (value as BillingPeriod) : "MONTHLY";
}

/** CLI-10 : factures et relevés du commerçant, par jour, semaine, mois ou année ; PDF téléchargeables. */
export function PortalInvoicesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const type = readType(params.get("type"));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : parisDateKey(0);
  const list = usePortalInvoices(type, date);
  const today = parisDateKey(0);
  const current = periodContaining(type, date);
  const canGoNext = nextPeriod(current).start <= today;

  const go = useCallback(
    (next: { type?: BillingPeriod; date?: string }) => {
      const query = new URLSearchParams(params.toString());
      query.set("type", next.type ?? type);
      query.set("date", next.date ?? date);
      router.replace(`${pathname}?${query.toString()}`, { scroll: false });
    },
    [date, params, pathname, router, type]
  );

  const data = list.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.myInvoices}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.portalHint}</p>
        {data ? <p className="mt-1 text-sm text-muted-foreground">{t.billedEvery(t.periodicity[data.merchantPeriodicity] ?? "")}</p> : null}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-2xl border bg-muted p-1 sm:inline-grid sm:grid-cols-4" role="tablist" aria-label={t.periodType}>
        {BILLING_PERIODS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => go({ type: value })}
            className={cn(
              "min-h-11 rounded-xl px-4 text-sm font-medium transition-colors",
              type === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.portalPeriodTypes[value]}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-2">
        <Button variant="ghost" size="icon-touch" aria-label={t.previous} onClick={() => go({ date: previousPeriod(current).start })}>
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-center text-sm font-semibold" data-testid="portal-period-label">{data?.period.label ?? ""}</p>
        <Button variant="ghost" size="icon-touch" aria-label={t.next} disabled={!canGoNext} onClick={() => go({ date: nextPeriod(current).start })}>
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {list.isLoading && !data ? (
        <PageSkeleton />
      ) : list.error ? (
        <Alert variant="destructive"><AlertDescription>{list.error instanceof Error ? list.error.message : fr.common.loadError}</AlertDescription></Alert>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
            <div className="text-sm">
              <p className="font-semibold tabular-nums">{t.count(data.invoices.length)} · {formatCents(data.totals.totalCents)} {fr.common.inclVat}</p>
              <p className="text-muted-foreground tabular-nums">{t.remaining} : {formatCents(data.totals.remainingCents)}</p>
            </div>
            <Button variant="outline" size="touch" asChild>
              <a href={portalStatementUrl(type, date)} target="_blank" rel="noopener" data-testid="portal-statement">
                <FileText aria-hidden /> {t.statement}
              </a>
            </Button>
          </div>

          {data.invoices.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t.portalEmpty}</p>
          ) : (
            <ul className="space-y-3">
              {data.invoices.map((invoice) => (
                <li key={invoice.id} className="space-y-3 rounded-2xl border bg-card p-4" data-testid={`portal-invoice-${invoice.reference}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{invoice.reference}</p>
                      <p className="text-sm text-muted-foreground">{invoice.periodLabel}</p>
                    </div>
                    <p className="text-right font-semibold tabular-nums">{formatCents(invoice.totalCents)}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <InvoiceStatusBadge invoice={invoice} />
                    <span className="text-muted-foreground">
                      {invoice.remainingCents > 0 ? `${t.dueOn} ${day(invoice.dueDate)} · ${t.remaining.toLowerCase()} ${formatCents(invoice.remainingCents)}` : `${t.issuedOn} ${day(invoice.issuedAt)}`}
                    </span>
                  </div>
                  <Button variant="outline" size="touch" className="w-full" asChild>
                    <a href={portalInvoicePdfUrl(invoice.id)} target="_blank" rel="noopener" data-testid={`portal-invoice-pdf-${invoice.reference}`}>
                      <Download aria-hidden /> {t.download} {t.pdf}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
