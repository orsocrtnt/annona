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
import { ThemeMenuItem, ThemeToggle } from "@/components/theme/theme-toggle";
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
        className="min-h-11 rounded-xl px-3 text-[#a3aca6] data-[disabled]:opacity-100 dark:text-text-tertiary"
      >
        <Icon className="h-4 w-4" aria-hidden />
        {item.title}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      asChild
      className="min-h-11 cursor-pointer rounded-xl px-3 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring text-[#3d4540] focus:bg-[#f1f6f2] focus:text-[#0e1310] aria-[current=page]:font-semibold aria-[current=page]:text-[#0e1310] dark:text-text-secondary dark:focus:bg-muted dark:focus:text-foreground dark:aria-[current=page]:text-foreground"
    >
      <Link href={item.href} aria-current={isActive ? "page" : undefined} {...prefetchHandlers}>
        <Icon className="h-4 w-4" aria-hidden />
        <span>{item.title}</span>
        {isActive ? <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00a855] dark:bg-brand" aria-hidden /> : null}
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
      // Boutons à 44 px : py-1.5 garde la hauteur rendue en preproduction (58 px, bordures comprises).
      innerClassName="py-1.5"
      className={overlay ? "pointer-events-auto" : undefined}
    >
      <AppleNavbarBrand href="/portal" tone="light" />

      <AppleNavbarLinks
        ariaLabel="Navigation de l’espace client"
        className="hidden min-w-0 flex-1 justify-center xl:flex"
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
        <PortalNotificationsBell className="text-[#5f6a63] hover:bg-black/[0.05] hover:text-[#0e1310] dark:text-muted-foreground dark:hover:bg-white/[0.08] dark:hover:text-foreground" />

        <ThemeToggle className="max-sm:hidden" />

        <div
          className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.07] bg-white max-sm:hidden dark:border-border dark:bg-card"
          title={user ? `${user.firstName} ${user.lastName}` : "Compte client"}
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="bg-[#0e1310] text-xs font-semibold text-white dark:bg-foreground dark:text-background">
              {user ? getInitials(user.firstName, user.lastName) : "C"}
            </AvatarFallback>
          </Avatar>
        </div>

        <Button
          variant="ghost"
          size="icon-touch"
          onClick={logout}
          aria-label="Se déconnecter"
          // La classe partagée fixe h-10 w-10 ; h-11 w-11 placé après l'emporte (cible 44 px).
          className={cn(appleNavbarIconButtonLightClass, "h-11 w-11")}
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(appleNavbarIconButtonLightClass, "h-11 w-11 xl:hidden")}
              aria-label="Ouvrir la navigation client"
            >
              <Menu className="h-5 w-5" aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-72 rounded-2xl border-black/[0.07] bg-white p-2 text-[#0e1310] shadow-[0_18px_50px_rgba(14,19,16,0.12)] dark:border-border dark:bg-popover dark:text-popover-foreground dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
          >
            {/* Sous 640 px, l'avatar quitte la barre : le compte connecté est repris en tête du menu. */}
            <div className="sm:hidden" data-testid="portal-mobile-account">
              <div className="flex items-center gap-3 px-3 py-2">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.avatarUrl ?? undefined} alt="" />
                  <AvatarFallback className="bg-[#0e1310] text-xs font-semibold text-white dark:bg-foreground dark:text-background">
                    {user ? getInitials(user.firstName, user.lastName) : "C"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {user ? `${user.firstName} ${user.lastName}` : "Compte client"}
                  </p>
                  {user?.email ? (
                    <p className="truncate text-xs text-[#68726b] dark:text-muted-foreground">{user.email}</p>
                  ) : null}
                </div>
              </div>
              <DropdownMenuSeparator className="bg-black/[0.07] dark:bg-border" />
            </div>
            <DropdownMenuLabel className="text-xs uppercase tracking-[0.16em] text-[#68726b] dark:text-muted-foreground">
              Espace client
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-black/[0.07] dark:bg-border" />
            {items.map((item) => (
              <PortalMobileNavLink
                key={item.href}
                item={item}
                isActive={isPortalItemActive(pathname, item.href)}
              />
            ))}
            {/* Sous 640 px, le thème passe dans ce menu pour que la barre tienne à 320 px. */}
            <div className="sm:hidden">
              <DropdownMenuSeparator className="bg-black/[0.07] dark:bg-border" />
              <ThemeMenuItem />
            </div>
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
        className="relative h-[calc(100dvh-var(--demo-banner-height,0px))] overflow-hidden bg-[#f0f0f0] [--portal-chrome:4.75rem] dark:bg-muted"
        data-portal-map-page
      >
        <main id="main-content" tabIndex={-1} className="absolute inset-0 z-0">
          <OrderMessagesInbox space="client" />
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

      {/* Marge basse : la pastille flottante « Alertes » ne recouvre jamais le dernier élément de la page. */}
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-24 max-md:px-3 max-md:pt-4 max-md:pb-32 lg:px-6">
        <main id="main-content" tabIndex={-1}>
          <OrderMessagesInbox space="client" />
          {children}
        </main>
      </div>
    </div>
  );
}
