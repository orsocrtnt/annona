"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/navigation/is-nav-item-active";
import { useNavQueryPrefetch } from "@/hooks/use-nav-query-prefetch";
import { useUIStore } from "@/stores/ui.store";
import type { NavItem } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

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
      {Icon && <Icon className="h-[18px] w-[18px]" />}
      {item.title}
    </Link>
  );
}

export function MobileNav({ items, premium = false }: MobileNavProps) {
  const pathname = usePathname();
  const { mobileNavOpen, setMobileNavOpen } = useUIStore();
  const allHrefs = items.map((item) => item.href);

  return (
    <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <DialogContent
        className={cn(
          "left-0 top-0 h-[100dvh] w-72 max-w-[85vw] translate-x-0 translate-y-0 content-start gap-0 border-y-0 border-l-0 p-4 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden",
          premium ? "rounded-r-[28px] border-white/10 bg-[#0e1310] text-white" : "rounded-none bg-card"
        )}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          document.querySelector<HTMLElement>('[aria-label="Ouvrir le menu"]')?.focus();
        }}
      >
        <DialogTitle className={cn("mb-6 pr-10 text-lg", premium && "text-white")}>Navigation</DialogTitle>
        <DialogDescription className="sr-only">
          Accédez aux rubriques de votre espace entreprise.
        </DialogDescription>
        <nav aria-label="Navigation mobile" className="space-y-1">
          {items.map((item) => {
            const isActive = isNavItemActive(pathname, item.href, allHrefs);
            const Icon = item.icon;
            const className = cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              premium && "min-h-11",
              premium
                ? isActive
                  ? "bg-[#00d46a] text-[#07110b]"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
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
          })}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
