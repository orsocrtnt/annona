"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { StopStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { fr } from "@/lib/i18n/fr";
import { isRoundVisible, normalizeVisible, toggleRound, type VisibleRounds } from "@/features/delivery-map/visible-rounds";

const t = fr.deliveryMap;

export interface DeliveryMapStop {
  id: string;
  sequence: number;
  status: StopStatus;
  merchantName: string;
  latitude: number | null;
  longitude: number | null;
}

export interface DeliveryMapRound {
  id: string;
  name: string;
  color: string;
  driverName?: string | null;
  progress?: { delivered: number; total: number } | null;
  driverPosition?: { latitude: number; longitude: number; stale?: boolean } | null;
  /** Trajet calculé du livreur vers ses prochains arrêts (suivi en direct). */
  route?: { polyline: [number, number][] | null; approximate: boolean } | null;
  stops: DeliveryMapStop[];
}

export interface DeliveryMapInnerProps {
  depot: { latitude: number; longitude: number } | null;
  rounds: DeliveryMapRound[];
  height: number;
  onDriverClick?: (roundId: string) => void;
}

/** Couleurs des tournées : contraste suffisant sur le plan clair et le liseré blanc, sans vert (DA-1) ni jaune (réservé au livreur). */
export const ROUND_COLORS = ["#2563eb", "#c2410c", "#7c3aed", "#be185d", "#0369a1", "#a16207", "#4338ca", "#57534e"] as const;

export function roundColor(index: number): string {
  return ROUND_COLORS[index % ROUND_COLORS.length]!;
}

const Inner = dynamic(() => import("./delivery-map-inner").then((loaded) => loaded.DeliveryMapInner), {
  ssr: false,
  loading: () => <div className="h-full min-h-[320px] w-full animate-pulse bg-muted" />,
});

/**
 * CARTE-1 — la carte des tournées du gérant, la même partout (page « Carte », tableau de bord, planification) :
 * arrêts de chaque tournée, position des livreurs et trajet vers leurs prochains arrêts. Un bouton par tournée :
 * on les voit toutes, ou une seule, ou celles qu'on choisit. Les tournées masquées ne sont pas dessinées.
 */
export function DeliveryMap({
  depot,
  rounds,
  height = 480,
  visible: controlled,
  onVisibleChange,
  onDriverClick,
  className,
}: {
  depot: { latitude: number; longitude: number } | null;
  rounds: DeliveryMapRound[];
  height?: number;
  visible?: VisibleRounds;
  onVisibleChange?: (visible: VisibleRounds) => void;
  onDriverClick?: (roundId: string) => void;
  className?: string;
}) {
  const [internal, setInternal] = useState<VisibleRounds>("all");
  const ids = useMemo(() => rounds.map((round) => round.id), [rounds]);
  // Une tournée qui disparaît (terminée, supprimée) sort de la sélection.
  const visible = normalizeVisible(controlled ?? internal, ids);
  const setVisible = (next: VisibleRounds) => (onVisibleChange ? onVisibleChange(next) : setInternal(next));
  const shown = rounds.filter((round) => isRoundVisible(visible, round.id));

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)} data-testid="delivery-map">
      {rounds.length > 0 ? (
        <div className="border-b p-3">
          <div role="group" aria-label={t.filterLabel} className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={visible === "all"}
              onClick={() => setVisible("all")}
              className={chipClass(visible === "all")}
              data-testid="delivery-map-all"
            >
              {t.all(rounds.length)}
            </button>
            {rounds.map((round) => {
              const on = visible !== "all" && isRoundVisible(visible, round.id);
              return (
                <button
                  key={round.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setVisible(toggleRound(visible, round.id, ids))}
                  className={chipClass(on)}
                  data-testid="delivery-map-round"
                  data-round-name={round.name}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: round.color }} aria-hidden />
                  <span>{round.name}</span>
                  {round.progress ? (
                    <span className={cn("tabular-nums", on ? "opacity-80" : "text-muted-foreground")}>
                      {t.progress(round.progress.delivered, round.progress.total)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t.hint}</p>
        </div>
      ) : null}
      <div style={{ height }} className="relative">
        <Inner depot={depot} rounds={shown} height={height} onDriverClick={onDriverClick} />
      </div>
      <Legend />
    </div>
  );
}

function chipClass(on: boolean) {
  return cn(
    "inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11",
    on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
  );
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground" aria-label="Légende de la carte">
      <li className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-foreground bg-card text-[9px] font-bold text-foreground" aria-hidden>3</span>
        {t.legendNext}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full border border-white bg-[#a1a1aa] dark:border-card" aria-hidden />
        {t.legendDelivered}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-error text-[10px] font-bold text-white dark:text-background" aria-hidden>!</span>
        {t.legendIncident}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-foreground shadow-sm dark:border-card" aria-hidden />
        {t.legendDriver}
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-foreground text-[9px] font-bold text-background" aria-hidden>L</span>
        {t.legendDepot}
      </li>
    </ul>
  );
}
