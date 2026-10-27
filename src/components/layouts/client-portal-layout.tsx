"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  HeadphonesIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  ShoppingBag,
  Truck,
} from "lucide-react";

import {
  AppleNavbar,
  AppleNavbarBrand,
  AppleNavbarLink,
  AppleNavbarLinks,
  appleNavbarIconButtonLightClass,
} from "@/components/navigation/apple-navbar";
import { OrderMessagesInbox } from "@/components/shared/order-conversation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PortalNotificationsBell } from "@/features/client-portal/portal-notifications-bell";
import { applyOfferNavLocks } from "@/features/saas/offer-nav";
import { useOfferAccess } from "@/features/saas/use-offer-access";
import { useAuth } from "@/hooks/use-auth";
import { useNavQueryPrefetch } from "@/hooks/use-nav-query-prefetch";
import { cn, getInitials } from "@/lib/utils";

const navItems = [
  { title: "Tableau de bord", href: "/portal", icon: LayoutDashboard },
  { title: "Mes commandes", href: "/portal/orders", icon: ShoppingBag },
  { title: "Récurrentes", href: "/portal/recurring", icon: RefreshCw },
  { title: "Livraisons", href: "/portal/deliveries", icon: Truck },
  { title: "Factures", href: "/portal/invoices", icon: FileText },
  { title: "Support", href: "/portal/support", icon: HeadphonesIcon },
  { title: "Paramètres", href: "/portal/settings", icon: Settings },
];

type PortalNavItem = (typeof navItems)[number] & {
  disabled?: boolean;
  disabledReason?: string;
};

interface ClientPortalLayoutProps {
  children: React.ReactNode;
}

function isPortalItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/portal" && pathname.startsWith(href));
}

function PortalDesktopNavLink({
  item,
  isActive,
}: {
  item: PortalNavItem;
  isActive: boolean;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);

  return (
    <AppleNavbarLink
      tone="light"
      href={item.href}
      active={isActive}
      disabled={item.disabled}
      disabledReason={item.disabledReason}
      {...(item.disabled ? {} : prefetchHandlers)}
    >
      {item.title}
    </AppleNavbarLink>
  );
}

function PortalMobileNavLink({
  item,
  isActive,
}: {
  item: PortalNavItem;
  isActive: boolean;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  if (item.disabled) {
    return (
      <DropdownMenuItem
        disabled
        title={item.disabledReason}
        className="min-h-11 rounded-xl px-3 text-[#a3aca6] data-[disabled]:opacity-100"
      >
        <Icon className="h-4 w-4" aria-hidden />
        {item.title}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      asChild
      className="min-h-11 cursor-pointer rounded-xl px-3 text-[#3d4540] focus:bg-[#f1f6f2] focus:text-[#0e1310] aria-[current=page]:font-semibold aria-[current=page]:text-[#0e1310]"
    >
      <Link href={item.href} aria-current={isActive ? "page" : undefined} {...prefetchHandlers}>
        <Icon className="h-4 w-4" aria-hidden />
        <span>{item.title}</span>
        {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00a855]" aria-hidden /> : null}
      </Link>
    </DropdownMenuItem>
  );
}

function PortalNavbar({ overlay = false }: { overlay?: boolean }) {
  const pathname = usePathname();
  const saas = useOfferAccess();
  const items = applyOfferNavLocks(navItems, saas);
  const { user, logout } = useAuth();

  return (
    <AppleNavbar
      tone="light"
      sticky={!overlay}
      maxWidthClassName="max-w-7xl"
      className={overlay ? "pointer-events-auto" : undefined}
    >
      <AppleNavbarBrand href="/portal" tone="light" />

      <AppleNavbarLinks
        ariaLabel="Navigation de l’espace client"
        className="absolute left-1/2 hidden -translate-x-1/2 xl:flex"
      >
        {items.map((item) => (
          <PortalDesktopNavLink
            key={item.href}
            item={item}
            isActive={isPortalItemActive(pathname, item.href)}
          />
        ))}
      </AppleNavbarLinks>

      <div className="ml-auto flex items-center gap-1">
        <PortalNotificationsBell className="text-[#5f6a63] hover:bg-black/[0.05] hover:text-[#0e1310]" />

        <div
          className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.07] bg-white"
          title={user ? `${user.firstName} ${user.lastName}` : "Compte client"}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-[#0e1310] text-[10px] font-semibold text-white">
              {user ? getInitials(user.firstName, user.lastName) : "C"}
            </AvatarFallback>
          </Avatar>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={logout}
          aria-label="Se déconnecter"
          className={appleNavbarIconButtonLightClass}
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(appleNavbarIconButtonLightClass, "xl:hidden")}
              aria-label="Ouvrir la navigation client"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 rounded-2xl border-black/[0.07] bg-white p-2 text-[#0e1310] shadow-[0_18px_50px_rgba(14,19,16,0.12)]"
          >
            <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-[#68726b]">
              Espace client
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-black/[0.07]" />
            {items.map((item) => (
              <PortalMobileNavLink
                key={item.href}
                item={item}
                isActive={isPortalItemActive(pathname, item.href)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AppleNavbar>
  );
}

export function ClientPortalLayout({ children }: ClientPortalLayoutProps) {
  const pathname = usePathname();
  const mapFullscreen = pathname === "/portal/deliveries";

  if (mapFullscreen) {
    return (
      <div
        className="relative h-[calc(100dvh-var(--demo-banner-height,0px))] overflow-hidden bg-[#f0f0f0] [--portal-chrome:4.75rem]"
        data-portal-map-page
      >
        <main id="main-content" tabIndex={-1} className="absolute inset-0 z-0">
          <OrderMessagesInbox />
          {children}
        </main>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
          <PortalNavbar overlay />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNavbar />

      <div className="mx-auto max-w-6xl px-4 py-6 max-md:px-3 max-md:py-4 lg:px-6">
        <main id="main-content" tabIndex={-1}>
          <OrderMessagesInbox />
          {children}
        </main>
      </div>
    </div>
  );
}
