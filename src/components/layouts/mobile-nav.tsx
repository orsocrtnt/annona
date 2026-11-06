"use client";

import { Fragment, useId } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/navigation/is-nav-item-active";
import { groupNavItems } from "@/lib/navigation/group-nav-items";
import { useNavQueryPrefetch } from "@/hooks/use-nav-query-prefetch";
import { useUIStore } from "@/stores/ui.store";
import type { NavItem } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { NavBadge } from "./nav-badge";
import { NavSectionTitle } from "./nav-section-title";

interface MobileNavProps {
  items: NavItem[];
  premium?: boolean;
}

function MobileNavLink({
  item,
  isActive,
  className,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  className: string;
  onNavigate: () => void;
}) {
  const prefetchHandlers = useNavQueryPrefetch(item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={isActive ? "page" : undefined}
      {...prefetchHandlers}
      onClick={onNavigate}
      className={className}
    >
      {Icon && <Icon className={cn("h-[18px] w-[18px]", isActive && "text-brand")} />}
      {item.badge !== undefined ? <span className="flex-1">{item.title}</span> : item.title}
      {item.badge !== undefined && <NavBadge value={item.badge} label={item.badgeLabel} />}
    </Link>
  );
}

export function MobileNav({ items, premium = false }: MobileNavProps) {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useUIStore();
  const allHrefs = items.map((item) => item.href);
  const sectionIdPrefix = useId();

  const renderItem = (item: NavItem) => {
    const isActive = isNavItemActive(pathname, item.href, allHrefs);
    const Icon = item.icon;
    const className = cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      premium && "min-h-11",
      premium
        ? isActive
          ? "bg-[#f1f5f2] text-[#0e1310] ring-1 ring-inset ring-[#e4ebe6] dark:bg-muted dark:text-foreground dark:ring-border"
          : "text-[#5f6a63] hover:bg-[#f1f5f2] hover:text-[#0e1310] dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-foreground"
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
          onClick={() => setMobileNavOpen(false)}
          className={className}
        >
          {Icon && <Icon className="h-[18px] w-[18px]" />}
          {item.title}
        </Link>
      );
    }

    return (
      <MobileNavLink
        key={item.href}
        item={item}
        isActive={isActive}
        className={className}
        onNavigate={() => setMobileNavOpen(false)}
      />
    );
  };

  return (
    <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <DialogContent
        className={cn(
          "left-0 top-0 h-dvh w-72 max-w-[85vw] max-md:max-h-none max-md:w-72 max-md:p-4 translate-x-0 translate-y-0 content-start gap-0 overflow-y-auto border-y-0 border-l-0 p-4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden",
          premium ? "rounded-r-[28px] border-[#e4ebe6] bg-white text-[#0e1310] dark:border-border dark:bg-card dark:text-foreground" : "rounded-none bg-card"
        )}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>('[aria-label="Ouvrir le menu"]')?.focus();
        }}
      >
        <DialogTitle className="mb-6 pr-10 text-lg">Navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Accédez aux rubriques de votre espace entreprise.
        </DialogDescription>
        <nav aria-label="Navigation mobile" className="space-y-1">
          {groupNavItems(items).map((section, sectionIndex) => {
            const links = section.items.map(renderItem);
            if (!section.title) return <Fragment key={`section-${sectionIndex}`}>{links}</Fragment>;
            const titleId = `${sectionIdPrefix}-section-${sectionIndex}`;
            return (
              <div key={section.title} role="group" aria-labelledby={titleId} className="space-y-1">
                <NavSectionTitle id={titleId} title={section.title} premium={premium} />
                {links}
              </div>
            );
          })}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
