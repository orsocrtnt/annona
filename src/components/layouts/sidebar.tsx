"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/ui.store";
import { APP_NAME } from "@/lib/constants";
import { isNavItemActive } from "@/lib/navigation/is-nav-item-active";
import { useNavQueryPrefetch, usePrefetchNavHrefs } from "@/hooks/use-nav-query-prefetch";
import { ChevronLeft, Package2 } from "lucide-react";
import type { NavItem } from "@/types";

interface SidebarProps {
  items: NavItem[];
  footer?: React.ReactNode;
}

function SidebarNavLink({
  item,
  isActive,
  sidebarCollapsed,
  className,
}: {
  item: NavItem;
  isActive: boolean;
  sidebarCollapsed: boolean;
  className: string;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  return (
    <Link key={item.href} href={item.href} {...prefetchHandlers} className={className}>
      {Icon && (
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            isActive ? "text-brand" : "text-muted-foreground group-hover:text-foreground"
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

export function Sidebar({ items, footer }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarCollapsed, setSidebarCollapsed } = useUIStore();
  const allHrefs = items.map((item) => item.href);
  usePrefetchNavHrefs(items.filter((item) => !item.disabled).map((item) => item.href));

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-all duration-300",
        sidebarCollapsed ? "w-[72px]" : "w-64",
        "hidden lg:flex"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
            <Package2 className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold tracking-tight">{APP_NAME}</span>
          )}
        </Link>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          aria-label={sidebarCollapsed ? "Déplier le menu" : "Replier le menu"}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            sidebarCollapsed && "mx-auto"
          )}
        >
          <ChevronLeft
            className={cn("h-4 w-4 transition-transform", sidebarCollapsed && "rotate-180")}
          />
        </button>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, allHrefs);
            const Icon = item.icon;
            const className = cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-brand-subtle text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              item.disabled && "cursor-not-allowed opacity-50"
            );

            if (item.disabled) {
              return (
                <span
                  key={item.href}
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
                </span>
              );
            }

            return (
              <SidebarNavLink
                key={item.href}
                item={item}
                isActive={isActive}
                sidebarCollapsed={sidebarCollapsed}
                className={className}
              />
            );
          })}
        </nav>
      </ScrollArea>

      {footer && !sidebarCollapsed && (
        <div className="border-t border-border p-4">{footer}</div>
      )}
    </aside>
  );
}
