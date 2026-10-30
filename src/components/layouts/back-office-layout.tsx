"use client";
import { OrderMessagesInbox } from "@/components/shared/order-conversation";

import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { useUIStore } from "@/stores/ui.store";
import { useAuthStore } from "@/stores/auth.store";
import { canOpenStaffInbox } from "@/lib/constants/conversation-roles";
import type { NavItem, BreadcrumbItem } from "@/types";

interface BackOfficeLayoutProps {
  children: React.ReactNode;
  navItems: NavItem[];
  breadcrumbs?: BreadcrumbItem[];
  sidebarFooter?: React.ReactNode;
  /** Carte dispatch plein écran — sans header ni max-width */
  mapFullscreen?: boolean;
}

/** Coque Glass Light V2 (barre latérale, en-tête, fond, police) commune à tout le back-office. */
export function BackOfficeLayout({
  children,
  navItems,
  breadcrumbs,
  sidebarFooter,
  mapFullscreen = false,
}: BackOfficeLayoutProps) {
  const { sidebarCollapsed } = useUIStore();
  // Super-administrateur, ou mini-admin sans lecture des commandes ni des livraisons : pas d'accès aux
  // échanges ni aux alertes, donc ne pas appeler ces API (403).
  const role = useAuthStore((state) => state.user?.role.systemRole);
  const permissions = useAuthStore((state) => state.permissions);
  const showInbox = canOpenStaffInbox(role, permissions);
  const isLg = useMediaQuery("(min-width: 1024px)");
  // Même retrait que le contenu : barre latérale flottante (12 px + 80/264 px) et son écart.
  const mapSidebarWidth = sidebarCollapsed ? 104 : 292;

  return (
    <div className="dashboard-v2-shell min-h-screen bg-background">
      <Sidebar items={navItems} footer={sidebarFooter} premium />
      <MobileNav items={navItems} premium />

      <div
        className={cn(
          "flex flex-col transition-all duration-300",
          mapFullscreen ? "h-[100dvh] overflow-hidden" : "min-h-screen",
          !mapFullscreen && (sidebarCollapsed ? "lg:pl-[104px]" : "lg:pl-[292px]")
        )}
      >
        {!mapFullscreen && <Header breadcrumbs={breadcrumbs} premium />}
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
            className="flex-1 p-4 max-md:px-3 max-md:py-4 lg:px-8 lg:pb-10 lg:pt-5"
          >
            <div className="mx-auto max-w-[1480px]">
              {showInbox && <OrderMessagesInbox enableDispatchTargets />}
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
