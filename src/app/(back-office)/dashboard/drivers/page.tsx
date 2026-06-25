"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataGrid } from "@/components/ui/data-grid";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { useCompanyDrivers } from "@/features/back-office/hooks";
import { formatPersonNameByRole } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { Truck } from "lucide-react";
import type { TableColumn } from "@/types";
import type { CompanyDriver } from "@/features/back-office/types";

export default function CompanyDriversPage() {
  const { data: drivers, isLoading, error } = useCompanyDrivers();

  const columns: TableColumn<CompanyDriver>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Chauffeur",
        sortable: true,
        cell: (row) => (
          <Link href={`/dashboard/drivers/${row.id}`} className="font-medium hover:underline">
            {formatPersonNameByRole(row.firstName, row.lastName, "DRIVER")}
          </Link>
        ),
      },
      { key: "email", header: "Email", hideOnMobile: true },
      { key: "phone", header: "Téléphone", hideOnMobile: true, cell: (row) => row.phone ?? "—" },
      {
        key: "assigned",
        header: "Assignées",
        cell: (row) => <Badge variant="secondary">{row.assigned ?? 0}</Badge>,
      },
      {
        key: "inTransit",
        header: "En cours",
        cell: (row) => <Badge variant="brand">{row.inTransit ?? 0}</Badge>,
      },
      {
        key: "deliveredToday",
        header: "Livrées aujourd'hui",
        cell: (row) => <Badge variant="success">{row.deliveredToday ?? 0}</Badge>,
      },
      {
        key: "activityToday",
        header: "Événements du jour",
        hideOnMobile: true,
        cell: (row) => row.activityToday ?? 0,
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
      </div>
      <DataGrid
        data={(drivers ?? []).map((d) => ({
          ...d,
          name: formatPersonNameByRole(d.firstName, d.lastName, "DRIVER"),
        })) as unknown as Record<string, unknown>[]}
        columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
        searchKey="name"
        searchPlaceholder="Rechercher un chauffeur..."
        paginate={false}
        emptyTitle="Aucun chauffeur"
        emptyDescription="Créez des comptes chauffeur dans Gestion des comptes."
      />
    </div>
  );
}
