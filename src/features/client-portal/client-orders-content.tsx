"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderHistoryTable } from "@/components/shared/order-history-table";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalOrders } from "@/features/client-portal/hooks";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/client-portal/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { ShoppingBag, Plus, History } from "lucide-react";
import type { TableColumn } from "@/types";
import type { PortalOrder } from "@/features/client-portal/types";
import {
  ORDER_HISTORY_DEFAULT_PAGE_SIZE,
  type OrderHistoryPage,
  type OrderHistoryQuery,
} from "@/lib/query/order-history";
import { ACTIVE_ORDER_STATUSES } from "@/lib/constants/order-status";
import { TableDueCell, TableIdentityCell, TableRelativeDateCell } from "@/components/shared/table-cells";
import { formatPlace } from "@/lib/format/place";

const columns: TableColumn<PortalOrder>[] = [
  {
    // L'adresse identifie la commande ; la référence reste en petit dessous.
    key: "reference",
    header: "Commande",
    cell: (row) => (
      <TableIdentityCell
        href={`/portal/orders/${row.id}`}
        title={formatPlace(row.shippingAddress ?? row.pickupAddress, row.shippingCity) ?? DELIVERY_CATEGORY_LABELS[row.deliveryCategory ?? "STANDARD"]}
        reference={row.reference}
      />
    ),
  },
    {
      key: "deliveryCategory",
      header: "Type",
      hideOnMobile: true,
      cell: (row) => (
      <Badge variant={row.deliveryCategory === "COURIER" ? "brand" : "secondary"}>
        {DELIVERY_CATEGORY_LABELS[row.deliveryCategory ?? "STANDARD"]}
      </Badge>
    ),
  },
  {
    key: "requestedDeliveryDate",
    header: "Livraison prévue",
    hideOnMobile: true,
    cell: (row) => <TableDueCell status={row.status} date={row.requestedDeliveryDate} />,
  },
  {
    key: "createdAt",
    header: "Créée",
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
];

interface ClientOrdersContentProps {
  initialOrders?: OrderHistoryPage<PortalOrder>;
}

export function ClientOrdersContent({ initialOrders }: ClientOrdersContentProps) {
  const [query, setQuery] = React.useState<OrderHistoryQuery>({
    page: 1,
    pageSize: ORDER_HISTORY_DEFAULT_PAGE_SIZE,
    history: false,
  });
  const { data: result, isLoading, isFetching, error } = usePortalOrders(query, initialOrders);

  if (isInitialQueryLoading(isLoading, result)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes commandes</h1>
          <p className="mt-1 text-muted-foreground">Commandes en cours, avec recherche et filtres complets.</p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:w-full">
          <Button variant="outline" className="max-md:w-full" asChild>
            <Link href="/portal/orders/history">
              <History className="mr-2 h-4 w-4" />
              Historique
            </Link>
          </Button>
          <Button variant="brand" className="max-md:w-full" asChild>
            <Link href="/portal/orders/new" className="max-md:w-full">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <EmptyState
          icon={ShoppingBag}
          title="Impossible de charger les commandes"
          description="Réessayez dans quelques instants."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toutes mes commandes</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderHistoryTable
              result={result as unknown as OrderHistoryPage<Record<string, unknown>> | undefined}
              columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
              query={query}
              onQueryChange={setQuery}
              exportPath="/api/portal/orders/export"
              loading={isFetching}
              statusOptions={ACTIVE_ORDER_STATUSES}
              searchPlaceholder="Référence ou adresse…"
              emptyTitle="Aucune commande"
              emptyDescription="Vos commandes apparaîtront ici une fois passées."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
