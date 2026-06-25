"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CompanyDashboardStats, DashboardPeriodKey } from "@/lib/dashboard/dashboard-types";
import type { DashboardLayoutSettings } from "@/lib/dashboard/dashboard-layout";
import {
  resolveDrillDownItems,
  type DashboardDrillDown,
} from "@/features/back-office/dashboard-drill-down";

interface DashboardContextValue {
  dashboard: CompanyDashboardStats;
  period: DashboardPeriodKey;
  setPeriod: (period: DashboardPeriodKey) => void;
  drillDown: DashboardDrillDown | null;
  openDrillDown: (next: DashboardDrillDown) => void;
  closeDrillDown: () => void;
  drillDownItems: ReturnType<typeof resolveDrillDownItems>;
  layout: DashboardLayoutSettings;
  setLayout: (layout: DashboardLayoutSettings) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({
  dashboard,
  initialLayout,
  children,
}: {
  dashboard: CompanyDashboardStats;
  initialLayout: DashboardLayoutSettings;
  children: ReactNode;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [period, setPeriod] = useState<DashboardPeriodKey>(initialLayout.defaultPeriod);
  const [drillDown, setDrillDown] = useState<DashboardDrillDown | null>(null);

  const drillDownItems = useMemo(
    () => resolveDrillDownItems(dashboard, period, drillDown),
    [dashboard, period, drillDown]
  );

  const value = useMemo(
    () => ({
      dashboard,
      period,
      setPeriod,
      drillDown,
      openDrillDown: setDrillDown,
      closeDrillDown: () => setDrillDown(null),
      drillDownItems,
      layout,
      setLayout,
    }),
    [dashboard, period, drillDown, drillDownItems, layout]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboardContext must be used within DashboardProvider");
  }
  return ctx;
}

export function useWidgetPeriod(widgetPeriod?: DashboardPeriodKey) {
  const { period, layout } = useDashboardContext();
  return widgetPeriod ?? layout.defaultPeriod;
}
