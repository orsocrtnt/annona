"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalOrders } from "@/features/client-portal/hooks";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatDate } from "@/lib/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { ShoppingBag, Plus, History } from "lucide-react";
import type { TableColumn } from "@/types";
import type { PortalOrder } from "@/features/client-portal/types";

const columns: TableColumn<PortalOrder>[] = [
  {
    key: "reference",
    header: "Référence",
    sortable: true,
    cell: (row) => (
      <Link href={`/portal/orders/${row.id}`} className="font-medium text-brand hover:underline">
        {row.reference}
      </Link>
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
];

interface ClientOrdersContentProps {
  initialOrders?: PortalOrder[];
}

export function ClientOrdersContent({ initialOrders }: ClientOrdersContentProps) {
  const { data: orders, isLoading, error } = usePortalOrders(false, initialOrders);

  if (isInitialQueryLoading(isLoading, orders)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes commandes</h1>
          <p className="mt-1 text-muted-foreground">Commandes en cours — 50 plus récentes</p>
        </div>
        <div className="flex flex-wrap gap-2 max-md:w-full">
          <Link href="/portal/orders/history">
            <Button variant="outline" className="max-md:w-full">
              <History className="mr-2 h-4 w-4" />
              Historique
            </Button>
          </Link>
          <Link href="/portal/orders/new" className="max-md:w-full">
            <Button variant="brand" className="max-md:w-full">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle commande
            </Button>
          </Link>
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
            <DataGrid
              data={(orders ?? []) as unknown as Record<string, unknown>[]}
              columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
              searchKey="reference"
              searchPlaceholder="Rechercher une commande..."
              emptyTitle="Aucune commande"
              emptyDescription="Vos commandes apparaîtront ici une fois passées."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
