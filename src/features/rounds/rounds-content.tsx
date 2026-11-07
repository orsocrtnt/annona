"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCheck, Lock, LockOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { DeliveryDayPicker, parisDateKey } from "@/components/shared/delivery-day-picker";
import { moveWithinRound } from "@/domains/round/round-rules";
import type { AdminRoundView } from "@/domains/round/round.types";
import { roundsApi } from "@/features/rounds/api";
import { useRoundMutation, useRoundsDay } from "@/features/rounds/hooks";
import { RoundCard, type DragState } from "@/features/rounds/round-card";
import { RoundJournal } from "@/features/rounds/round-journal";
import { ROUND_COLORS, RoundsMap } from "@/features/rounds/rounds-map";
import { deadlineLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";

const t = fr.rounds;

type Action =
  | { type: "assign"; roundId: string; driverId: string | null }
  | { type: "reorder"; roundId: string; stopIds: string[] }
  | { type: "move"; stopId: string; roundId: string; position: number | null }
  | { type: "optimize"; roundId: string }
  | { type: "delete"; roundId: string }
  | { type: "create"; slotId: string }
  | { type: "validate" };

/** TOUR-1 — tournées d'un jour par créneau : carte, ordre, déplacements, livreurs, validation (ADM-06, ADM-07). */
export function RoundsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const date = params.get("date") ?? parisDateKey(1);
  const day = useRoundsDay(date);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const setDate = useCallback(
    (value: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("date", value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      setSelectedRoundId(null);
    },
    [params, pathname, router]
  );

  const data = day.data;
  const roundById = useMemo(() => new Map((data?.rounds ?? []).map((round) => [round.id, round])), [data]);
  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    (data?.rounds ?? []).forEach((round, index) => map.set(round.id, ROUND_COLORS[index % ROUND_COLORS.length]!));
    return map;
  }, [data]);

  const mutation = useRoundMutation(date, async (action: Action) => {
    switch (action.type) {
      case "assign": {
        const result = await roundsApi.assign(action.roundId, action.driverId);
        return t.assigned(result.driverName);
      }
      case "reorder":
        await roundsApi.reorder(action.roundId, action.stopIds);
        return t.reordered;
      case "move": {
        await roundsApi.move(action.stopId, action.roundId, action.position);
        const stop = data?.rounds.flatMap((round) => round.stops).find((row) => row.id === action.stopId);
        return t.moved(stop?.merchantName ?? "", roundById.get(action.roundId)?.name ?? "");
      }
      case "optimize": {
        const result = await roundsApi.optimize(action.roundId);
        return t.optimized(result.approximate);
      }
      case "delete":
        await roundsApi.remove(action.roundId);
        return t.deleted;
      case "create":
        await roundsApi.create(date, action.slotId);
        return t.created;
      case "validate": {
        const result = await roundsApi.validate(date);
        const parts = [result.validated > 0 ? t.validated(result.validated) : t.nothingToValidate];
        if (result.withoutDriver.length > 0) parts.push(t.withoutDriver(result.withoutDriver.join(", ")));
        return parts.join(" · ");
      }
    }
  });

  const run = (action: Action) =>
    mutation.mutate(action, {
      onSuccess: (message) => toast.success(message),
      onError: (error) => toast.error(error instanceof Error ? error.message : fr.common.genericError),
    });

  const reorder = (round: AdminRoundView, stopId: string, position: number) => {
    const order = moveWithinRound(round.stops.map((stop) => stop.id), stopId, position);
    run({ type: "reorder", roundId: round.id, stopIds: order });
  };

  if (day.isLoading && !data) return <PageSkeleton />;

  const draftWithDriver = (data?.rounds ?? []).filter((round) => round.status === "DRAFT" && round.driverId && round.stops.length > 0).length;
  const mapRounds = (data?.rounds ?? []).map((round) => ({
    id: round.id,
    name: round.name,
    color: colorOf.get(round.id)!,
    driverName: round.driverName,
    stops: round.stops.map((stop) => ({ id: stop.id, sequence: stop.sequence, status: stop.status, merchantName: stop.merchantName, latitude: stop.latitude, longitude: stop.longitude })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
        </div>
        {data?.closed && data.rounds.length > 0 ? (
          <div className="flex flex-col items-end gap-1">
            <Button onClick={() => run({ type: "validate" })} disabled={mutation.isPending} data-testid="admin-validate-rounds">
              <CheckCheck aria-hidden />
              {t.validate}
              {draftWithDriver > 0 ? ` (${draftWithDriver})` : ""}
            </Button>
            <p className="max-w-xs text-right text-xs text-muted-foreground">{t.validateHint}</p>
          </div>
        ) : null}
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t.date}</p>
            <DeliveryDayPicker
              value={date}
              label={t.date}
              onChange={setDate}
              shortcuts={[
                { days: 0, label: t.today },
                { days: 1, label: t.tomorrow },
                { days: 2, label: t.afterTomorrow },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {day.error ? (
        <Alert variant="destructive">
          <AlertDescription>{day.error instanceof Error ? day.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="rounds-lock-state">
            {data.closed ? <Lock className="h-4 w-4" aria-hidden /> : <LockOpen className="h-4 w-4" aria-hidden />}
            {data.closed ? t.closed(deadlineLabel(data.cutoffAt)) : t.notClosed(deadlineLabel(data.cutoffAt))}
          </p>
          {data.unroutedOrders > 0 ? (
            <Alert>
              <AlertDescription>
                {t.unrouted(data.unroutedOrders)}{" "}
                <Link href={`/dashboard/orders?date=${date}&roundId=none`} className="text-brand underline-offset-4 hover:underline">
                  {fr.live.ordersLink}
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}

          {data.rounds.length === 0 && !data.closed ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t.empty}</div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
              <div className="space-y-6">
                <p className="text-xs text-muted-foreground">{t.dragHint}</p>
                {data.slots
                  .filter((slot) => data.closed || data.rounds.some((round) => round.slotId === slot.id))
                  .map((slot) => {
                    const slotRounds = data.rounds.filter((round) => round.slotId === slot.id);
                    return (
                      <section key={slot.id} aria-labelledby={`slot-${slot.id}`} className="space-y-3" data-testid="admin-slot">
                        <div className="flex items-center justify-between gap-2">
                          <h2 id={`slot-${slot.id}`} className="text-lg font-semibold">{t.slot(slot.label)}</h2>
                          {data.closed ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => run({ type: "create", slotId: slot.id })}
                              disabled={mutation.isPending}
                              aria-label={t.newRoundFor(slot.label)}
                              data-testid="admin-new-round"
                            >
                              <Plus aria-hidden />
                              {t.newRound}
                            </Button>
                          ) : null}
                        </div>
                        {slotRounds.length === 0 ? <p className="text-sm text-muted-foreground">{t.empty}</p> : null}
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                          {slotRounds.map((round) => (
                            <RoundCard
                              key={round.id}
                              round={round}
                              color={colorOf.get(round.id)!}
                              siblings={slotRounds.filter((other) => other.id !== round.id)}
                              drivers={data.drivers}
                              selected={selectedRoundId === round.id}
                              busy={mutation.isPending}
                              drag={drag}
                              onSelect={() => setSelectedRoundId((value) => (value === round.id ? null : round.id))}
                              onAssign={(driverId) => run({ type: "assign", roundId: round.id, driverId })}
                              onReorder={(stopId, position) => reorder(round, stopId, position)}
                              onMove={(stopId, roundId, position) => run({ type: "move", stopId, roundId, position })}
                              onOptimize={() => run({ type: "optimize", roundId: round.id })}
                              onDelete={() => run({ type: "delete", roundId: round.id })}
                              onDragChange={setDrag}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
              </div>
              <aside className="space-y-2 xl:sticky xl:top-20 xl:self-start" aria-label={t.map}>
                <h2 className="text-lg font-semibold">{t.map}</h2>
                <p className="text-xs text-muted-foreground">{t.mapHint}</p>
                <div className="overflow-hidden rounded-xl border">
                  <RoundsMap depot={data.depot} rounds={mapRounds} selectedRoundId={selectedRoundId} height={520} />
                </div>
              </aside>
            </div>
          )}

          <RoundJournal entries={data.journal} />
        </>
      ) : null}
    </div>
  );
}
