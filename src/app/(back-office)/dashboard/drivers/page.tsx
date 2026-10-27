"use client";

import { useMemo } from "react";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyDrivers } from "@/features/back-office/hooks";
import { TableDriverDayCell, TableLastSeenCell, TablePersonCell } from "@/features/back-office/table-ui";
import { Truck } from "lucide-react";
import type { TableColumn } from "@/types";
import type { CompanyDriver } from "@/features/back-office/types";

export default function CompanyDriversPage() {
  const { data: drivers, isLoading, error } = useCompanyDrivers();

  const columns: TableColumn<CompanyDriver & { name: string }>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Chauffeur",
        sortable: true,
        cell: (row) => (
          <TablePersonCell
            href={`/dashboard/drivers/${row.id}`}
            name={row.name}
            detail={[row.phone, row.email].filter(Boolean).join(" · ")}
          />
        ),
      },
      {
        // Une barre et une phrase plutôt que quatre colonnes de compteurs.
        key: "inTransit",
        header: "Aujourd'hui",
        cell: (row) => (
          <TableDriverDayCell
            day={{ delivered: row.deliveredToday ?? 0, inTransit: row.inTransit ?? 0, toDo: row.assigned ?? 0 }}
            actions={row.activityToday}
          />
        ),
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

  if (isInitialQueryLoading(isLoading, drivers)) return <PageSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={Truck}
        title="Erreur de chargement"
        description={error instanceof Error ? error.message : "Impossible de charger les chauffeurs"}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chauffeurs</h1>
        <p className="mt-1 text-muted-foreground">
          Suivi de l&apos;activité et des missions du jour
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#0e1310]" /> Livrées</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#00a855]" /> En cours</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c9d3cd]" /> À faire</span>
        </p>
      </div>
      <DataGrid
        data={(drivers ?? []).map((d) => ({
          ...d,
          name: `${d.firstName} ${d.lastName}`.trim(),
        })) as unknown as Record<string, unknown>[]}
        columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
        searchText={(row) => [row.name, row.email, row.phone].filter(Boolean).join(" ")}
        searchPlaceholder="Nom, e-mail ou téléphone…"
        paginate={false}
        emptyTitle="Aucun chauffeur"
        emptyDescription="Créez des comptes chauffeur dans Gestion des comptes."
      />
    </div>
  );
}
