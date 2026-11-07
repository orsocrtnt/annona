"use client";

import { Check, ChevronDown, CloudOff, KeyRound, MapPin, Navigation, Phone, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EffectiveStop } from "@/features/driver/round/effective-rounds";
import { timeLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.driverRound;

interface DriverStopCardProps {
  stop: EffectiveStop;
  slotLabel: string;
  current: boolean;
  expanded: boolean;
  /** Tournée démarrée : les boutons d'action sont proposés. */
  actionable: boolean;
  onToggle: () => void;
  onDelivered: () => void;
  onProblem: () => void;
  onRoute: () => void;
}

/** LIV-01 : un arrêt (commerce, adresse, créneau, colis, consignes) ; LIV-03 et LIV-05 en un appui. */
export function DriverStopCard({ stop, slotLabel, current, expanded, actionable, onToggle, onDelivered, onProblem, onRoute }: DriverStopCardProps) {
  const done = stop.status !== "PENDING";
  const open = expanded || current;
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card",
        current && "border-brand shadow-sm ring-1 ring-brand/30",
        done && "bg-muted/40"
      )}
      data-testid="driver-stop"
      data-stop-id={stop.id}
      data-status={stop.status}
      aria-current={current ? "step" : undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 rounded-2xl p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums",
            stop.status === "DELIVERED" ? "bg-success-subtle text-success" : stop.status === "INCIDENT" ? "bg-error-subtle text-error" : current ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
          aria-hidden
        >
          {stop.status === "DELIVERED" ? <Check className="h-5 w-5" /> : stop.sequence}
        </span>
        <span className="min-w-0 flex-1">
          <span className="sr-only">{t.stopNumber(stop.sequence)} : </span>
          <span className="block font-semibold leading-snug" data-testid="driver-stop-name">{stop.merchantName}</span>
          <span className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {stop.address}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span>{fr.packages(stop.packages, stop.items)}</span>
            <span className="text-muted-foreground">· {slotLabel}</span>
            {stop.status === "DELIVERED" && stop.deliveredAt ? <Badge variant="success">{t.deliveredAt(timeLabel(stop.deliveredAt))}</Badge> : null}
            {stop.incident ? (
              <Badge variant="error">{t.problemAt(fr.incidentCodes[stop.incident.code] ?? stop.incident.code, timeLabel(stop.incident.at))}</Badge>
            ) : null}
            {stop.pendingSync ? (
              <Badge variant="warning" data-testid="driver-stop-pending">
                <CloudOff className="mr-1 h-3 w-3" aria-hidden />
                {t.pendingBadge}
              </Badge>
            ) : null}
          </span>
        </span>
        {!current ? <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden /> : null}
      </button>

      {open ? (
        <div className="space-y-3 px-4 pb-4">
          {stop.accessInstructions ? (
            <p className="flex gap-2 rounded-xl bg-muted px-3 py-2 text-sm">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span>
                <span className="font-medium">{t.access} : </span>
                {stop.accessInstructions}
              </span>
            </p>
          ) : null}
          {stop.lines.length > 0 ? (
            <ul className="text-sm text-muted-foreground">
              {stop.lines.map((line) => (
                <li key={line.name}>
                  {line.quantity} × {line.name}
                  {line.unit ? <span className="text-xs"> ({line.unit})</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {stop.incident?.comment ? <p className="text-sm italic">« {stop.incident.comment} »</p> : null}
          {actionable ? (
            <div className="space-y-2">
              {stop.status !== "DELIVERED" ? (
                <Button size="xl" className="w-full" onClick={onDelivered} aria-label={t.deliveredOf(stop.merchantName)} data-testid="driver-delivered">
                  <Check className="!size-5" aria-hidden />
                  {t.delivered}
                </Button>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="touch" onClick={onRoute} aria-label={t.routeOf(stop.merchantName)}>
                  <Navigation aria-hidden />
                  {t.route}
                </Button>
                <Button variant="outline" size="touch" onClick={onProblem} aria-label={t.problemOf(stop.merchantName)} data-testid="driver-problem">
                  <TriangleAlert aria-hidden />
                  {t.problem}
                </Button>
              </div>
              {stop.contactPhone ? (
                <Button asChild variant="ghost" size="touch" className="w-full">
                  <a href={`tel:${stop.contactPhone.replace(/\s+/g, "")}`}>
                    <Phone aria-hidden />
                    {t.phone}
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
