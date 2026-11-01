"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { MOBILE_CARDS_QUERY } from "@/lib/table/mobile-cards";
import { cn } from "@/lib/utils";

/**
 * Téléphone : bloc secondaire replié derrière son titre, monté seulement à l'ouverture.
 * Ordinateur : le contenu est rendu tel quel, sans aucun élément autour.
 */
export function MobileFold({ title, children }: { title: string; children: ReactNode }) {
  const isMobile = useMediaQuery(MOBILE_CARDS_QUERY);
  const [open, setOpen] = useState(false);

  if (!isMobile) return <>{children}</>;

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
      >
        {title}
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
