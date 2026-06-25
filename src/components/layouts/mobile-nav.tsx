"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/navigation/is-nav-item-active";
import { useNavQueryPrefetch } from "@/hooks/use-nav-query-prefetch";
import { useUIStore } from "@/stores/ui.store";
import { X } from "lucide-react";
import type { NavItem } from "@/types";

interface MobileNavProps {
  items: NavItem[];
}

function MobileNavLink({
  item,
  className,
  onNavigate,
}: {
  item: NavItem;
  className: string;
  onNavigate: () => void;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      {...prefetchHandlers}
      onClick={onNavigate}
      className={className}
    >
      {Icon && <Icon className="h-[18px] w-[18px]" />}
      {item.title}
    </Link>
  );
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useUIStore();
  const allHrefs = items.map((item) => item.href);

  if (!mobileNavOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        onClick={() => setMobileNavOpen(false)}
      />
      <div className="fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card p-4 lg:hidden animate-slide-down">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold">Navigation</span>
          <button
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fermer le menu"
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, allHrefs);
            const Icon = item.icon;
            const className = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-subtle text-brand"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              item.disabled && "cursor-not-allowed opacity-50"
            );

            if (item.disabled) {
              return (
                <span key={item.href} aria-disabled="true" className={className}>
                  {Icon && <Icon className="h-[18px] w-[18px]" />}
                  {item.title}
                </span>
              );
            }

            return (
              <MobileNavLink
                key={item.href}
                item={item}
                className={className}
                onNavigate={() => setMobileNavOpen(false)}
              />
            );
          })}
        </nav>
      </div>
    </>
  );
}
