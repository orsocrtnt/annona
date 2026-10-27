"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { OrderHistoryTable } from "@/components/shared/order-history-table";
import { useCompanyOrders } from "@/features/back-office/hooks";
import { getCompanyOrderColumns } from "@/features/back-office/company-order-columns";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import {
  ORDER_HISTORY_DEFAULT_PAGE_SIZE,
  type OrderHistoryPage,
  type OrderHistoryQuery,
} from "@/lib/query/order-history";
import { Package } from "lucide-react";
import type { TableColumn } from "@/types";
import type { CompanyOrder } from "@/features/back-office/types";
import { AccountingExportForm } from "@/features/back-office/accounting-export-form";

const columns = getCompanyOrderColumns("interactive");

interface CompanyOrdersContentProps {
  initialOrders?: OrderHistoryPage<CompanyOrder>;
}

export function CompanyOrdersContent({ initialOrders }: CompanyOrdersContentProps) {
  const [query, setQuery] = React.useState<OrderHistoryQuery>({
    page: 1,
    pageSize: ORDER_HISTORY_DEFAULT_PAGE_SIZE,
  });
  const { data: result, isLoading, isFetching, error } = useCompanyOrders(query, initialOrders);

  if (isInitialQueryLoading(isLoading, result)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
        <p className="mt-1 text-muted-foreground">
          Retrouvez toutes les commandes, filtrez l&apos;historique et exportez le résultat complet.
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
            <OrderHistoryTable
              result={result as unknown as OrderHistoryPage<Record<string, unknown>> | undefined}
              columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
              query={query}
              onQueryChange={setQuery}
              exportPath="/api/orders/export"
              loading={isFetching}
              emptyTitle="Aucune commande"
              emptyDescription="Les commandes clients apparaîtront ici."
            />
          </CardContent>
        </Card>
      )}

      {/* Export comptable : action ponctuelle, sous la liste plutôt qu'avant elle. */}
      <AccountingExportForm />
    </div>
  );
}
