"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Play, Route } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { nextPendingStop, type StopIncidentCode } from "@/domains/round/round-rules";
import { DriverLocationStatus } from "@/features/driver/driver-location-status";
import { driverRoundApi } from "@/features/driver/round/driver-round-api";
import { DriverStopCard } from "@/features/driver/round/driver-stop-card";
import { applyPendingActions, type EffectiveStop } from "@/features/driver/round/effective-rounds";
import { actionNeedsAttention } from "@/features/driver/offline-action-queue";
import { IncidentDialog } from "@/features/driver/round/incident-dialog";
import { LoadingList } from "@/features/driver/round/loading-list";
import { NextStopDialog, type NextStopStep } from "@/features/driver/round/next-stop-dialog";
import { SyncBanner } from "@/features/driver/round/sync-banner";
import { useDriverActionQueue } from "@/features/driver/round/use-driver-action-queue";
import { useDriverLivePosition } from "@/features/driver/use-driver-live-position";
import { useAuth } from "@/hooks/use-auth";
import { longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { driverLocationAllowed } from "@/lib/native/location-policy";
import { cn } from "@/lib/utils";

const t = fr.driverRound;
export const DRIVER_ROUNDS_KEY = ["driver-rounds"] as const;

/**
 * TOUR-1 — « Ma tournée » (LIV-01 à LIV-06). Rafraîchie toutes les 30 s et au retour sur l'écran
 * (critère 6 : un arrêt déplacé par l'administrateur apparaît au prochain rafraîchissement). Les gestes
 * passent par la file hors réseau et s'affichent tout de suite (critère 8).
 */
export function DriverRoundContent() {
  const { user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: DRIVER_ROUNDS_KEY,
    queryFn: driverRoundApi.rounds,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const onSynced = useCallback(() => client.invalidateQueries({ queryKey: DRIVER_ROUNDS_KEY }), [client]);
  const queue = useDriverActionQueue(user?.id ?? null, onSynced);

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const [next, setNext] = useState<{ stopId: string | null; step: NextStopStep } | null>(null);
  const [incidentStopId, setIncidentStopId] = useState<string | null>(null);

  const rounds = useMemo(
    () => applyPendingActions(query.data?.rounds ?? [], queue.actions, (action) => actionNeedsAttention(action, queue.online)),
    [query.data, queue.actions, queue.online]
  );
  const round =
    rounds.find((candidate) => candidate.id === selectedRoundId) ??
    rounds.find((candidate) => candidate.status === "IN_PROGRESS") ??
    rounds.find((candidate) => candidate.status === "ASSIGNED") ??
    rounds[0] ??
    null;

  // ENF-04 : position partagée seulement pendant une tournée démarrée (le serveur le vérifie aussi).
  // Statut confirmé par le serveur (pas l'affichage anticipé) : sinon la position partirait avant le démarrage.
  const tracking = driverLocationAllowed(query.data?.rounds ?? []);
  const live = useDriverLivePosition(tracking);

  if (query.isLoading && !query.data) return <PageSkeleton />;

  const stops = round?.stops ?? [];
  const current = nextPendingStop(stops);
  const started = round?.status === "IN_PROGRESS" || round?.status === "COMPLETED";
  const findStop = (id: string | null) => (id ? stops.find((stop) => stop.id === id) ?? null : null);

  /** Écrit le geste dans la file ; seule une panne du stockage du téléphone peut échouer ici. */
  async function act(run: () => Promise<void>) {
    try {
      await run();
    } catch {
      toast.error(fr.common.genericError);
    }
  }

  const start = () =>
    act(() =>
      queue.enqueue(`round:${round!.id}:start`, { kind: "START", roundId: round!.id, at: new Date().toISOString() }).then(() => {
        toast.success(t.started);
      })
    );

  const delivered = (stop: EffectiveStop) =>
    act(async () => {
      await queue.enqueue(`stop:${stop.id}:delivered`, { kind: "DELIVERED", stopId: stop.id, at: new Date().toISOString() });
      // LIV-04 : l'arrêt suivant est proposé tout de suite (même hors réseau).
      const following = nextPendingStop(stops.map((row) => (row.id === stop.id ? { ...row, status: "DELIVERED" as const } : row)), stop.id);
      setExpanded(null);
      setNext({ stopId: following?.id ?? null, step: "next" });
    });

  const reportProblem = async (input: { code: StopIncidentCode; comment: string; photo: Blob | null }) => {
    const stop = findStop(incidentStopId);
    if (!stop) return;
    await act(async () => {
      await queue.enqueue(`stop:${stop.id}:incident:${Date.now()}`, {
        kind: "INCIDENT",
        stopId: stop.id,
        at: new Date().toISOString(),
        code: input.code,
        comment: input.comment,
        photo: input.photo,
      });
      setIncidentStopId(null);
      toast.success(t.problemSent);
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-6 pt-4" data-testid="driver-round">
      <SyncBanner actions={queue.actions} online={queue.online} onRetry={() => void queue.retry()} onDiscard={(id) => void queue.discard(id)} />

      {query.error && !query.data ? (
        <Alert variant="destructive">
          <AlertDescription>{query.error instanceof Error ? query.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        {query.data?.date ? (
          <p className="text-sm text-muted-foreground">
            {query.data.date === query.data.today ? `${t.today} · ` : ""}
            {query.data.date === query.data.today ? longDeliveryDateLabel(query.data.date) : t.nextRound(longDeliveryDateLabel(query.data.date))}
          </p>
        ) : null}
      </header>

      {!round ? (
        query.data ? (
          <div className="rounded-2xl border border-dashed p-8 text-center">
            <Route className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">{t.none}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.noneHint}</p>
          </div>
        ) : null
      ) : (
        <>
          {rounds.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t.title}>
              {rounds.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  aria-pressed={candidate.id === round.id}
                  onClick={() => setSelectedRoundId(candidate.id)}
                  className={cn(
                    "min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
                    candidate.id === round.id ? "border-primary bg-primary text-primary-foreground" : "bg-card"
                  )}
                >
                  {candidate.name}
                </button>
              ))}
            </div>
          ) : null}

          <section className="rounded-2xl border bg-card p-4" aria-labelledby="round-title" data-testid="driver-round-summary" data-round-id={round.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="round-title" className="text-lg font-semibold">{round.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {t.slot(round.slotLabel)} · {t.stops(round.progress.total)}
                </p>
              </div>
              <Badge variant={round.status === "COMPLETED" ? "success" : round.status === "IN_PROGRESS" ? "brand" : "outline"}>
                {fr.roundStatus[round.status]}
              </Badge>
            </div>
            <div className="mt-3">
              <div className="flex justify-between text-sm">
                <span>{t.progress(round.progress.delivered, round.progress.total)}</span>
                {round.progress.incidents > 0 ? <span className="text-error">{fr.live.incidents} : {round.progress.incidents}</span> : null}
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${round.progress.total ? ((round.progress.delivered + round.progress.incidents) / round.progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            {round.status === "ASSIGNED" ? (
              round.canStart ? (
                <Button size="xl" className="mt-4 w-full" onClick={() => void start()} data-testid="driver-start">
                  <Play className="!size-5" aria-hidden />
                  {t.start}
                </Button>
              ) : (
                <p className="mt-4 rounded-xl bg-muted px-3 py-2 text-sm">{t.startNotToday(longDeliveryDateLabel(round.date))}</p>
              )
            ) : null}
            {round.status === "COMPLETED" ? (
              <p className="mt-4 flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                {t.completed}
              </p>
            ) : null}
            {tracking ? (
              <div className="mt-3">
                <DriverLocationStatus status={live.status} lastPositionAt={live.lastPositionAt} lastSyncedAt={live.lastSyncedAt} error={live.syncError} onRetry={live.retry} compact />
              </div>
            ) : null}
          </section>

          {!started ? (
            <LoadingList stops={stops} />
          ) : (
            <div>
              <Button variant="ghost" size="touch" className="w-full justify-between" aria-expanded={showLoading} onClick={() => setShowLoading((value) => !value)}>
                {showLoading ? t.hideLoading : t.showLoading}
                <ChevronDown className={cn("transition-transform", showLoading && "rotate-180")} aria-hidden />
              </Button>
              {showLoading ? <LoadingList stops={stops} /> : null}
            </div>
          )}

          <section aria-label={t.title}>
            <ol className="space-y-3" data-testid="driver-stops">
              {stops.map((stop) => (
                <DriverStopCard
                  key={stop.id}
                  stop={stop}
                  slotLabel={round.slotLabel}
                  current={started && current?.id === stop.id}
                  expanded={expanded === stop.id}
                  actionable={started}
                  onToggle={() => setExpanded((value) => (value === stop.id ? null : stop.id))}
                  onDelivered={() => void delivered(stop)}
                  onProblem={() => setIncidentStopId(stop.id)}
                  onRoute={() => setNext({ stopId: stop.id, step: "navigate" })}
                />
              ))}
            </ol>
          </section>
        </>
      )}

      <NextStopDialog
        open={next !== null}
        step={next?.step ?? "next"}
        stop={findStop(next?.stopId ?? null)}
        onStep={(step) => setNext((value) => (value ? { ...value, step } : value))}
        onClose={() => setNext(null)}
      />
      <IncidentDialog stop={findStop(incidentStopId)} onClose={() => setIncidentStopId(null)} onSubmit={reportProblem} />
    </div>
  );
}
