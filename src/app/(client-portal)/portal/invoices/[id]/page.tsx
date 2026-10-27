"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalInvoice } from "@/features/client-portal/hooks";
import { InvoiceStatusBadge } from "@/features/client-portal/status-badges";
import {
  canReorderPortalOrder,
  ReorderOrderButton,
} from "@/features/client-portal/reorder-order-button";
import { formatCurrency, invoiceLineTotal, invoiceTitle } from "@/features/client-portal/utils";
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { ArrowLeft, FileText, Download } from "lucide-react";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = usePortalInvoice(id ?? "");

  if (isInitialQueryLoading(isLoading, invoice)) return <PageSkeleton />;

  if (error || !invoice) {
    return (
      <EmptyState
        icon={FileText}
        title="Facture introuvable"
        description="Cette facture n'existe pas ou ne vous appartient pas."
      />
    );
  }

  const total = formatCurrency(invoice.amount);

  return (
    <div className="space-y-6">
      <Link
        href="/portal/invoices"
        className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux factures
      </Link>

      <section aria-labelledby="invoice-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 id="invoice-title" className="text-2xl font-semibold tracking-tight">
              {invoiceTitle(invoice.createdAt)}
            </h1>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{invoice.reference}</p>
          </div>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums text-foreground">{total}</p>
        <dl className="mt-4 grid gap-2 sm:grid-cols-3">
          <InvoiceFact label="Émise">
            <DayTime date={invoice.createdAt} />
          </InvoiceFact>
          {invoice.dueDate && (
            <InvoiceFact label="Échéance">
              <DayTime date={invoice.dueDate} />
            </InvoiceFact>
          )}
          {invoice.paidAt && (
            <InvoiceFact label="Payée">
              <DayTime date={invoice.paidAt} />
            </InvoiceFact>
          )}
        </dl>
        {invoice.order && (
          <p className="mt-4 text-sm text-muted-foreground">
            Pour la commande{" "}
            <Link
              href={`/portal/orders/${invoice.order.id}`}
              className="rounded-sm font-medium text-[#08783f] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {invoice.order.reference}
            </Link>
          </p>
        )}
      </section>

      <p className="text-sm text-muted-foreground">Relevé de prestation de livraison. Document opérationnel, distinct de l&apos;abonnement TutelLiv ; il ne constitue pas une facture électronique réglementaire.</p>

      {(invoice.lineItems?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail de la facture</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <table className="w-full">
              <caption className="sr-only">Lignes de la facture et total</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Prestation</th>
                  <th scope="col">Montant</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems!.map((line, i) => (
                  <tr key={i}>
                    <td className="py-1 pr-4">
                      {line.label}
                      {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                    </td>
                    <td className="py-1 text-right tabular-nums">{invoiceLineTotal(line)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <th scope="row" className="pt-3 text-left">Total</th>
                  <td className="pt-3 text-right tabular-nums">{total}</td>
                </tr>
              </tfoot>
            </table>
            {invoice.notes && (
              <p className="pt-3 text-muted-foreground italic">{invoice.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Émetteur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="font-medium">{invoice.company?.name}</p>
          {invoice.company?.email && <p>{invoice.company.email}</p>}
          {invoice.company?.address && (
            <p className="text-muted-foreground">
              {invoice.company.address}, {invoice.company.city}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <a href={`/api/portal/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Télécharger le PDF
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </Button>
        {canReorderPortalOrder(invoice.order) && (
          <ReorderOrderButton orderId={invoice.order?.id} />
        )}
      </div>
    </div>
  );
}

function InvoiceFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl bg-[#f5f8f6] px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function DayTime({ date }: { date: string }) {
  return (
    <time dateTime={date} title={fullDateLabel(date)}>
      {relativeDayLabel(date)}
    </time>
  );
}
