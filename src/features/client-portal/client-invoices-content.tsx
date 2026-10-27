"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalInvoices } from "@/features/client-portal/hooks";
import { InvoiceStatusBadge } from "@/features/client-portal/status-badges";
import {
  canReorderPortalOrder,
  ReorderOrderButton,
} from "@/features/client-portal/reorder-order-button";
import { formatCurrency, invoiceTitle } from "@/features/client-portal/utils";
import { TableIdentityCell } from "@/components/shared/table-cells";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { FileText } from "lucide-react";
import type { TableColumn } from "@/types";
import type { PortalInvoice } from "@/features/client-portal/types";

function InvoiceReorderAction({ invoice }: { invoice: PortalInvoice }) {
  if (!canReorderPortalOrder(invoice.order)) return null;

  return (
    <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
      <ReorderOrderButton orderId={invoice.order?.id} compact />
    </div>
  );
}

interface ClientInvoicesContentProps {
  initialInvoices?: PortalInvoice[];
}

export function ClientInvoicesContent({ initialInvoices }: ClientInvoicesContentProps) {
  const router = useRouter();
  const { data: invoices, isLoading, error, refetch } = usePortalInvoices(initialInvoices);

  const columns: TableColumn<PortalInvoice>[] = [
    {
      // « Facture du 27 oct. » plutôt qu'une référence ; la référence reste en petit dessous.
      key: "createdAt",
      header: "Facture",
      sortable: true,
      className: "min-w-[9rem]",
      cell: (row) => (
        <TableIdentityCell
          href={`/portal/invoices/${row.id}`}
          title={invoiceTitle(row.createdAt)}
          reference={row.reference}
        />
      ),
    },
    {
      key: "amount",
      header: "Montant",
      className: "whitespace-nowrap",
      cell: (row) => formatCurrency(row.amount),
    },
    {
      key: "status",
      header: "Statut",
      className: "min-w-[6.5rem]",
      cell: (row) => <InvoiceStatusBadge status={row.status} />,
    },
    {
      key: "order",
      header: "Commande",
      hideOnMobile: true,
      className: "min-w-[7rem]",
      cell: (row) =>
        row.order?.id ? (
          <Link
            href={`/portal/orders/${row.order.id}`}
            className="font-medium text-brand hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            {row.order.reference}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "actions",
      header: "Action",
      className: "w-[1%] min-w-[11.5rem] overflow-visible whitespace-nowrap pl-3 text-right",
      cell: (row) => <InvoiceReorderAction invoice={row} />,
    },
  ];

  if (isInitialQueryLoading(isLoading, invoices)) return <PageSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={FileText}
        title="Factures indisponibles"
        description="Impossible de charger vos factures pour le moment."
        action={{ label: "Réessayer", onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Factures</h1>
        <p className="mt-1 text-muted-foreground">Les 50 factures les plus récentes</p>
        <p className="mt-2 text-sm text-muted-foreground">Relevés de prestations de livraison : documents de suivi et informations tarifaires. Ils ne constituent pas une émission réglementaire de factures électroniques.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des factures</CardTitle>
        </CardHeader>
        <CardContent>
          <DataGrid
            data={(invoices ?? []) as unknown as Record<string, unknown>[]}
            columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
            searchKey="reference"
            tableClassName="table-auto min-w-[52rem] max-md:min-w-[24rem]"
            emptyTitle="Aucune facture"
            emptyDescription="Vos factures apparaîtront ici."
            onRowClick={(row) => {
              const invoice = row as unknown as PortalInvoice;
              router.push(`/portal/invoices/${invoice.id}`);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
