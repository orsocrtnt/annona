"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /** Ajouts à droite de l'en-tête (recherche globale du super-administrateur). */
  headerActions?: React.ReactNode;
}

/** Coque Glass Light V2 (barre latérale, en-tête, fond, police) commune à tout le back-office. */
export function BackOfficeLayout({
  children,
  navItems,
  breadcrumbs,
  sidebarFooter,
  mapFullscreen = false,
  headerActions,
}: BackOfficeLayoutProps) {
  const { sidebarCollapsed, toggleMobileNav } = useUIStore();
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
        {!mapFullscreen && <Header breadcrumbs={breadcrumbs} premium actions={headerActions} />}
        {mapFullscreen && (
          // Carte plein écran : sans en-tête, ce bouton est le seul accès au menu sur téléphone.
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed bottom-20 left-3 z-10 h-11 w-11 rounded-full bg-card shadow-md lg:hidden"
            onClick={toggleMobileNav}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        {mapFullscreen ? (
          <main
            id="main-content"
            tabIndex={-1}
            data-map-main=""
            className="fixed right-0 bottom-0 z-0 overflow-hidden transition-[left,top] duration-300 ease-in-out"
            style={{
              left: isLg ? mapSidebarWidth : 0,
              top: 0,
            }}
          >
            {children}
          </main>
        ) : (
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 p-4 max-md:px-3 max-md:pt-4 max-md:pb-32 lg:px-8 lg:pb-24 lg:pt-5"
          >
            <div className="mx-auto max-w-[1480px]">
              {children}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
