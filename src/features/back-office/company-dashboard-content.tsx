"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Package, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DashboardDeliveryListDialog } from "@/features/back-office/dashboard-delivery-list-dialog";
import { useCompanyDashboard } from "@/features/back-office/hooks";
import { useDashboardLayout } from "@/features/back-office/dashboard-layout-hooks";
import { DEFAULT_DASHBOARD_LAYOUT } from "@/lib/dashboard/dashboard-layout";
import {
  getVisibleDashboardWidgets,
  groupDashboardWidgets,
} from "@/lib/dashboard/dashboard-layout";
import { DashboardProvider, useDashboardContext } from "@/features/back-office/dashboard-context";
import {
  DashboardCompactGrid,
  DashboardWidgetRenderer,
} from "@/features/back-office/dashboard-widget-renderer";
import {
  DashboardCustomizeButton,
  DashboardCustomizeDrawer,
} from "@/features/back-office/dashboard-customize-drawer";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { isLateDashboardDrillDown } from "@/features/back-office/dashboard-drill-down";
import { useAuth } from "@/hooks/use-auth";

export function CompanyDashboardContent() {
  const { data: dashboard, isLoading, error } = useCompanyDashboard();
  const { data: layout } = useDashboardLayout();

  if (isInitialQueryLoading(isLoading, dashboard)) return <PageSkeleton />;

  if (error || !dashboard) {
    return (
      <EmptyState
        icon={Package}
        title="Impossible de charger le tableau de bord"
        description="Réessayez dans quelques instants."
      />
    );
  }

  return (
    <DashboardProvider dashboard={dashboard} initialLayout={layout ?? DEFAULT_DASHBOARD_LAYOUT}>
      <CompanyDashboardView />
    </DashboardProvider>
  );
}

function CompanyDashboardView() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { layout, drillDown, closeDrillDown, drillDownItems } = useDashboardContext();
  const { user } = useAuth();

  const widgetGroups = useMemo(() => {
    const visible = getVisibleDashboardWidgets(layout);
    return groupDashboardWidgets(visible);
  }, [layout]);

  return (
    <div className="dashboard-v2-content space-y-6 pb-3">
      <div className="flex flex-wrap items-end justify-between gap-5 py-2 lg:py-3">
        <div className="max-w-2xl">
          <h1 className="text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[#0e1310]">
            Bonjour{user?.firstName ? ` ${user.firstName}` : ""}.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#68726b] sm:text-base">
            Les opérations essentielles, les alertes et l&apos;activité de vos missions en un coup
            d&apos;œil.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <DashboardCustomizeButton
            className="h-11 w-11 rounded-full border-black/[0.08] bg-white text-[#0e1310] shadow-[0_7px_24px_rgba(14,19,16,0.055)] hover:bg-[#f0f3f0]"
            onClick={() => setCustomizeOpen(true)}
          />
          <Button
            variant="outline"
            className="h-11 rounded-full border-black/[0.08] bg-white px-5 text-[#0e1310] shadow-[0_7px_24px_rgba(14,19,16,0.055)] hover:bg-[#f0f3f0]"
            asChild
          >
            <Link href="/dashboard/orders">
              <Package className="mr-2 h-4 w-4" />
              Voir les commandes
            </Link>
          </Button>
          <Button
            className="h-11 rounded-full bg-[#0e1310] px-5 text-white shadow-[0_12px_28px_rgba(14,19,16,0.18)] transition-transform hover:-translate-y-0.5 hover:bg-[#1b251f]"
            asChild
          >
            <Link href="/dispatch">
              <Radio className="mr-2 h-4 w-4 text-[#00d46a]" />
              Ouvrir le dispatch
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {widgetGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun bloc affiché. Cliquez sur{" "}
            <button
              type="button"
              aria-label="Personnaliser le tableau de bord"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={() => setCustomizeOpen(true)}
            >
              +
            </button>{" "}
            pour personnaliser votre dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {widgetGroups.map((group, index) =>
            group.kind === "compact" ? (
              <DashboardCompactGrid key={`compact-${index}`} widgets={group.widgets} />
            ) : (
              group.widgets.map((widget) => (
                <DashboardWidgetRenderer key={widget.type} widget={widget} />
              ))
            )
          )}
        </div>
      )}

      <DashboardDeliveryListDialog
        open={drillDown !== null}
        onOpenChange={(open) => {
          if (!open) closeDrillDown();
        }}
        title={drillDown?.title ?? ""}
        description={drillDown?.description}
        items={drillDownItems}
        focusLate={isLateDashboardDrillDown(drillDown)}
      />

      <DashboardCustomizeDrawer open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </div>
  );
}
