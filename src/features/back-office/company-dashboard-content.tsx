"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardDeliveryListDialog } from "@/features/back-office/dashboard-delivery-list-dialog";
import type { CompanyDashboardStats } from "@/lib/dashboard/dashboard-types";
import type { DashboardLayoutSettings } from "@/lib/dashboard/dashboard-layout";
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

interface CompanyDashboardContentProps {
  dashboard: CompanyDashboardStats;
  initialLayout: DashboardLayoutSettings;
}

export function CompanyDashboardContent({
  dashboard,
  initialLayout,
}: CompanyDashboardContentProps) {
  return (
    <DashboardProvider dashboard={dashboard} initialLayout={initialLayout}>
      <CompanyDashboardView />
    </DashboardProvider>
  );
}

function CompanyDashboardView() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const {
    layout,
    drillDown,
    closeDrillDown,
    drillDownItems,
  } = useDashboardContext();

  const widgetGroups = useMemo(() => {
    const visible = getVisibleDashboardWidgets(layout);
    return groupDashboardWidgets(visible);
  }, [layout]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
          <p className="mt-1 text-muted-foreground">Pilotez vos opérations de livraison</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardCustomizeButton onClick={() => setCustomizeOpen(true)} />
          <Link href="/dispatch">
            <Button variant="outline">
              <Radio className="mr-2 h-4 w-4" />
              Dispatch
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button variant="brand">
              <Package className="mr-2 h-4 w-4" />
              Commandes
            </Button>
          </Link>
        </div>
      </div>

      {widgetGroups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Aucun bloc affiché. Cliquez sur{" "}
            <button
              type="button"
              className="font-medium text-brand underline-offset-2 hover:underline"
              onClick={() => setCustomizeOpen(true)}
            >
              +
            </button>{" "}
            pour personnaliser votre dashboard.
          </p>
        </div>
      ) : (
        widgetGroups.map((group, index) =>
          group.kind === "compact" ? (
            <DashboardCompactGrid key={`compact-${index}`} widgets={group.widgets} />
          ) : (
            group.widgets.map((widget) => (
              <DashboardWidgetRenderer key={widget.type} widget={widget} />
            ))
          )
        )
      )}

      <DashboardDeliveryListDialog
        open={drillDown !== null}
        onOpenChange={(open) => {
          if (!open) closeDrillDown();
        }}
        title={drillDown?.title ?? ""}
        description={drillDown?.description}
        items={drillDownItems}
      />

      <DashboardCustomizeDrawer open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </div>
  );
}
