"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Package,
  Plus,
  RefreshCw,
  Truck,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { ChartPlaceholder } from "@/components/ui/chart-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { etaDayLabel, formatEta } from "@/features/client-portal/utils";
import { formatPlace } from "@/lib/format/place";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import type { PortalDashboardWidgetLayout } from "@/lib/dashboard/portal-dashboard-layout";
import { usePortalDashboardContext } from "@/features/client-portal/portal-dashboard-context";

/** L'heure seule ne suffit pas : on dit aussi quel jour (aujourd'hui, demain, date). */
function NextDeliveryCard({ eta }: { eta: string | null }) {
  return (
    <StatCard
      label="Prochaine livraison"
      value={eta ? formatEta(eta) : "—"}
      changeLabel={etaDayLabel(eta)}
      icon={Clock}
    />
  );
}

function StatsRowWidget() {
  const { stats } = usePortalDashboardContext();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Commandes actives" value={stats.activeOrders} icon={Package} />
      <StatCard label="En livraison" value={stats.inDelivery} icon={Truck} />
      <StatCard label="Livrées ce mois" value={stats.deliveredThisMonth} icon={CheckCircle2} />
      <NextDeliveryCard eta={stats.nextDeliveryEta} />
    </div>
  );
}

function StatActiveOrdersWidget() {
  const { stats } = usePortalDashboardContext();
  return <StatCard label="Commandes actives" value={stats.activeOrders} icon={Package} />;
}

function StatInDeliveryWidget() {
  const { stats } = usePortalDashboardContext();
  return <StatCard label="En livraison" value={stats.inDelivery} icon={Truck} />;
}

function StatDeliveredMonthWidget() {
  const { stats } = usePortalDashboardContext();
  return (
    <StatCard label="Livrées ce mois" value={stats.deliveredThisMonth} icon={CheckCircle2} />
  );
}

function StatNextDeliveryWidget() {
  const { stats } = usePortalDashboardContext();
  return (
    <NextDeliveryCard eta={stats.nextDeliveryEta} />
  );
}

function ChartOrdersHistoryWidget() {
  return <ChartPlaceholder title="Historique des commandes" type="area" />;
}

function ChartDeliveriesStatusWidget() {
  return <ChartPlaceholder title="Livraisons par statut" type="bar" />;
}

function RecentDeliveriesWidget() {
  const { stats } = usePortalDashboardContext();
  const recentDeliveries = stats.recentDeliveries ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Livraisons récentes</CardTitle>
        <Link href="/portal/deliveries" className="text-sm text-brand hover:underline">
          Voir tout
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {recentDeliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune livraison pour le moment.</p>
        ) : (
          recentDeliveries.map((d) => (
            <Link
              key={d.id}
              href={`/portal/deliveries/${d.id}`}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
            >
              {/* L'adresse identifie la livraison ; la référence reste en petit dessous. */}
              <div className="min-w-0">
                <p className="truncate font-medium">{formatPlace(d.address, d.city) ?? "Livraison"}</p>
                <p className="text-xs tabular-nums text-muted-foreground">{d.reference}</p>
              </div>
              <DeliveryStatusBadge status={d.status} deliveryCategory={d.deliveryCategory} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function QuickActionsWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Raccourcis</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Button variant="brand" className="w-full justify-start" asChild>
          <Link href="/portal/orders/new">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle commande
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/portal/orders">
            <Package className="mr-2 h-4 w-4" />
            Mes commandes
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/portal/deliveries">
            <Truck className="mr-2 h-4 w-4" />
            Livraisons
          </Link>
        </Button>
        <Button variant="outline" className="w-full justify-start" asChild>
          <Link href="/portal/recurring">
            <RefreshCw className="mr-2 h-4 w-4" />
            Récurrences
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OrdersFootnoteWidget() {
  const { stats } = usePortalDashboardContext();
  const orderCount = stats.orderCount ?? 0;
  if (orderCount === 0) return null;

  return (
    <p className="text-center text-sm text-muted-foreground">
      {orderCount} commande{orderCount > 1 ? "s" : ""} au total —{" "}
      <Link href="/portal/orders" className="text-brand hover:underline">
        voir mes commandes
      </Link>
    </p>
  );
}

function PortalDashboardWidget({ widget }: { widget: PortalDashboardWidgetLayout }) {
  switch (widget.type) {
    case "stats-row":
      return <StatsRowWidget />;
    case "stat-active-orders":
      return <StatActiveOrdersWidget />;
    case "stat-in-delivery":
      return <StatInDeliveryWidget />;
    case "stat-delivered-month":
      return <StatDeliveredMonthWidget />;
    case "stat-next-delivery":
      return <StatNextDeliveryWidget />;
    case "chart-orders-history":
      return <ChartOrdersHistoryWidget />;
    case "chart-deliveries-status":
      return <ChartDeliveriesStatusWidget />;
    case "recent-deliveries":
      return <RecentDeliveriesWidget />;
    case "quick-actions":
      return <QuickActionsWidget />;
    case "orders-footnote":
      return <OrdersFootnoteWidget />;
    default:
      return null;
  }
}

export function PortalDashboardWidgetRenderer({ widget }: { widget: PortalDashboardWidgetLayout }) {
  return <PortalDashboardWidget widget={widget} />;
}

export function PortalDashboardCompactGrid({ widgets }: { widgets: PortalDashboardWidgetLayout[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {widgets.map((widget) => (
        <PortalDashboardWidget key={widget.type} widget={widget} />
      ))}
    </div>
  );
}
