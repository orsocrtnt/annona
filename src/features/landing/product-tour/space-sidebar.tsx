import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

export type SpaceNavItem = { icon: LucideIcon; label: string; active?: boolean };

/** Menu latéral d'un espace : libellés sur grand écran, icônes seules en mobile. `dense` pour un menu complet. */
export function SpaceSidebar({ items, dense = false }: { items: readonly SpaceNavItem[]; dense?: boolean }) {
  return (
    <aside
      className={cn(
        // La barre prend la largeur de son plus long libellé, jamais moins de 148 px.
        "flex w-12 shrink-0 flex-col items-center border-r border-black/[0.06] bg-white py-3 sm:w-auto sm:min-w-[148px] sm:items-stretch sm:pl-2.5 sm:pr-3",
        dense ? "gap-0" : "gap-1"
      )}
    >
      <div className="mb-3 flex h-8 items-center sm:px-1">
        <Image src="/brand/monogramme-fond-clair.png" alt="" aria-hidden width={28} height={24} className="sm:hidden" />
        <BrandLogo className="hidden sm:inline-flex" />
      </div>
      {items.map(({ icon: Icon, label, active }) => (
        <span
          key={label}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg font-medium sm:h-auto sm:w-auto sm:justify-start sm:px-2",
            dense ? "h-6 w-6 text-[11px] sm:py-1" : "h-8 w-8 text-xs sm:py-1.5",
            active ? "bg-[#e6f8ee] text-[#0e1310]" : "text-muted-foreground"
          )}
          aria-current={active ? "page" : undefined}
        >
          <Icon className={cn("shrink-0", dense ? "h-3.5 w-3.5" : "h-4 w-4")} strokeWidth={1.75} aria-hidden />
          <span className="hidden whitespace-nowrap sm:inline">{label}</span>
        </span>
      ))}
    </aside>
  );
}
