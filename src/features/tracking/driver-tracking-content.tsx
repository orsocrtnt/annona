"use client";

import { useRef, useState } from "react";
import { CheckCircle2, MapPin, ShieldCheck, TriangleAlert, Truck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { TrackedDriver } from "@/domains/round/driver-tracking.service";
import { DeliveryMap } from "@/features/delivery-map/delivery-map";
import { useDeliveryMapData, type DeliveryMapRoundDetails } from "@/features/delivery-map/use-delivery-map-data";
import { isRoundVisible, normalizeVisible, soloRoundId, type VisibleRounds } from "@/features/delivery-map/visible-rounds";
import { timeLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.tracking;
const m = fr.deliveryMap;
/** Prochains arrêts listés avant « + n autres ». */
const LISTED_NEXT = 5;

/**
 * Lot 1, demande 5, puis CARTE-1 : page « Carte » du gérant. Une seule carte pour les tournées du jour et le suivi
 * des livreurs (position, trajet vers les prochains arrêts). On affiche toutes les tournées ou une seule : toucher
 * un livreur sur la carte, ou une tournée dans la liste, n'affiche plus qu'elle et ouvre sa fiche.
 */
export function DriverTrackingContent() {
  const { rounds, depot, live, tracking, generatedAt, loading, loaded } = useDeliveryMapData();
  const [visible, setVisible] = useState<VisibleRounds>("all");
  const cards = useRef(new Map<string, HTMLElement>());
  const ids = rounds.map((round) => round.id);
  const solo = soloRoundId(normalizeVisible(visible, ids), ids);
  const listed = rounds.filter((round) => isRoundVisible(normalizeVisible(visible, ids), round.id));

  if (loading) return <PageSkeleton />;

  const showOnly = (roundId: string) => {
    setVisible([roundId]);
    requestAnimationFrame(() => cards.current.get(roundId)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const error = live.error ?? tracking.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground">{t.subtitle}</p>
        </div>
        {generatedAt ? (
          <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="tracking-refreshed">
            {t.refreshed(timeLabel(generatedAt))}
          </p>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof Error ? error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden /> {t.privacy}
      </p>

      {loaded && rounds.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center" data-testid="tracking-empty">
          <Truck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
          <p className="mt-2 font-medium">{m.noRounds}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t.emptyHint}</p>
        </div>
      ) : null}

      {rounds.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <div className="min-w-0 xl:sticky xl:top-20 xl:self-start" data-testid="tracking-map">
            <DeliveryMap depot={depot} rounds={rounds} height={600} visible={visible} onVisibleChange={setVisible} onDriverClick={showOnly} />
          </div>

          <section className="min-w-0 space-y-3" aria-labelledby="tracking-list-title">
            <h2 id="tracking-list-title" className="text-base font-semibold">
              {m.roundsTitle} <span className="text-sm font-normal text-muted-foreground">({listed.length}/{rounds.length})</span>
            </h2>
            {listed.map((round) => (
              <RoundCard
                key={round.id}
                round={round}
                open={solo === round.id}
                onSelect={() => (solo === round.id ? setVisible("all") : showOnly(round.id))}
                cardRef={(element) => {
                  if (element) cards.current.set(round.id, element);
                  else cards.current.delete(round.id);
                }}
              />
            ))}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function RoundCard({
  round,
  open,
  onSelect,
  cardRef,
}: {
  round: DeliveryMapRoundDetails;
  open: boolean;
  onSelect: () => void;
  cardRef: (element: HTMLElement | null) => void;
}) {
  const { live: summary, tracked } = round;
  const done = summary.progress.delivered + summary.progress.incidents;
  const position = tracked?.position ?? null;
  const state =
    summary.status === "COMPLETED" ? m.finished : summary.status === "IN_PROGRESS" ? null : m.notStarted;
  return (
    <article
      ref={cardRef}
      className={cn("rounded-xl border bg-card shadow-sm transition-shadow", open && "ring-2 ring-ring")}
      data-testid={summary.driverName ? `tracking-driver-${summary.driverName}` : `tracking-round-${summary.name}`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-3 rounded-xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onSelect}
        aria-expanded={open}
        aria-label={t.show(summary.driverName ?? summary.name)}
      >
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: round.color }} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{summary.name}</span>
            <span className="text-sm text-muted-foreground">{summary.slotLabel}</span>
          </span>
          <span className="mt-0.5 block text-sm">{summary.driverName ?? <span className="text-muted-foreground">{m.noDriver}</span>}</span>
          <span
            className={cn("mt-0.5 block text-xs", position?.stale ? "text-warning" : "text-muted-foreground")}
            data-testid="tracking-position"
          >
            {state ?? (position ? (position.stale ? t.lastKnown(timeLabel(position.updatedAt)) : t.positionAt(timeLabel(position.updatedAt))) : t.noPosition)}
          </span>
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-success" style={{ width: `${summary.progress.total ? (done / summary.progress.total) * 100 : 0}%` }} />
          </span>
          <span className="mt-1 block text-xs tabular-nums text-muted-foreground" data-testid="tracking-remaining">
            {fr.live.progressLabel(summary.progress.delivered, summary.progress.total)} · {t.remaining(summary.progress.remaining)}
          </span>
        </span>
      </button>

      {open ? (
        <div className="space-y-4 border-t px-4 pb-4 pt-3 text-sm" data-testid="tracking-details">
          {tracked ? <TrackedDetails driver={tracked} /> : (
            <p className="text-muted-foreground">
              {summary.nextStopName ? `${t.nextStops} : ${summary.nextStopName}` : t.remaining(summary.progress.remaining)}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function TrackedDetails({ driver }: { driver: TrackedDriver }) {
  return (
    <>
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
    </>
  );
}
