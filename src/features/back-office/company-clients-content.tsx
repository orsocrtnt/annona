"use client";

import { useMemo } from "react";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyClients } from "@/features/back-office/hooks";
import { TableLastSeenCell, TablePersonCell } from "@/features/back-office/table-ui";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { Users } from "lucide-react";
import type { TableColumn } from "@/types";
import type { CompanyClient } from "@/features/back-office/types";

interface CompanyClientsContentProps {
  initialClients?: CompanyClient[];
}

/** Activité en mots : « 3 commandes · aujourd'hui : 1 commande, 3 mises à jour de suivi ». */
function ClientActivity({ row }: { row: CompanyClient }) {
  const total = row._count.ordersAsCustomer;
  const today = [
    row.ordersToday ? `${row.ordersToday} commande${row.ordersToday > 1 ? "s" : ""}` : "",
    row.eventsToday ? `${row.eventsToday} mise${row.eventsToday > 1 ? "s" : ""} à jour de suivi` : "",
  ].filter(Boolean);
  return (
    <div className="min-w-0">
      <p className="text-sm text-foreground">
        {total ? `${total} commande${total > 1 ? "s" : ""}` : "Aucune commande"}
      </p>
      <p className="text-xs text-muted-foreground">
        {today.length ? `Aujourd'hui : ${today.join(", ")}` : "Rien aujourd'hui"}
      </p>
    </div>
  );
}

export function CompanyClientsContent({ initialClients }: CompanyClientsContentProps) {
  const { data: clients, isLoading, error } = useCompanyClients(initialClients);

  const columns: TableColumn<CompanyClient & { name: string }>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Client",
        sortable: true,
        cell: (row) => (
          <TablePersonCell
            href={`/dashboard/clients/${row.id}`}
            name={row.name}
            detail={[row.email, row.phone].filter(Boolean).join(" · ")}
          />
        ),
      },
      {
        key: "orders",
        header: "Activité",
        cell: (row) => <ClientActivity row={row} />,
      },
      {
        key: "lastLoginAt",
        header: "Dernière connexion",
        hideOnMobile: true,
        cell: (row) => <TableLastSeenCell date={row.lastLoginAt} />,
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
        data={(clients ?? []).map((c) => ({ ...c, name: `${c.firstName} ${c.lastName}`.trim() })) as unknown as Record<string, unknown>[]}
        columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
        searchText={(row) => [row.name, row.email, row.phone].filter(Boolean).join(" ")}
        searchPlaceholder="Nom, e-mail ou téléphone…"
        paginate={false}
        emptyTitle="Aucun client"
        emptyDescription="Créez des comptes clients dans Équipe."
      />
    </div>
  );
}
