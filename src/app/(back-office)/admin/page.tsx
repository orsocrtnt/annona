"use client";

import { useAdminOverview } from "@/features/admin/hooks";
import { AdminHomePanel } from "@/features/admin/home/admin-home-panel";
import { HOME_CARD_CLASS } from "@/features/admin/home/home-card";
import { DataGrid } from "@/components/ui/data-grid";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/client-portal/utils";
import { AlertTriangle } from "lucide-react";
import type { TableColumn } from "@/types";
import { fr } from "@/lib/i18n/fr";

const companyColumns: TableColumn<Record<string, unknown>>[] = [
  { key: "name", header: "Entreprise", sortable: true },
  {
    key: "status",
    header: "Statut",
    cell: (row) => (
      <Badge variant={row.status === "ACTIVE" ? "success" : row.status === "TRIAL" ? "brand" : "secondary"}>
        {COMPANY_STATUS_LABELS[String(row.status)] ?? String(row.status)}
      </Badge>
    ),
  },
  { key: "users", header: "Utilisateurs", sortable: true, hideOnMobile: true },
  // ADM-1 : la colonne compte les commandes de l'entreprise (tous statuts), pas des livraisons.
  { key: "deliveries", header: fr.platform.orders, sortable: true, hideOnMobile: true },
];

/** Entreprises récentes et compteurs généraux de la vue d'ensemble (lecture `/api/admin/overview`). */
function OverviewPanel() {
  const { data, isLoading, error } = useAdminOverview();

  if (isInitialQueryLoading(isLoading, data)) {
    return <p className="text-sm text-muted-foreground">Entreprises récentes en cours de chargement.</p>;
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Données indisponibles"
        description="Impossible de charger la vue d'ensemble de la plateforme."
      />
    );
  }

  const figures = [
    { label: "Utilisateurs totaux", value: String(data.stats.totalUsers), note: "toutes entreprises" },
    { label: "Factures de livraison payées", value: formatCurrency(data.stats.paidDeliveryInvoiceRevenue), note: "mois UTC · flux séparé" },
  ];

  return (
    <section className={HOME_CARD_CLASS} aria-labelledby="recent-companies-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="recent-companies-title" className="text-lg font-bold tracking-tight text-foreground">Entreprises récentes</h2>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-xs text-muted-foreground">{figure.label} · {figure.note}</dt>
              <dd className="font-semibold tabular-nums text-foreground">{figure.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="mt-4">
        <DataGrid data={data.companies as unknown as Record<string, unknown>[]} columns={companyColumns} />
      </div>
    </section>
  );
}

const COMPANY_STATUS_LABELS: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspendue", TRIAL: "Essai" };

export default function AdminDashboardPage() {
  return (
    <div className="space-y-5">
      <AdminHomePanel />
      <OverviewPanel />
    </div>
  );
}
