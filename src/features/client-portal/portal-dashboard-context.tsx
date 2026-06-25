"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { PortalDashboardLayoutSettings } from "@/lib/dashboard/portal-dashboard-layout";
import type { PortalDashboardStats } from "@/features/client-portal/types";

interface PortalDashboardContextValue {
  stats: PortalDashboardStats;
  layout: PortalDashboardLayoutSettings;
  setLayout: (layout: PortalDashboardLayoutSettings) => void;
}

const PortalDashboardContext = createContext<PortalDashboardContextValue | null>(null);

export function PortalDashboardProvider({
  stats,
  initialLayout,
  children,
}: {
  stats: PortalDashboardStats;
  initialLayout: PortalDashboardLayoutSettings;
  children: ReactNode;
}) {
  const [layout, setLayout] = useState(initialLayout);

  const value = useMemo(
    () => ({
      stats,
      layout,
      setLayout,
    }),
    [stats, layout]
  );

  return (
    <PortalDashboardContext.Provider value={value}>{children}</PortalDashboardContext.Provider>
  );
}

export function usePortalDashboardContext() {
  const ctx = useContext(PortalDashboardContext);
  if (!ctx) {
    throw new Error("usePortalDashboardContext must be used within PortalDashboardProvider");
  }
  return ctx;
}
