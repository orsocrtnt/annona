"use client";
import { OrderMessagesInbox } from "@/components/shared/order-conversation";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { useUIStore } from "@/stores/ui.store";
import type { NavItem, BreadcrumbItem } from "@/types";

interface BackOfficeLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  breadcrumbs?: BreadcrumbItem[];
  sidebarFooter?: React.ReactNode;
  /** Carte dispatch plein écran — sans header ni max-width */
  mapFullscreen?: boolean;
  /** Direction Glass Light V2, limitée au tableau de bord entreprise. */
  dashboardVisualV2?: boolean;
}

export function BackOfficeLayout({
  children,
  navItems,
  breadcrumbs,
  sidebarFooter,
  mapFullscreen = false,
  dashboardVisualV2 = false,
}: BackOfficeLayoutProps) {
  const { sidebarCollapsed } = useUIStore();
  const isLg = useMediaQuery("(min-width: 1024px)");
  const mapSidebarWidth = sidebarCollapsed ? 72 : 256;

  return (
    <div
      className={cn(
        "min-h-screen bg-background",
        dashboardVisualV2 && "dashboard-v2-shell bg-[#f8f9f7]"
      )}
    >
      <Sidebar items={navItems} footer={sidebarFooter} premium={dashboardVisualV2} />
      <MobileNav items={navItems} premium={dashboardVisualV2} />

      <div
        className={cn(
          "flex flex-col transition-all duration-300",
          mapFullscreen ? "h-[100dvh] overflow-hidden" : "min-h-screen",
          !mapFullscreen &&
            (dashboardVisualV2
              ? sidebarCollapsed
                ? "lg:pl-[104px]"
                : "lg:pl-[292px]"
              : sidebarCollapsed
                ? "lg:pl-[72px]"
                : "lg:pl-64")
        )}
      >
        {!mapFullscreen && <Header breadcrumbs={breadcrumbs} premium={dashboardVisualV2} />}
        {mapFullscreen ? (
          <main
            id="main-content"
            tabIndex={-1}
            data-map-main=""
            className="fixed right-0 bottom-0 z-0 overflow-hidden transition-[left,top] duration-300 ease-in-out"
            style={{
              left: isLg ? mapSidebarWidth : 0,
              top: "var(--demo-banner-height, 0px)",
            }}
          >
            {children}
          </main>
        ) : (
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              "flex-1 p-4 max-md:px-3 max-md:py-4 lg:p-6",
              dashboardVisualV2 && "lg:px-8 lg:pb-10 lg:pt-5"
            )}
          >
            <div className={cn("mx-auto max-w-7xl", dashboardVisualV2 && "max-w-[1480px]")}>
              {dashboardVisualV2 ? (
                <>
                  {children}
                  <div className="dashboard-v2-alerts mt-6">
                    <OrderMessagesInbox enableDispatchTargets />
                  </div>
                </>
              ) : (
                <>
                  <OrderMessagesInbox enableDispatchTargets />
                  {children}
                </>
              )}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
