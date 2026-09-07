"use client";

import { useState } from "react";
import { BarChart3, Package, CheckCircle2, Clock, UserX, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyAnalytics } from "@/features/back-office/hooks";
import { formatCurrency } from "@/features/client-portal/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";

function percent(value: number | null) {
  if (value == null) return "—";
  return `${Math.round(value * 100)} %`;
}

function dayLabel(isoDate: string, days: 7 | 30) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString("fr-FR", days === 7 ? { weekday: "short" } : { day: "numeric", month: "short" });
}

export function CompanyAnalyticsContent() {
  const [days, setDays] = useState<7 | 30>(30);
  const { data, isLoading, error } = useCompanyAnalytics(days);

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !data) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Impossible de charger l’analyse"
        description="Réessayez dans quelques instants."
      />
    );
  }

  const maxVolume = Math.max(1, ...data.dailyVolume.map((row) => row.count));
  const stats = [
    { label: "Livraisons créées", value: String(data.deliveriesCreated), icon: Package },
    { label: "Livrées", value: String(data.delivered), icon: CheckCircle2 },
    { label: "À l’heure", value: percent(data.onTimeRate), icon: Clock },
    { label: "En retard maintenant", value: String(data.lateNow), icon: Clock },
    { label: "Sans livreur", value: String(data.unassigned), icon: UserX },
    { label: "Facturé", value: formatCurrency(data.invoicedAmount), icon: Receipt },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analyse</h1>
          <p className="mt-1 text-muted-foreground">
            Volume, ponctualité et facturation sur les {days} derniers jours
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {([7, 30] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={days === option ? "brand" : "ghost"}
              onClick={() => setDays(option)}
            >
              {option} jours
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume quotidien</CardTitle>
            <CardDescription>Livraisons créées par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-1">
              {data.dailyVolume.map((row) => (
                <div key={row.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div
                    className={cn("w-full rounded-sm bg-brand/80", row.count === 0 && "bg-muted")}
                    style={{ height: `${Math.max(4, (row.count / maxVolume) * 100)}%` }}
                    title={`${dayLabel(row.date, days)} : ${row.count}`}
                  />
                  {days === 7 ? (
                    <span className="text-[10px] text-muted-foreground">{dayLabel(row.date, days)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaissement</CardTitle>
            <CardDescription>Factures émises sur la période</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Encaissé</span>
              <span className="font-medium">{formatCurrency(data.collectedAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">En attente</span>
              <span className="font-medium">{formatCurrency(data.pendingInvoiceAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-3">
              <span className="text-muted-foreground">Total facturé</span>
              <span className="font-semibold">{formatCurrency(data.invoicedAmount)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clients les plus actifs</CardTitle>
          <CardDescription>Nombre de livraisons créées</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune livraison sur cette période.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.topClients.map((client) => (
                <li key={client.name} className="flex items-center justify-between py-2 text-sm">
                  <span>{client.name}</span>
                  <span className="font-medium">{client.deliveries}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
