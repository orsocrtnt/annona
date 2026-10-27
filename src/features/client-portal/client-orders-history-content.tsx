"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderHistoryTable } from "@/components/shared/order-history-table";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalOrders } from "@/features/client-portal/hooks";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import {
  canReorderPortalOrder,
  ReorderOrderButton,
} from "@/features/client-portal/reorder-order-button";
import { formatCurrency } from "@/features/client-portal/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { History, ArrowLeft } from "lucide-react";
import type { TableColumn } from "@/types";
import type { PortalOrder } from "@/features/client-portal/types";
import {
  ORDER_HISTORY_DEFAULT_PAGE_SIZE,
  type OrderHistoryPage,
  type OrderHistoryQuery,
} from "@/lib/query/order-history";
import { HISTORY_ORDER_STATUSES } from "@/lib/constants/order-status";
import { TableIdentityCell, TableRelativeDateCell } from "@/components/shared/table-cells";
import { formatPlace } from "@/lib/format/place";

const columns: TableColumn<PortalOrder>[] = [
  {
    // L'adresse identifie la commande ; la référence reste en petit dessous.
    key: "reference",
    header: "Commande",
    cell: (row) => (
      <TableIdentityCell
        href={`/portal/orders/${row.id}`}
        title={formatPlace(row.shippingAddress ?? row.pickupAddress, row.shippingCity) ?? "Commande"}
        reference={row.reference}
      />
    ),
  },
  {
    key: "createdAt",
    header: "Date",
    sortable: true,
    hideOnMobile: true,
    cell: (row) => <TableRelativeDateCell date={row.createdAt} />,
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
  initialOrders?: OrderHistoryPage<PortalOrder>;
}

export function ClientOrdersHistoryContent({ initialOrders }: ClientOrdersHistoryContentProps) {
  const [query, setQuery] = React.useState<OrderHistoryQuery>({
    page: 1,
    pageSize: ORDER_HISTORY_DEFAULT_PAGE_SIZE,
    history: true,
  });
  const { data: result, isLoading, isFetching, error } = usePortalOrders(query, initialOrders);

  if (isInitialQueryLoading(isLoading, result)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Link href="/portal/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Commandes en cours
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historique des commandes</h1>
        <p className="mt-1 text-muted-foreground">Toutes les commandes terminées, consultables et exportables.</p>
      </div>

      {error ? (
        <EmptyState icon={History} title="Impossible de charger l'historique" />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toutes les commandes passées</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderHistoryTable
              result={result as unknown as OrderHistoryPage<Record<string, unknown>> | undefined}
              columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
              query={query}
              onQueryChange={setQuery}
              exportPath="/api/portal/orders/export"
              loading={isFetching}
              statusOptions={HISTORY_ORDER_STATUSES}
              searchPlaceholder="Référence ou adresse…"
              emptyTitle="Aucun historique"
              emptyDescription="Vos commandes terminées apparaîtront ici."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
