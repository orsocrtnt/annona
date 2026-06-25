"use client";

import { DashboardContent } from "@/features/dashboard/dashboard-content";
import { useAdminOverview } from "@/features/admin/hooks";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/client-portal/utils";
import { Building2, Users, Truck, TrendingUp, AlertTriangle } from "lucide-react";
import type { DashboardStat, TableColumn } from "@/types";

const companyColumns: TableColumn<Record<string, unknown>>[] = [
  { key: "name", header: "Entreprise", sortable: true },
  {
    key: "status",
    header: "Statut",
    cell: (row) => (
      <Badge variant={row.status === "ACTIVE" ? "success" : row.status === "TRIAL" ? "brand" : "secondary"}>
        {String(row.status)}
      </Badge>
    ),
  },
  { key: "users", header: "Utilisateurs", sortable: true, hideOnMobile: true },
  { key: "deliveries", header: "Livraisons", sortable: true, hideOnMobile: true },
];

export default function AdminDashboardPage() {
  const { data, isLoading, error } = useAdminOverview();

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Données indisponibles"
        description="Impossible de charger la vue d'ensemble de la plateforme."
      />
    );
  }

  const stats: DashboardStat[] = [
    { label: "Entreprises actives", value: String(data.stats.activeCompanies), icon: Building2 },
    { label: "Utilisateurs totaux", value: String(data.stats.totalUsers), icon: Users },
    { label: "Livraisons aujourd'hui", value: String(data.stats.deliveriesToday), icon: Truck },
    { label: "Revenus encaissés (mois)", value: formatCurrency(data.stats.revenueThisMonth), icon: TrendingUp },
  ];

  return (
    <DashboardContent
      title="Centre de contrôle"
      description="Vue d'ensemble de la plateforme Tutelliv"
      stats={stats}
      showCharts={false}
      showActivity={false}
      showTable
      tableTitle="Entreprises récentes"
      tableData={data.companies as unknown as Record<string, unknown>[]}
      tableColumns={companyColumns}
    />
  );
}
