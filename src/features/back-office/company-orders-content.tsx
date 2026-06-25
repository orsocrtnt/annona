"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyOrders } from "@/features/back-office/hooks";
import { getCompanyOrderColumns } from "@/features/back-office/company-order-columns";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { Package } from "lucide-react";
import type { TableColumn } from "@/types";
import type { CompanyOrder } from "@/features/back-office/types";

const columns = getCompanyOrderColumns("interactive");

interface CompanyOrdersContentProps {
  initialOrders?: CompanyOrder[];
}

export function CompanyOrdersContent({ initialOrders }: CompanyOrdersContentProps) {
  const { data: orders, isLoading, error } = useCompanyOrders(initialOrders);

  if (isInitialQueryLoading(isLoading, orders)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
        <p className="mt-1 text-muted-foreground">
          Recevez les commandes et assignez-les à vos chauffeurs
        </p>
      </div>

      {error ? (
        <EmptyState
          icon={Package}
          title="Impossible de charger les commandes"
          description="Réessayez dans quelques instants."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Toutes les commandes</CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid
              data={(orders ?? []) as unknown as Record<string, unknown>[]}
              columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
              searchKey="reference"
              searchPlaceholder="Rechercher une commande..."
              paginate={false}
              emptyTitle="Aucune commande"
              emptyDescription="Les commandes clients apparaîtront ici."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
