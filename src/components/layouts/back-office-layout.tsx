"use client";

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
}

export function BackOfficeLayout({
  children,
  navItems,
  breadcrumbs,
  sidebarFooter,
  mapFullscreen = false,
}: BackOfficeLayoutProps) {
  const { sidebarCollapsed } = useUIStore();
  const isLg = useMediaQuery("(min-width: 1024px)");
  const mapSidebarWidth = sidebarCollapsed ? 72 : 256;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar items={navItems} footer={sidebarFooter} />
      <MobileNav items={navItems} />

      <div
        className={cn(
          "flex flex-col transition-all duration-300",
          mapFullscreen ? "h-[100dvh] overflow-hidden" : "min-h-screen",
          !mapFullscreen && (sidebarCollapsed ? "lg:pl-[72px]" : "lg:pl-64")
        )}
      >
        {!mapFullscreen && <Header breadcrumbs={breadcrumbs} />}
        {mapFullscreen ? (
          <main
            data-map-main=""
            className="fixed top-0 right-0 bottom-0 z-0 overflow-hidden transition-[left] duration-300 ease-in-out"
            style={{ left: isLg ? mapSidebarWidth : 0 }}
          >
            {children}
          </main>
        ) : (
          <main className="flex-1 p-4 max-md:px-3 max-md:py-4 lg:p-6">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        )}
      </div>
    </div>
  );
}
