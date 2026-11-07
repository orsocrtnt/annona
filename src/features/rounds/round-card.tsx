"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, KeyRound, ListOrdered, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AdminRoundView } from "@/domains/round/round.types";
import { timeLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.rounds;
const NO_DRIVER = "none";
export const DRAG_MIME = "application/x-annona-stop";

export interface DragState {
  stopId: string;
  roundId: string;
}

interface RoundCardProps {
  round: AdminRoundView;
  color: string;
  /** Autres tournées du même jour et du même créneau (RG-08). */
  siblings: AdminRoundView[];
  drivers: Array<{ id: string; name: string }>;
  selected: boolean;
  busy: boolean;
  drag: DragState | null;
  onSelect: () => void;
  onAssign: (driverId: string | null) => void;
  onReorder: (stopId: string, position: number) => void;
  onMove: (stopId: string, roundId: string, position: number | null) => void;
  onOptimize: () => void;
  onDelete: () => void;
  onDragChange: (drag: DragState | null) => void;
}

/**
 * Une tournée (ADM-06, ADM-07) : livreur, ordre des arrêts (glisser-déposer avec repli clavier : flèches
 * monter / descendre), déplacement vers une autre tournée du créneau, recalcul de l'ordre.
 */
export function RoundCard(props: RoundCardProps) {
  const { round, color, siblings, drivers, selected, busy, drag, onSelect, onAssign, onReorder, onMove, onOptimize, onDelete, onDragChange } = props;
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const editable = round.status === "DRAFT" || round.status === "ASSIGNED" || round.status === "IN_PROGRESS";
  const canDrop = (state: DragState | null) => editable && state !== null && (state.roundId === round.id || siblings.some((sibling) => sibling.id === state.roundId));

  /** L'arrêt glissé est lu dans le transfert (et non l'état React, pas encore à jour au premier survol). */
  const accepts = (event: React.DragEvent) => editable && event.dataTransfer.types.includes(DRAG_MIME);
  const dragged = (event: React.DragEvent): DragState | null => {
    const [stopId, roundId] = event.dataTransfer.getData(DRAG_MIME).split("|");
    return stopId && roundId ? { stopId, roundId } : drag;
  };

  const drop = (position: number | null, state: DragState | null) => {
    setOverIndex(null);
    onDragChange(null);
    if (!state || !canDrop(state)) return;
    if (state.roundId === round.id) {
      const current = round.stops.findIndex((stop) => stop.id === state.stopId) + 1;
      const target = position ?? round.stops.length;
      if (current > 0 && target !== current) onReorder(state.stopId, target);
    } else {
      onMove(state.stopId, round.id, position);
    }
  };

  return (
    <Card
      className={cn("transition-shadow", selected && "ring-2 ring-primary/50")}
      data-testid="admin-round"
      data-round-id={round.id}
      data-round-name={round.name}
    >
      <CardHeader className="space-y-3 p-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button type="button" onClick={onSelect} className="flex min-w-0 items-center gap-2 text-left" aria-pressed={selected}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{round.name}</span>
              <span className="text-xs text-muted-foreground">
                {t.stops(round.progress.total)}
                {round.progress.delivered > 0 ? ` · ${fr.live.progressLabel(round.progress.delivered, round.progress.total)}` : ""}
              </span>
            </span>
          </button>
          <Badge variant={round.status === "DRAFT" ? "outline" : round.status === "COMPLETED" ? "success" : "brand"} data-testid="admin-round-status">
            {fr.roundStatus[round.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={round.driverId ?? NO_DRIVER}
            onValueChange={(value) => onAssign(value === NO_DRIVER ? null : value)}
            disabled={!editable || busy}
          >
            <SelectTrigger className="h-9 w-56 max-w-full" aria-label={t.driverOf(round.name)} data-testid="admin-round-driver">
              <SelectValue placeholder={t.noDriver} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_DRIVER}>{t.noDriver}</SelectItem>
              {drivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {editable && round.stops.length > 1 ? (
            <Button variant="outline" size="sm" onClick={onOptimize} disabled={busy} aria-label={t.optimizeOf(round.name)}>
              <ListOrdered aria-hidden />
              {t.optimize}
            </Button>
          ) : null}
          {round.stops.length === 0 && round.status !== "IN_PROGRESS" ? (
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={busy} aria-label={t.deleteRoundOf(round.name)} data-testid="admin-round-delete">
              <Trash2 aria-hidden />
              {t.deleteRound}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-0">
        <ol
          className={cn("min-h-12 space-y-1 rounded-lg p-1", drag && canDrop(drag) && "bg-muted/50 outline-dashed outline-1 outline-border")}
          onDragOver={(event) => {
            if (!accepts(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            event.preventDefault();
            drop(null, dragged(event));
          }}
          aria-label={round.name}
        >
          {round.stops.length === 0 ? <li className="px-3 py-4 text-center text-sm text-muted-foreground">{t.noStop}</li> : null}
          {round.stops.map((stop, index) => {
            const movable = editable && stop.status === "PENDING";
            const others = siblings.filter((sibling) => sibling.status === "DRAFT" || sibling.status === "ASSIGNED" || sibling.status === "IN_PROGRESS");
            return (
              <li
                key={stop.id}
                draggable={editable}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_MIME, `${stop.id}|${round.id}`);
                  event.dataTransfer.setData("text/plain", stop.merchantName);
                  event.dataTransfer.effectAllowed = "move";
                  onDragChange({ stopId: stop.id, roundId: round.id });
                }}
                onDragEnd={() => {
                  setOverIndex(null);
                  onDragChange(null);
                }}
                onDragOver={(event) => {
                  if (!accepts(event)) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setOverIndex(index);
                }}
                onDragLeave={() => setOverIndex((value) => (value === index ? null : value))}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  drop(index + 1, dragged(event));
                }}
                className={cn(
                  "flex items-start gap-2 rounded-lg border bg-card px-2 py-2",
                  overIndex === index && "border-primary",
                  drag?.stopId === stop.id && "opacity-50",
                  stop.status !== "PENDING" && "bg-muted/40"
                )}
                data-testid="admin-stop"
                data-stop-id={stop.id}
                data-merchant={stop.merchantName}
              >
                {editable ? <GripVertical className="mt-1 h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden /> : null}
                <span
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums"
                  style={{ background: stop.status === "INCIDENT" ? "#e5533f" : stop.status === "DELIVERED" ? "#a1aaa4" : color }}
                  aria-hidden
                >
                  {stop.sequence}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    <span className="sr-only">{t.stopNumber(stop.sequence)} : </span>
                    {stop.merchantName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {stop.address || t.noCoordinates} · {fr.packages(stop.packages, stop.items)}
                  </p>
                  {stop.accessInstructions ? (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <KeyRound className="h-3 w-3 shrink-0" aria-hidden />
                      {stop.accessInstructions}
                    </p>
                  ) : null}
                  {stop.status !== "PENDING" ? (
                    <p className="mt-0.5 text-xs">
                      {stop.status === "DELIVERED" && stop.deliveredAt ? (
                        <span className="text-success">{t.deliveredAt(timeLabel(stop.deliveredAt))}</span>
                      ) : (
                        <span className="text-error">{fr.incidentCodes[stop.incident?.code ?? "OTHER"] ?? fr.stopStatus.INCIDENT}</span>
                      )}
                    </p>
                  ) : null}
                  {movable && others.length > 0 ? (
                    <Select value="" onValueChange={(value) => onMove(stop.id, value, null)} disabled={busy}>
                      <SelectTrigger className="mt-1 h-8 w-48 max-w-full text-xs" aria-label={t.moveToOf(stop.merchantName)} data-testid="admin-stop-move">
                        <SelectValue placeholder={t.moveTo} />
                      </SelectTrigger>
                      <SelectContent>
                        {others.map((sibling) => (
                          <SelectItem key={sibling.id} value={sibling.id}>{sibling.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null}
                </div>
                {editable ? (
                  <div className="flex shrink-0 flex-col">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      disabled={busy || index === 0}
                      onClick={() => onReorder(stop.id, index)}
                      aria-label={t.moveUp(stop.merchantName)}
                    >
                      <ArrowUp aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7"
                      disabled={busy || index === round.stops.length - 1}
                      onClick={() => onReorder(stop.id, index + 2)}
                      aria-label={t.moveDown(stop.merchantName)}
                    >
                      <ArrowDown aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
