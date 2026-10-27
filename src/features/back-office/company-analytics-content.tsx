"use client";

import { useState } from "react";
import { BarChart3, Package, CheckCircle2, Clock, UserX, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyAnalytics } from "@/features/back-office/hooks";
import { formatCurrency } from "@/features/client-portal/utils";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import { collectedShare, volumeSummary } from "@/lib/analytics/summary";
import { withoutRolePrefix } from "@/lib/format/person-labels";

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
  const volume = volumeSummary(data.dailyVolume);
  const share = collectedShare(data.collectedAmount, data.pendingInvoiceAmount);
  const maxClient = Math.max(1, ...data.topClients.map((client) => client.deliveries));
  // Axe des dates : chaque jour sur 7 jours, trois repères sur 30 jours.
  const axis = days === 7
    ? data.dailyVolume.map((row) => row.date)
    : [data.dailyVolume[0]?.date, data.dailyVolume[Math.floor(data.dailyVolume.length / 2)]?.date, data.dailyVolume.at(-1)?.date].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analyse</h1>
          <p className="mt-1 text-muted-foreground">
            Volume, ponctualité et facturation sur les {days} derniers jours
          </p>
        </div>
        <div className="flex w-fit gap-1 rounded-xl border border-border bg-card p-1" role="group" aria-label="Période">
          {([7, 30] as const).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={days === option ? "brand" : "ghost"}
              aria-pressed={days === option}
              onClick={() => setDays(option)}
            >
              {option} jours
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Livraisons créées" value={data.deliveriesCreated} icon={Package} />
        <StatCard label="Livrées" value={data.delivered} icon={CheckCircle2} tone="success" />
        <StatCard label="À l’heure" value={percent(data.onTimeRate)} icon={Clock} />
        <StatCard label="En retard maintenant" value={data.lateNow} icon={Clock} tone="critical" />
        <StatCard label="Sans livreur" value={data.unassigned} icon={UserX} tone="warning" />
        <StatCard label="Facturé" value={formatCurrency(data.invoicedAmount)} icon={Receipt} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Volume quotidien</CardTitle>
            <CardDescription>
              {volume.total
                ? `${volume.total} livraison${volume.total > 1 ? "s" : ""} créée${volume.total > 1 ? "s" : ""} · pic de ${volume.peak!.count} le ${dayLabel(volume.peak!.date, 30)}`
                : "Aucune livraison créée sur la période"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Chaque colonne prend toute la hauteur : sans cela la barre (en %) retombait à zéro. */}
            <div className="flex h-40 items-end gap-1" aria-hidden="true">
              {data.dailyVolume.map((row) => (
                <div key={row.date} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                  <div
                    className={cn("w-full rounded-t-[3px]", row.count === 0 ? "bg-[#eef1ef]" : "bg-[#0e1310]")}
                    style={{ height: `${Math.max(3, (row.count / maxVolume) * 100)}%` }}
                    title={`${dayLabel(row.date, days)} : ${row.count}`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
              {axis.map((date) => (
                <span key={date}>{dayLabel(date, days)}</span>
              ))}
            </div>
            <table className="sr-only">
              <caption>Livraisons créées par jour</caption>
              <tbody>
                {data.dailyVolume.filter((row) => row.count > 0).map((row) => (
                  <tr key={row.date}>
                    <th scope="row">{dayLabel(row.date, 30)}</th>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Encaissement</CardTitle>
            <CardDescription>
              {share == null ? "Aucune facture émise sur la période" : `${share} % de ce qui a été facturé est encaissé`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {share != null && (
              <div className="flex h-2.5 overflow-hidden rounded-full bg-[#eef1ef]" aria-hidden="true">
                <span className="h-full bg-[#0e1310]" style={{ width: `${share}%` }} />
                <span className="h-full bg-[#f2b84b]" style={{ width: `${100 - share}%` }} />
              </div>
            )}
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-[#0e1310]" aria-hidden="true" /> Encaissé
                </dt>
                <dd className="font-medium tabular-nums">{formatCurrency(data.collectedAmount)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="inline-flex items-center gap-2 text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-[#f2b84b]" aria-hidden="true" /> En attente
                </dt>
                <dd className="font-medium tabular-nums">{formatCurrency(data.pendingInvoiceAmount)}</dd>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <dt className="text-muted-foreground">Total facturé</dt>
                <dd className="font-semibold tabular-nums">{formatCurrency(data.invoicedAmount)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Clients les plus actifs</CardTitle>
          <CardDescription>Livraisons créées sur la période</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune livraison sur cette période.</p>
          ) : (
            <ul className="space-y-3">
              {data.topClients.map((client) => (
                <li key={client.name} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate">{withoutRolePrefix(client.name)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[#eef1ef]" aria-hidden="true">
                    <span className="block h-full rounded-full bg-[#0e1310]" style={{ width: `${(client.deliveries / maxClient) * 100}%` }} />
                  </span>
                  <span className="font-medium tabular-nums">
                    {client.deliveries}
                    <span className="sr-only"> livraison{client.deliveries > 1 ? "s" : ""}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
