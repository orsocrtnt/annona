"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MapPin, ShieldCheck, TriangleAlert, Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { TrackedDriver } from "@/domains/round/driver-tracking.service";
import { ROUND_COLORS } from "@/features/rounds/rounds-map";
import { useDriverTracking } from "@/features/tracking/hooks";
import { TrackingMap } from "@/features/tracking/tracking-map";
import { timeLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.tracking;
/** Prochains arrêts listés avant « + n autres ». */
const LISTED_NEXT = 5;

/**
 * Lot 1, demande 5 : onglet « Suivi livreurs ». Carte (position, trajet vers les 2 ou 3 prochains arrêts)
 * et liste par livreur (prochains arrêts, clients restants, livrés avec l'heure). Toucher un livreur sur
 * la carte ouvre sa liste ; toucher un livreur dans la liste le montre sur la carte.
 */
export function DriverTrackingContent() {
  const tracking = useDriverTracking();
  const [selected, setSelected] = useState<string | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());
  const data = tracking.data;

  // Une tournée terminée disparaît : la sélection suit.
  useEffect(() => {
    if (selected && data && !data.drivers.some((driver) => driver.roundId === selected)) setSelected(null);
  }, [data, selected]);

  if (tracking.isLoading && !data) return <PageSkeleton />;

  const colorOf = (roundId: string) => {
    const index = data?.drivers.findIndex((driver) => driver.roundId === roundId) ?? 0;
    return ROUND_COLORS[Math.max(0, index) % ROUND_COLORS.length]!;
  };
  const selectFromMap = (roundId: string) => {
    setSelected(roundId);
    cards.current.get(roundId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
        </div>
        {data ? (
          <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="tracking-refreshed">
            {t.refreshed(timeLabel(data.generatedAt))}
          </p>
        ) : null}
      </div>

      {tracking.error ? (
        <Alert variant="destructive">
          <AlertDescription>{tracking.error instanceof Error ? tracking.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden /> {t.privacy}
      </p>

      {data && data.drivers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center" data-testid="tracking-empty">
          <Truck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-medium">{t.empty}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.emptyHint}</p>
        </div>
      ) : null}

      {data && data.drivers.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t.map}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 sm:px-6 sm:pb-6">
              <div className="overflow-hidden sm:rounded-xl" data-testid="tracking-map">
                <TrackingMap tracking={data} selectedRoundId={selected} onSelect={selectFromMap} colorOf={colorOf} />
              </div>
            </CardContent>
          </Card>

          <section className="min-w-0 space-y-3" aria-labelledby="tracking-list-title">
            <h2 id="tracking-list-title" className="text-base font-semibold">
              {t.list} <span className="text-sm font-normal text-muted-foreground">({data.drivers.length})</span>
            </h2>
            {data.drivers.map((driver) => (
              <DriverCard
                key={driver.roundId}
                driver={driver}
                color={colorOf(driver.roundId)}
                selected={selected === driver.roundId}
                onSelect={() => setSelected(selected === driver.roundId ? null : driver.roundId)}
                cardRef={(element) => {
                  if (element) cards.current.set(driver.roundId, element);
                  else cards.current.delete(driver.roundId);
                }}
              />
            ))}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function DriverCard({
  driver,
  color,
  selected,
  onSelect,
  cardRef,
}: {
  driver: TrackedDriver;
  color: string;
  selected: boolean;
  onSelect: () => void;
  cardRef: (element: HTMLElement | null) => void;
}) {
  const position = driver.position;
  return (
    <article
      ref={cardRef}
      className={cn("rounded-xl border bg-card shadow-sm transition-shadow", selected && "ring-2 ring-ring")}
      data-testid={`tracking-driver-${driver.driverName}`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelect}
        aria-expanded={selected}
        aria-label={t.show(driver.driverName)}
      >
        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{driver.driverName}</span>
            <span className="text-sm text-muted-foreground">{driver.roundName}</span>
          </span>
          <span
            className={cn("mt-1 block text-xs", position?.stale ? "text-warning" : "text-muted-foreground")}
            data-testid="tracking-position"
          >
            {position ? (position.stale ? t.lastKnown(timeLabel(position.updatedAt)) : t.positionAt(timeLabel(position.updatedAt))) : t.noPosition}
          </span>
          <span className="mt-1 block text-sm font-medium" data-testid="tracking-remaining">{t.remaining(driver.remainingCount)}</span>
        </span>
        <Badge variant="secondary" className="shrink-0 tabular-nums">{t.deliveredCount(driver.delivered.length)}</Badge>
      </button>

      {selected ? (
        <div className="space-y-4 border-t px-4 pb-4 pt-3 text-sm" data-testid="tracking-details">
          {driver.route.approximate ? <p className="text-xs text-muted-foreground">{t.routeApproximate}</p> : null}
          {driver.route.from === "depot" ? <p className="text-xs text-muted-foreground">{t.routeFromDepot}</p> : null}

          <div>
            <h3 className="mb-1 flex items-center gap-1.5 font-medium"><MapPin className="h-4 w-4" aria-hidden /> {t.nextStops}</h3>
            {driver.nextStops.length === 0 ? (
              <p className="text-muted-foreground">{t.remaining(0)}</p>
            ) : (
              <ol className="space-y-1" data-testid="tracking-next-stops">
                {driver.nextStops.slice(0, LISTED_NEXT).map((stop, index) => (
                  <li key={stop.id} className="flex items-baseline gap-2">
                    <span className={cn("w-5 shrink-0 text-right tabular-nums", index < 3 ? "font-semibold" : "text-muted-foreground")}>{index + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{stop.merchantName}</span>
                    {stop.estimatedArrivalAt ? <span className="shrink-0 text-xs text-muted-foreground">{t.eta(timeLabel(stop.estimatedArrivalAt))}</span> : null}
                  </li>
                ))}
                {driver.nextStops.length > LISTED_NEXT ? (
                  <li className="pl-7 text-xs text-muted-foreground">{t.more(driver.nextStops.length - LISTED_NEXT)}</li>
                ) : null}
              </ol>
            )}
          </div>

          <div>
            <h3 className="mb-1 flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {t.delivered}</h3>
            {driver.delivered.length === 0 ? (
              <p className="text-muted-foreground">{t.noDelivered}</p>
            ) : (
              <ul className="space-y-1" data-testid="tracking-delivered">
                {driver.delivered.map((stop) => (
                  <li key={stop.id} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">{stop.merchantName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{stop.deliveredAt ? t.deliveredAt(timeLabel(stop.deliveredAt)) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {driver.incidents.length > 0 ? (
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 font-medium"><TriangleAlert className="h-4 w-4 text-error" aria-hidden /> {t.incidents}</h3>
              <ul className="space-y-1">
                {driver.incidents.map((stop) => (
                  <li key={stop.id} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">{stop.merchantName}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{stop.incidentAt ? timeLabel(stop.incidentAt) : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
