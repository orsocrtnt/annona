"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Route, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoundProposals, useSubmitRound } from "@/features/back-office/hooks";
import type { PresentedRound, RoundProposals, RoundUnplannedReason } from "@/domains/delivery/delivery-rounds.service";
import { usePermissions } from "@/hooks/use-permissions";
import { deliverySlotRange, formatWeightKg } from "@/lib/format/delivery-slot";

const DISPATCH_ROLES = new Set(["COMPANY_ADMIN", "MINI_ADMIN", "DISPATCHER"]);

const UNPLANNED_LABELS: Record<RoundUnplannedReason, string> = {
  NO_ELIGIBLE_DRIVER: "Aucun livreur compatible (zone, type de livraison ou pause)",
  SLOT_MISSED: "Créneau impossible à tenir",
  CAPACITY_EXCEEDED: "Trop lourd pour les véhicules disponibles",
  DAY_EXCEEDED: "Dépasse la durée de la journée",
  TOO_MANY_DELIVERIES: "Tournées déjà pleines",
  NOT_LOCATED: "Adresse non localisée",
  MULTI_PICKUP: "Plusieurs retraits : à affecter à part",
};

const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

function violationLabel(violation: PresentedRound["violations"][number]): string {
  switch (violation.code) {
    case "SLOT_MISSED":
      return `${violation.reference} : créneau manqué de ${violation.lateMinutes} min`;
    case "CAPACITY_EXCEEDED":
      return `Charge ${formatWeightKg(violation.loadKg)} pour un véhicule de ${formatWeightKg(violation.capacityKg)}`;
    case "DAY_EXCEEDED":
      return `Durée ${violation.minutes} min pour un maximum de ${violation.maxMinutes} min`;
    case "TOO_MANY_DELIVERIES":
      return `${violation.count} livraisons pour un maximum de ${violation.max}`;
    case "PICKUP_AFTER_DROPOFF":
      return `${violation.reference} : le retrait doit précéder la livraison`;
    case "NOT_ELIGIBLE":
      return `${violation.reference} : ce livreur ne peut pas la prendre (zone, type ou pause)`;
  }
}

