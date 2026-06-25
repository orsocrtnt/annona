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
import { formatCurrency } from "@/features/client-portal/utils";
import { formatDate } from "@/lib/utils";
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

  return (
    <div className="space-y-6">
      <Link href="/portal/invoices" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Retour aux factures
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.reference}</h1>
          {invoice.order && (
            <p className="mt-1 text-muted-foreground">
              Commande{" "}
              <Link
                href={`/portal/orders/${invoice.order.id}`}
                className="font-medium text-brand hover:underline"
              >
                {invoice.order.reference}
              </Link>
            </p>
          )}
        </div>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      {(invoice.lineItems?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail de la facture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoice.lineItems!.map((line, i) => (
              <div key={i} className="flex justify-between">
                <span>
                  {line.label}
                  {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                </span>
                <span>{formatCurrency(line.amount * line.quantity)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-3 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.amount)}</span>
            </div>
            {invoice.notes && (
              <p className="pt-2 text-muted-foreground italic">{invoice.notes}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-semibold">{formatCurrency(invoice.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Émise le</span>
              <span>{formatDate(invoice.createdAt)}</span>
            </div>
            {invoice.dueDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Échéance</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
            )}
            {invoice.paidAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payée le</span>
                <span>{formatDate(invoice.paidAt)}</span>
              </div>
            )}
          </CardContent>
        </Card>

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
      </div>

      <div className="flex flex-wrap gap-3">
        <a href={`/api/portal/invoices/${id}/pdf`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Télécharger le PDF
          </Button>
        </a>
        {canReorderPortalOrder(invoice.order) && (
          <ReorderOrderButton orderId={invoice.order?.id} />
        )}
      </div>
    </div>
  );
}
