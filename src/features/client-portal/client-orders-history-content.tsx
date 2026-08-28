"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalOrders } from "@/features/client-portal/hooks";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import {
  canReorderPortalOrder,
  ReorderOrderButton,
} from "@/features/client-portal/reorder-order-button";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatDate } from "@/lib/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { History, ArrowLeft } from "lucide-react";
import type { TableColumn } from "@/types";
import type { PortalOrder } from "@/features/client-portal/types";

const columns: TableColumn<PortalOrder>[] = [
  {
    key: "reference",
    header: "Référence",
    sortable: true,
    cell: (row) => (
      <Link
        href={`/portal/orders/${row.id}`}
        className="font-medium text-brand hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {row.reference}
      </Link>
    ),
  },
  {
    key: "createdAt",
    header: "Date",
    sortable: true,
    hideOnMobile: true,
    cell: (row) => formatDate(row.createdAt),
  },
  { key: "itemCount", header: "Articles", sortable: true, hideOnMobile: true },
  {
    key: "totalAmount",
    header: "Total",
    cell: (row) => formatCurrency(row.totalAmount),
  },
  {
    key: "status",
    header: "Statut",
    cell: (row) => <OrderStatusBadge status={row.status} deliveryCategory={row.deliveryCategory} />,
  },
  {
    key: "actions",
    header: "",
    className: "w-[180px] max-md:min-w-[9rem]",
    cell: (row) =>
      canReorderPortalOrder(row) ? <ReorderOrderButton orderId={row.id} /> : null,
  },
];

interface ClientOrdersHistoryContentProps {
  initialOrders?: PortalOrder[];
}

export function ClientOrdersHistoryContent({ initialOrders }: ClientOrdersHistoryContentProps) {
  const { data: orders, isLoading, error } = usePortalOrders(true, initialOrders);

  if (isInitialQueryLoading(isLoading, orders)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Link href="/portal/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Commandes en cours
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historique des commandes</h1>
        <p className="mt-1 text-muted-foreground">Commandes livrées et annulées — 50 plus récentes</p>
      </div>

      {error ? (
        <EmptyState icon={History} title="Impossible de charger l'historique" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toutes les commandes passées</CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid
              data={(orders ?? []) as unknown as Record<string, unknown>[]}
              columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
              searchKey="reference"
              searchPlaceholder="Rechercher..."
              emptyTitle="Aucun historique"
              emptyDescription="Vos commandes terminées apparaîtront ici."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
