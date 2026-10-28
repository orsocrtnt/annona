import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

export type SpaceNavItem = { icon: LucideIcon; label: string; active?: boolean };

/** Menu latéral d'un espace : libellés sur grand écran, icônes seules en mobile. */
export function SpaceSidebar({ items }: { items: readonly SpaceNavItem[] }) {
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-black/[0.06] bg-white py-3 sm:w-[148px] sm:items-stretch sm:px-2.5">
      <div className="mb-3 flex h-8 items-center sm:px-1">
        <Image src="/brand/monogramme-fond-clair.png" alt="" aria-hidden width={28} height={24} className="sm:hidden" />
        <BrandLogo className="hidden sm:inline-flex" />
      </div>
      {items.map(({ icon: Icon, label, active }) => (
        <span
          key={label}
          className={cn(
            "flex h-8 w-8 items-center justify-center gap-2 rounded-lg text-xs font-medium sm:h-auto sm:w-auto sm:justify-start sm:px-2 sm:py-1.5",
            active ? "bg-[#e6f8ee] text-[#0e1310]" : "text-muted-foreground"
          )}
          aria-current={active ? "page" : undefined}
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          <span className="hidden whitespace-nowrap sm:inline">{label}</span>
        </span>
      ))}
    </aside>
  );
}
