"use client";

import { DashboardContent } from "@/features/dashboard/dashboard-content";
import { useAdminOverview, useAdminSaasHealth } from "@/features/admin/hooks";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/features/client-portal/utils";
import { Building2, Users, Truck, ReceiptText, AlertTriangle } from "lucide-react";
import type { DashboardStat, TableColumn } from "@/types";

const planLabels = { STARTER: "Starter", PRO: "Pro", BUSINESS: "Business" } as const;
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

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

function OverviewPanel() {
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
    { label: "Factures de livraison payées", value: formatCurrency(data.stats.paidDeliveryInvoiceRevenue), icon: ReceiptText, changeLabel: "mois UTC · flux séparé" },
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

function SaasHealthPanel() {
  const { data, isLoading, error } = useAdminSaasHealth();
  if (isInitialQueryLoading(isLoading, data)) {
    return <p className="text-sm text-muted-foreground">Indicateurs SaaS en cours.</p>;
  }
  if (error || !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Indicateurs SaaS indisponibles"
        description="Les compteurs généraux restent affichés."
      />
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="saas-health-title" data-saas-health-readonly="true">
        <div>
          <h2 id="saas-health-title" className="text-xl font-semibold tracking-tight">Santé SaaS · lecture seule</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Mesures observées pour {monthFormat.format(new Date(data.period.startsAt))}, sans réconciliation fournisseur.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card><CardHeader><CardDescription>Abonnements confirmés HT</CardDescription><CardTitle>{formatCurrency(data.revenue.subscriptionPaidHtCents / 100)}</CardTitle><CardDescription>journal local · + {formatCurrency(data.revenue.usagePaidHtCents / 100)} de dépassements</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardDescription>Nouvelles activations</CardDescription><CardTitle>{data.activation.newSubscriptions}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Commandes mesurées</CardDescription><CardTitle>{data.consumption.orders}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Livreurs actifs ou invités</CardDescription><CardTitle>{data.consumption.drivers}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Options / sièges actifs</CardDescription><CardTitle>{data.consumption.activeOptionUnits}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consommation par formule</CardTitle>
            <CardDescription>Business reste mesuré comme les autres formules, sans plafond caché ajouté.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Formule</TableHead><TableHead>Souscriptions</TableHead><TableHead>Activations</TableHead><TableHead>Commandes</TableHead><TableHead>Livreurs</TableHead><TableHead>Options / sièges</TableHead></TableRow></TableHeader>
              <TableBody>{data.byPlan.map((plan) => <TableRow key={plan.planCode}>
                <TableCell className="font-medium">{planLabels[plan.planCode]}</TableCell>
                <TableCell>{plan.subscriptions}</TableCell>
                <TableCell>{plan.activations}</TableCell>
                <TableCell>{plan.orders} <span className="text-muted-foreground">/ {plan.includedOrders}</span></TableCell>
                <TableCell>{plan.drivers}</TableCell>
                <TableCell>{plan.activeOptionUnits}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consommation par entreprise</CardTitle>
            <CardDescription>Au plus 50 souscriptions commerciales récentes ; les totaux ci-dessus portent sur l’ensemble lu.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Entreprise</TableHead><TableHead>Formule</TableHead><TableHead>Statut</TableHead><TableHead>Commandes</TableHead><TableHead>Livreurs</TableHead><TableHead>Options / sièges</TableHead></TableRow></TableHeader>
              <TableBody>{data.companies.map((company) => <TableRow key={company.companyId}>
                <TableCell className="font-medium">{company.name}</TableCell>
                <TableCell>{company.planCode ? planLabels[company.planCode] : "Non déterminée"}</TableCell>
                <TableCell><Badge variant={company.status === "ACTIVE" ? "success" : "secondary"}>{company.status}</Badge></TableCell>
                <TableCell>{company.orders}</TableCell>
                <TableCell>{company.drivers}</TableCell>
                <TableCell>{company.activeOptionUnits}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Définitions et limites</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {data.definitions.map((definition) => <li key={definition}>• {definition}</li>)}
              {data.revenue.ignoredRecords > 0 && <li>• {data.revenue.ignoredRecords} écriture(s) incomplète(s) exclue(s) du calcul.</li>}
              {data.revenue.refundedInvoicesObserved > 0 && <li>• {data.revenue.refundedInvoicesObserved} facture(s) avec remboursement observé ; montant HT non déduit.</li>}
            </ul>
          </CardContent>
        </Card>
      </section>
  );
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <OverviewPanel />
      <SaasHealthPanel />
    </div>
  );
}
