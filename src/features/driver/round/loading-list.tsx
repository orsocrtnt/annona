"use client";

import { Package } from "lucide-react";
import { loadingOrder } from "@/domains/round/round-rules";
import type { EffectiveStop } from "@/features/driver/round/effective-rounds";
import { fr } from "@/lib/i18n/fr";

const t = fr.driverRound;

/**
 * LIV-02 : liste de chargement, dans l'ordre inverse de la livraison (comme la vue « par tournée » du
 * boulanger, BOU-03) : on charge d'abord le dernier arrêt, au fond du véhicule.
 */
export function LoadingList({ stops }: { stops: EffectiveStop[] }) {
  const ordered = loadingOrder(stops);
  return (
    <section aria-labelledby="loading-title" className="rounded-2xl border bg-card p-4" data-testid="driver-loading-list">
      <h2 id="loading-title" className="flex items-center gap-2 text-base font-semibold">
        <Package className="h-5 w-5 text-brand" aria-hidden />
        {t.loadingList}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.loadingHint}</p>
      <ol className="mt-3 divide-y">
        {ordered.map((stop, index) => (
          <li key={stop.id} className="flex gap-3 py-3" data-testid="driver-loading-item">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums" aria-hidden>
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="sr-only">{index + 1}. </span>
                {stop.merchantName}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{t.stopNumber(stop.sequence)}</span>
              </p>
              <p className="text-sm text-muted-foreground">{fr.packages(stop.packages, stop.items)}</p>
              {stop.lines.length > 0 ? (
                <p className="mt-1 text-sm">
                  {stop.lines.map((line) => `${line.quantity} × ${line.name}`).join(" · ")}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