function RoundCard({ initial, drivers }: { initial: PresentedRound; drivers: RoundProposals["drivers"] }) {
  const [round, setRound] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const submit = useSubmitRound();
  // Verrou synchrone : un double clic n'envoie qu'une validation.
  const inFlight = useRef(false);
  useEffect(() => setRound(initial), [initial]);

  const stopsOf = (next: PresentedRound["stops"]) => next.map(({ deliveryId, kind }) => ({ deliveryId, kind }));

  const recalculate = async (driverId: string, stops: PresentedRound["stops"]) => {
    if (stops.length === 0 || inFlight.current) return;
    inFlight.current = true;
    setConfirming(false);
    try {
      const result = await submit.mutateAsync({ driverId, stops: stopsOf(stops), dryRun: true });
      setRound(result.round);
    } catch (error) {
      toast.error("Recalcul impossible", { description: error instanceof Error ? error.message : undefined });
    } finally {
      inFlight.current = false;
    }
  };

  const move = (index: number, offset: number) => {
    const next = [...round.stops];
    const [stop] = next.splice(index, 1);
    next.splice(index + offset, 0, stop!);
    void recalculate(round.driverId, next);
  };

  const validate = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const result = await submit.mutateAsync({ driverId: round.driverId, stops: stopsOf(round.stops), acceptViolations: confirming });
      setRound(result.round);
      if (result.status === "NEEDS_CONFIRMATION") {
        setConfirming(true);
      } else if (result.status === "DONE") {
        if (result.failed.length > 0) {
          toast.warning(`${result.assigned.length} livraison(s) affectée(s), ${result.failed.length} déjà prise(s) entre-temps`);
        } else {
          toast.success(`Tournée confiée à ${round.driverName}`);
        }
      }
    } catch (error) {
      toast.error("Validation impossible", { description: error instanceof Error ? error.message : undefined });
    } finally {
      inFlight.current = false;
    }
  };

  const hasBlocking = round.violations.length > 0;
  return (
    <section className="space-y-3 rounded-2xl border border-border p-4" data-round-card="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-44">
          <Select value={round.driverId} onValueChange={(driverId) => void recalculate(driverId, round.stops)}>
            <SelectTrigger aria-label="Livreur de la tournée">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {round.approximate ? "Environ " : ""}{round.durationMinutes} min
          {round.maxLoadKg > 0 && ` · ${formatWeightKg(round.maxLoadKg)}${round.capacityKg ? ` / ${formatWeightKg(round.capacityKg)}` : ""}`}
          {round.unknownWeightCount > 0 && ` · ${round.unknownWeightCount} sans poids`}
          {!round.startKnown && " · position du livreur inconnue, horaires à partir du premier arrêt"}
        </p>
      </div>

      <ol className="space-y-2">
        {round.stops.map((stop, index) => (
          <li key={`${stop.deliveryId}-${stop.kind}`} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2 text-sm">
            <span className="w-12 shrink-0 tabular-nums font-medium">{TIME.format(new Date(stop.arrivalAt))}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{stop.kind === "PICKUP" ? "Retrait : " : ""}{stop.address}</span>
              <span className="block text-xs text-muted-foreground">
                {stop.reference}
                {stop.slot && ` · créneau ${deliverySlotRange(stop.slot.start, stop.slot.end)}`}
                {stop.weightKg != null && ` · ${formatWeightKg(stop.weightKg)}`}
                {stop.waitMinutes > 0 && ` · attente ${stop.waitMinutes} min`}
              </span>
            </span>
            <span className="flex shrink-0">
              <Button type="button" variant="ghost" size="icon" aria-label={`Monter ${stop.reference}`} disabled={index === 0 || submit.isPending} onClick={() => move(index, -1)}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" aria-label={`Descendre ${stop.reference}`} disabled={index === round.stops.length - 1 || submit.isPending} onClick={() => move(index, 1)}>
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Retirer ${stop.reference} de la tournée`}
                disabled={submit.isPending || new Set(round.stops.map((item) => item.deliveryId)).size === 1}
                onClick={() => void recalculate(round.driverId, round.stops.filter((item) => item.deliveryId !== stop.deliveryId))}
              >
                <X className="h-4 w-4" />
              </Button>
            </span>
          </li>
        ))}
      </ol>

      {hasBlocking && (
        <ul className="space-y-1 text-sm text-destructive" data-round-violations="true">
          {round.violations.map((violation, index) => (
            <li key={index}>{violationLabel(violation)}</li>
          ))}
        </ul>
      )}

      <Button type="button" variant={confirming ? "destructive" : "brand"} size="sm" loading={submit.isPending} onClick={() => void validate()}>
        {confirming ? "Valider quand même" : "Valider et affecter"}
      </Button>
    </section>
  );
}

/** DISPATCH-4, piste 3 : TutelLiv propose, le dispatcher modifie puis valide (C12). */
export function DispatchRoundsPanel() {
  const { can, role } = usePermissions();
  const allowed = can("deliveries:dispatch") && Boolean(role && DISPATCH_ROLES.has(role));
  const [opened, setOpened] = useState(false);
  const { data, isFetching, error, refetch } = useRoundProposals(opened && allowed);
  if (!allowed) return null;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Tournées</CardTitle>
          <CardDescription>Regroupe les livraisons à faire aujourd&apos;hui, selon les créneaux, la capacité, la zone et la durée de la journée.</CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={isFetching}
          onClick={() => (opened ? void refetch() : setOpened(true))}
        >
          <Route className="h-4 w-4" aria-hidden />
          {opened ? "Recalculer" : "Proposer des tournées"}
        </Button>
      </CardHeader>
      {opened && (
        <CardContent className="space-y-4">
          {error ? (
            <p className="text-sm text-destructive">{error instanceof Error ? error.message : "Tournées indisponibles"}</p>
          ) : !data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              {data.rounds.length === 0 && data.unplanned.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune livraison à regrouper pour aujourd&apos;hui.</p>
              )}
              {data.rounds.map((round) => (
                <RoundCard key={round.driverId} initial={round} drivers={data.drivers} />
              ))}
              {data.unplanned.length > 0 && (
                <div className="space-y-1" data-round-unplanned="true">
                  <p className="text-sm font-medium">À affecter à part ({data.unplanned.length})</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {data.unplanned.map((item) => (
                      <li key={item.deliveryId}>{item.reference} · {item.address} : {UNPLANNED_LABELS[item.reason]}</li>
                    ))}
                  </ul>
                </div>
              )}
              {data.laterCount > 0 && (
                <p className="text-sm text-muted-foreground">{data.laterCount} livraison(s) prévue(s) un autre jour, non regroupée(s).</p>
              )}
              {data.active.length > 0 && (
                <div className="space-y-2" data-round-active="true">
                  <p className="text-sm font-medium">Tournées en cours</p>
                  {data.active.map((round) => (
                    <div key={round.roundId} className="rounded-lg bg-muted/30 p-2 text-sm">
                      <p className="font-medium">{round.driverName}</p>
                      <ol className="list-decimal pl-5 text-muted-foreground">
                        {round.deliveries.map((delivery) => (
                          <li key={delivery.id}>{delivery.reference} · {delivery.address}</li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
