"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/loader";
import { subscriptionApi } from "./subscription-api";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });
const discoveryDateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});
const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function formatDate(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "Non définie";
}

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

export function SubscriptionContent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["company", "subscription", "readonly"],
    queryFn: subscriptionApi.get,
    retry: false,
  });

  if (isLoading) return <PageLoader />;
  if (error) {
    return <section role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-5 text-sm">
      Impossible de charger l’abonnement. Réessayez plus tard ou contactez l’équipe TutelLiv.
    </section>;
  }
  if (!data) {
    return <section className="rounded-xl border border-dashed p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mon abonnement</h1>
      <p className="mt-2 text-muted-foreground">Aucun abonnement actif n’est disponible pour cette entreprise.</p>
    </section>;
  }

  return <div className="space-y-6" data-subscription-readonly="true">
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Mon abonnement</h1>
      <p className="mt-1 text-muted-foreground">Consultation locale de l’état et de l’historique. Les modifications ne sont pas proposées ici.</p>
    </header>

    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{data.formula.name}</CardTitle>
          <CardDescription>{data.formula.code} · {data.billingInterval === "ANNUAL" ? "Annuel" : "Mensuel"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Statut : </span>{data.status}</p>
          <p><span className="text-muted-foreground">Début : </span>{formatDate(data.period.startsAt)}</p>
          <p><span className="text-muted-foreground">Fin : </span>{formatDate(data.period.endsAt)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Consommation de commandes</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {data.usage ? <p>{data.usage.usedOrders} utilisées sur {data.usage.includedOrders} incluses · {data.usage.overageOrders} en dépassement</p> : <p className="text-muted-foreground">Aucune période de consommation disponible.</p>}
        </CardContent>
      </Card>
    </div>

    {data.premiumDiscovery && <Card data-premium-discovery="active" className="border-brand/30 bg-brand-subtle/40">
      <CardHeader>
        <CardTitle>Découverte premium active</CardTitle>
        <CardDescription>
          Jusqu’au {discoveryDateFormat.format(new Date(data.premiumDiscovery.endsAt))} (heure de Paris)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ces fonctions sont temporairement ouvertes. Vos quotas et votre facturation restent inchangés.
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Fonctions de la découverte premium">
          {data.premiumDiscovery.features.map((feature) => <li key={feature.code}>
            <Badge variant="brand">{feature.name}</Badge>
          </li>)}
        </ul>
      </CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle>Options actives</CardTitle></CardHeader>
      <CardContent>
        {data.options.length === 0 ? <p className="text-sm text-muted-foreground">Aucune option active.</p> : <ul className="space-y-2 text-sm">
          {data.options.map((option) => <li key={option.code} className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border p-3"><span>{option.name} × {option.quantity}</span><span className="text-muted-foreground">{formatMoney(option.unitPriceCents)} par {data.billingInterval === "ANNUAL" ? "an" : "mois"}</span></li>)}
        </ul>}
      </CardContent>
    </Card>

    {data.alerts.length > 0 && <Card>
      <CardHeader><CardTitle>Alertes</CardTitle></CardHeader>
      <CardContent><ul className="space-y-2 text-sm" aria-label="Alertes d’abonnement">{data.alerts.map((alert) => <li key={alert.code} className="rounded-lg bg-amber-500/10 p-3 text-amber-950 dark:text-amber-100">{alert.label}</li>)}</ul></CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle>Historique</CardTitle><CardDescription>Opérations et factures connues, sans données fournisseur.</CardDescription></CardHeader>
      <CardContent>
        {data.history.length === 0 ? <p className="text-sm text-muted-foreground">Aucun historique disponible.</p> : <ol className="space-y-3 text-sm">
          {data.history.map((entry, index) => <li key={`${entry.type}-${entry.occurredAt}-${index}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b pb-3 last:border-0"><span>{entry.label} · {entry.status}</span><span className="text-muted-foreground">{formatDate(entry.occurredAt)}{entry.amountCents !== undefined ? ` · ${formatMoney(entry.amountCents)}` : ""}</span></li>)}
        </ol>}
      </CardContent>
    </Card>
  </div>;
}
