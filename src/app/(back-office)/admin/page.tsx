"use client";

import { ChevronDown } from "lucide-react";
import { useAdminOverview, useAdminSaasHealth } from "@/features/admin/hooks";
import { AdminHomePanel } from "@/features/admin/home/admin-home-panel";
import { HOME_CARD_CLASS } from "@/features/admin/home/home-card";
import { DataGrid } from "@/components/ui/data-grid";
import { cn } from "@/lib/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/features/client-portal/utils";
import { AlertTriangle } from "lucide-react";
import type { TableColumn } from "@/types";

const planLabels = { STARTER: "Starter", PRO: "Pro", BUSINESS: "Business" } as const;
/** SAAS-02, décision C10 : seuils plateforme ; la consommation n'est jamais bloquée. */
const alertLabels = {
  ORDERS_80: { label: "80 % des commandes incluses", variant: "warning" },
  ORDERS_100: { label: "100 % des commandes incluses", variant: "warning" },
  ORDERS_120: { label: "120 % des commandes incluses", variant: "destructive" },
  BUSINESS_ORDERS_DOUBLE: { label: "Business : 2 × les commandes incluses", variant: "destructive" },
  BUSINESS_DRIVERS_40: { label: "Business : 40 livreurs", variant: "destructive" },
} as const;
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

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
  { key: "deliveries", header: "Livraisons", sortable: true, hideOnMobile: true },
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
            Mesures observées pour {monthFormat.format(new Date(data.period.startsAt))} dans le journal local ; le rapprochement avec le fournisseur se fait à part.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card><CardHeader><CardDescription>Abonnements confirmés HT</CardDescription><CardTitle>{formatCurrency(data.revenue.subscriptionPaidHtCents / 100)}</CardTitle><CardDescription>journal local · + {formatCurrency(data.revenue.usagePaidHtCents / 100)} de dépassements{data.revenue.refundedHtCents > 0 ? ` · − ${formatCurrency(data.revenue.refundedHtCents / 100)} remboursés, net ${formatCurrency(data.revenue.netPaidHtCents / 100)}` : ""}</CardDescription></CardHeader></Card>
          <Card><CardHeader><CardDescription>Nouvelles activations</CardDescription><CardTitle>{data.activation.newSubscriptions}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Commandes mesurées</CardDescription><CardTitle>{data.consumption.orders}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Livreurs actifs ou invités</CardDescription><CardTitle>{data.consumption.drivers}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>Options / sièges actifs</CardDescription><CardTitle>{data.consumption.activeOptionUnits}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertes de consommation</CardTitle>
            <CardDescription>Seuils plateforme du mois : 80, 100 et 120 % des commandes incluses ; Business à deux fois l’inclus ou 40 livreurs. Rien n’est bloqué ni facturé par ces alertes.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune entreprise n’a franchi de seuil ce mois-ci.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Entreprise</TableHead><TableHead>Formule</TableHead><TableHead>Alerte</TableHead><TableHead>Mesure / seuil</TableHead></TableRow></TableHeader>
                <TableBody>{data.alerts.map((alert) => <TableRow key={`${alert.companyId}-${alert.kind}`}>
                  <TableCell className="font-medium">{alert.name}</TableCell>
                  <TableCell>{alert.planCode ? planLabels[alert.planCode] : "Non déterminée"}</TableCell>
                  <TableCell><Badge variant={alertLabels[alert.kind].variant}>{alertLabels[alert.kind].label}</Badge></TableCell>
                  <TableCell>{alert.value} <span className="text-muted-foreground">/ {alert.threshold}</span></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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
              {data.revenue.refundedInvoicesObserved > 0 && <li>• {data.revenue.refundedInvoicesObserved} facture(s) avec remboursement observé ; ceux du mois sont déduits du net.</li>}
            </ul>
          </CardContent>
        </Card>
      </section>
  );
}

const COMPANY_STATUS_LABELS: Record<string, string> = { ACTIVE: "Active", INACTIVE: "Inactive", SUSPENDED: "Suspendue", TRIAL: "Essai" };

export default function AdminDashboardPage() {
  return (
    <div className="space-y-5">
      <AdminHomePanel />
      <details className={cn(HOME_CARD_CLASS, "group")}>
        <summary className="-m-2 flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-lg font-bold tracking-tight text-foreground">Détail SaaS</span>
            <span className="block text-sm text-muted-foreground">Revenus du mois, consommation par formule et alertes de seuil.</span>
          </span>
          <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-5 min-w-0">
          <SaasHealthPanel />
        </div>
      </details>
      <OverviewPanel />
    </div>
  );
}
