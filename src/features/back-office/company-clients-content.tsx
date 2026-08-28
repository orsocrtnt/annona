"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useCompanyClients } from "@/features/back-office/hooks";
import { formatPersonNameByRole } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { Users } from "lucide-react";
import type { TableColumn } from "@/types";
import type { CompanyClient } from "@/features/back-office/types";

interface CompanyClientsContentProps {
  initialClients?: CompanyClient[];
}

export function CompanyClientsContent({ initialClients }: CompanyClientsContentProps) {
  const { data: clients, isLoading, error } = useCompanyClients(initialClients);

  const columns: TableColumn<CompanyClient>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Client",
        sortable: true,
        cell: (row) => (
          <Link href={`/dashboard/clients/${row.id}`} className="font-medium hover:underline">
            {formatPersonNameByRole(row.firstName, row.lastName, "CLIENT")}
          </Link>
        ),
      },
      { key: "email", header: "Email", hideOnMobile: true },
      { key: "phone", header: "Téléphone", hideOnMobile: true, cell: (row) => row.phone ?? "—" },
      {
        key: "orders",
        header: "Commandes",
        cell: (row) => row._count.ordersAsCustomer,
      },
      {
        key: "today",
        header: "Activité aujourd'hui",
        hideOnMobile: true,
        cell: (row) => (
          <div className="flex gap-1">
            {row.ordersToday > 0 && (
              <Badge variant="brand">{row.ordersToday} cmd</Badge>
            )}
            {row.eventsToday > 0 && (
              <Badge variant="secondary">{row.eventsToday} evt</Badge>
            )}
            {row.ordersToday === 0 && row.eventsToday === 0 && (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        key: "lastLoginAt",
        header: "Dernière connexion",
        hideOnMobile: true,
        cell: (row) => (row.lastLoginAt ? formatDate(row.lastLoginAt) : "—"),
      },
    ],
    []
  );

  if (isInitialQueryLoading(isLoading, clients)) return <PageSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={Users}
        title="Erreur de chargement"
        description={error instanceof Error ? error.message : "Impossible de charger les clients"}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="mt-1 text-muted-foreground">
            Vue complète sur vos clients et leur activité du jour. 80 comptes max.
          </p>
      </div>
      <DataGrid
        data={(clients ?? []) as unknown as Record<string, unknown>[]}
        columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
        searchKey="email"
        searchPlaceholder="Rechercher un client..."
        paginate={false}
        emptyTitle="Aucun client"
        emptyDescription="Créez des comptes clients dans Équipe."
      />
    </div>
  );
}
