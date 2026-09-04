"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useNavQueryPrefetch, usePrefetchNavHrefs } from "@/hooks/use-nav-query-prefetch";
import { getInitials } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import {
  Package2, LayoutDashboard, ShoppingBag, Truck,
  FileText, HeadphonesIcon, LogOut, Settings, RefreshCw,
} from "lucide-react";

const navItems = [
  { title: "Tableau de bord", href: "/portal", icon: LayoutDashboard },
  { title: "Mes commandes", href: "/portal/orders", icon: ShoppingBag },
  { title: "Récurrentes", href: "/portal/recurring", icon: RefreshCw },
  { title: "Livraisons", href: "/portal/deliveries", icon: Truck },
  { title: "Factures", href: "/portal/invoices", icon: FileText },
  { title: "Support", href: "/portal/support", icon: HeadphonesIcon },
  { title: "Paramètres", href: "/portal/settings", icon: Settings },
];

interface ClientPortalLayoutProps {
  children: React.ReactNode;
}

function PortalHeader({ overlay = false }: { overlay?: boolean }) {
  const { user, logout } = useAuth();

  return (
    <header
      className={cn(
        "shrink-0 backdrop-blur-xl",
        overlay
          ? "border-b border-white/50 bg-white/70"
          : "border-b border-border bg-card/80"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 max-md:h-14 lg:px-6">
        <Link href="/portal" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Package2 className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
        </Link>

        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-brand-subtle text-brand text-xs">
              {user ? getInitials(user.firstName, user.lastName) : "C"}
            </AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon-sm" onClick={logout} aria-label="Se déconnecter">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function PortalNavLink({
  item,
  isActive,
}: {
  item: (typeof navItems)[number];
  isActive: boolean;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      {...prefetchHandlers}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
        "max-md:px-2.5 max-md:py-2 max-md:text-xs",
        isActive
          ? "bg-brand text-white shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.title}
    </Link>
  );
}

function PortalNav({ compact = false, overlay = false }: { compact?: boolean; overlay?: boolean }) {
  const pathname = usePathname();
  usePrefetchNavHrefs(navItems.map((item) => item.href));

  return (
    <nav
      className={cn(
        "flex gap-1 overflow-x-auto rounded-xl border p-1",
        overlay
          ? "border-white/60 bg-white/75 backdrop-blur-xl shadow-sm"
          : "border-border bg-card",
        !compact && "mb-8"
      )}
    >
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/portal" && pathname.startsWith(item.href));
        return (
          <PortalNavLink key={item.href} item={item} isActive={isActive} />
        );
      })}
    </nav>
  );
}

export function ClientPortalLayout({ children }: ClientPortalLayoutProps) {
  const pathname = usePathname();
  const mapFullscreen = pathname === "/portal/deliveries";

  if (mapFullscreen) {
    return (
      <div
        className="relative h-[calc(100dvh-var(--demo-banner-height,0px))] overflow-hidden bg-[#f0f0f0] [--portal-chrome:calc(4rem+1.5rem+2.875rem)] max-md:[--portal-chrome:calc(3.5rem+0.75rem+2.25rem)]"
        data-portal-map-page
      >
        <main className="absolute inset-0 z-0">{children}</main>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
          <div className="pointer-events-auto">
            <PortalHeader overlay />
          </div>
          <div className="pointer-events-auto px-4 pt-6 pb-3 max-md:pt-3 max-md:pb-2 lg:px-6">
            <div className="mx-auto max-w-6xl">
              <PortalNav compact overlay />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      <div className="sticky top-[var(--demo-banner-height,0px)] z-30">
        <PortalHeader />
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6 max-md:px-3 max-md:py-4 lg:px-6">
        <PortalNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
