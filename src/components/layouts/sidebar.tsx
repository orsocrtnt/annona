"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/ui.store";
import { APP_NAME } from "@/lib/constants";
import { isNavItemActive } from "@/lib/navigation/is-nav-item-active";
import { useNavQueryPrefetch } from "@/hooks/use-nav-query-prefetch";
import { ChevronLeft, Package2 } from "lucide-react";
import type { NavItem } from "@/types";

interface SidebarProps {
  items: NavItem[];
  footer?: React.ReactNode;
  premium?: boolean;
}

function SidebarNavLink({
  item,
  isActive,
  sidebarCollapsed,
  className,
  premium,
}: {
  item: NavItem;
  isActive: boolean;
  sidebarCollapsed: boolean;
  className: string;
  premium: boolean;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  return (
    <Link
      key={item.href}
      href={item.href}
      aria-label={sidebarCollapsed ? item.title : undefined}
      aria-current={isActive ? "page" : undefined}
      {...prefetchHandlers}
      className={className}
    >
      {Icon && (
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            premium
              ? isActive
                ? "text-[#0e1310]"
                : "text-[#7b8780] group-hover:text-[#0e1310]"
              : isActive
                ? "text-brand"
                : "text-muted-foreground group-hover:text-foreground"
          )}
        />
      )}
      {!sidebarCollapsed && (
        <>
          <span className="flex-1">{item.title}</span>
          {item.badge !== undefined && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-semibold text-white">
              {item.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export function Sidebar({ items, footer, premium = false }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const allHrefs = items.map((item) => item.href);

  return (
    <aside
      className={cn(
        "fixed z-40 flex flex-col transition-all duration-300",
        premium
          ? "bottom-3 left-3 top-[calc(var(--demo-banner-height,0px)+12px)] rounded-3xl border border-[#e4ebe6] bg-white text-[#0e1310] shadow-[0_10px_30px_rgba(15,50,30,0.06)]"
          : "inset-y-0 left-0 border-r border-border bg-card",
        sidebarCollapsed ? (premium ? "w-[80px]" : "w-[72px]") : (premium ? "w-[264px]" : "w-64"),
        "hidden lg:flex"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center justify-between px-4",
          premium ? "border-b border-[#eef2ef]" : "border-b border-border"
        )}
      >
        {premium ? (
          !sidebarCollapsed && (
            <Link
              href="/"
              className="flex min-h-11 min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Image
                src="/brand/logo-horizontal-fond-clair.png"
                alt={APP_NAME}
                width={118}
                height={35}
                priority
              />
            </Link>
          )
        ) : (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <Package2 className="h-4 w-4" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
            )}
          </Link>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? "Déplier le menu" : "Replier le menu"}
          className={cn(
            premium
              ? "flex h-11 w-11 items-center justify-center rounded-full transition-colors"
              : "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            premium
              ? "text-[#7b8780] hover:bg-[#f1f5f2] hover:text-[#0e1310]"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            sidebarCollapsed && "mx-auto"
          )}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")}
          />
        </button>
      </div>

      <ScrollArea className={cn("flex-1 px-3", premium ? "py-3" : "py-4")}>
        <nav aria-label="Navigation principale" className={cn("space-y-1", premium && "space-y-0.5")}>
          {items.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, allHrefs);
            const Icon = item.icon;
            const className = cn(
              "group flex items-center gap-3 px-3 text-sm font-medium transition-all duration-200",
              premium ? "min-h-11 rounded-xl py-2" : "rounded-lg py-2.5",
              premium
                ? isActive
                  ? "bg-[#00d46a] text-[#0e1310] shadow-[0_6px_18px_rgba(0,212,106,0.22)]"
                  : "text-[#5f6a63] hover:bg-[#f1f5f2] hover:text-[#0e1310]"
                : isActive
                  ? "bg-brand-subtle text-brand"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              item.disabled && "cursor-not-allowed opacity-50"
            );

            if (item.disabled) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.disabledReason}
                  aria-disabled="true"
                  className={className}
                >
                  {Icon && (
                    <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                  )}
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {item.badge !== undefined && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            }

            return (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive}
                sidebarCollapsed={sidebarCollapsed}
                className={className}
                premium={premium}
              />
            );
          })}
        </nav>
      </ScrollArea>

      {footer && !sidebarCollapsed && (
        <div className={cn("p-4", premium ? "border-t border-[#eef2ef]" : "border-t border-border")}>{footer}</div>
      )}
    </aside>
  );
}
