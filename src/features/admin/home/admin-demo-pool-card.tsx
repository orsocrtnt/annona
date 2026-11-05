"use client";

import Link from "next/link";
import { ArrowRight, FlaskConical, Radio } from "lucide-react";
import { HomeCard } from "@/features/admin/home/home-card";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import { useDemoPool } from "@/features/admin/demos/demo-pool-query";

/** Démos disponibles sur le total et visiteurs en direct (signe de vie de moins de 2 min, onglet visible). */
export function AdminDemoPoolCard() {
  const { data, isLoading, error } = useDemoPool();

  return (
    <HomeCard aria-labelledby="demo-pool-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="demo-pool-title" className="text-lg font-bold tracking-tight text-foreground">Démos</h2>
          <p className="text-sm text-muted-foreground">Espaces de démonstration ouverts depuis « Voir la démo ».</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
          <FlaskConical className="h-[18px] w-[18px]" />
        </span>
      </div>

      {isInitialQueryLoading(isLoading, data) ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement des démos.</p>
      ) : error || !data ? (
        <p className="mt-4 text-sm text-muted-foreground">Compteur des démos indisponible pour le moment.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold text-muted-foreground">Disponibles</p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">
              {data.available}
              <span className="text-lg font-semibold text-muted-foreground"> / {data.total}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.reserved} réservée{data.reserved > 1 ? "s" : ""}
              {data.preparing > 0 ? ` · ${data.preparing} en préparation` : ""}
              {data.quarantined > 0 ? ` · ${data.quarantined} en erreur` : ""}
            </p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Radio className={cn("h-4 w-4", data.live > 0 ? "text-brand" : "text-muted-foreground")} aria-hidden />
              En direct
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-foreground">{data.live}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.live > 1 ? "démos avec quelqu’un dessus" : "démo avec quelqu’un dessus"} (actif il y a moins de 2 min)
            </p>
          </div>
        </div>
      )}
      <Link
        href="/admin/demos"
        className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Voir chaque démo et les remettre à neuf
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </HomeCard>
  );
}
