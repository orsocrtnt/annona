"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalDashboardStats } from "./types";
import type { PortalDashboardLayoutSettings } from "@/lib/dashboard/portal-dashboard-layout";
import {
  getVisiblePortalDashboardWidgets,
  groupPortalDashboardWidgets,
} from "@/lib/dashboard/portal-dashboard-layout";
import { PortalDashboardProvider, usePortalDashboardContext } from "./portal-dashboard-context";
import {
  PortalDashboardCompactGrid,
  PortalDashboardWidgetRenderer,
} from "./portal-dashboard-widget-renderer";
import {
  PortalDashboardCustomizeButton,
  PortalDashboardCustomizeDrawer,
} from "./portal-dashboard-customize-drawer";

interface PortalDashboardContentProps {
  stats: PortalDashboardStats;
  initialLayout: PortalDashboardLayoutSettings;
}

export function PortalDashboardContent({ stats, initialLayout }: PortalDashboardContentProps) {
  return (
    <PortalDashboardProvider stats={stats} initialLayout={initialLayout}>
      <PortalDashboardView />
    </PortalDashboardProvider>
  );
}

function PortalDashboardView() {
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const { layout } = usePortalDashboardContext();

  const widgetGroups = useMemo(() => {
    const visible = getVisiblePortalDashboardWidgets(layout);
    return groupPortalDashboardWidgets(visible);
  }, [layout]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mon espace</h1>
          <p className="mt-1 text-muted-foreground">
            Suivez vos commandes et livraisons en temps réel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PortalDashboardCustomizeButton onClick={() => setCustomizeOpen(true)} />
          <Link href="/portal/orders/new">
            <Button variant="brand">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle commande
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
            pour personnaliser votre espace.
          </p>
        </div>
      ) : (
        widgetGroups.map((group, index) =>
          group.kind === "compact" ? (
            <PortalDashboardCompactGrid key={`compact-${index}`} widgets={group.widgets} />
          ) : (
            group.widgets.map((widget) => (
              <PortalDashboardWidgetRenderer key={widget.type} widget={widget} />
            ))
          )
        )
      )}

      <PortalDashboardCustomizeDrawer open={customizeOpen} onOpenChange={setCustomizeOpen} />
    </div>
  );
}
