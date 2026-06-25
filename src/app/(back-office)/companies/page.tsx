"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataGrid } from "@/components/ui/data-grid";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loader";
import { EmptyState } from "@/components/ui/empty-state";
import { useAdminOverview } from "@/features/admin/hooks";
import { AlertTriangle } from "lucide-react";
import type { TableColumn } from "@/types";

const columns: TableColumn<Record<string, unknown>>[] = [
  { key: "name", header: "Entreprise", sortable: true },
  { key: "slug", header: "Slug", hideOnMobile: true },
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

export default function CompaniesPage() {
  const { data, isLoading, error } = useAdminOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entreprises</h1>
        <p className="mt-1 text-muted-foreground">Gérez les entreprises clientes de la plateforme</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Toutes les entreprises</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <PageLoader />
          ) : error || !data ? (
            <EmptyState
              icon={AlertTriangle}
              title="Données indisponibles"
              description="Impossible de charger la liste des entreprises."
            />
          ) : (
            <DataGrid
              data={data.companies as unknown as Record<string, unknown>[]}
              columns={columns}
              searchKey="name"
              searchPlaceholder="Rechercher une entreprise..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
