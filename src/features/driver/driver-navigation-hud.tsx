"use client";

import React from "react";

import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  Navigation,
  RotateCcw,
} from "lucide-react";
import type { NavigationGuidance, TurnIconKind } from "@/lib/maps/navigation-guidance";
import { cn } from "@/lib/utils";

function TurnIcon({ kind, className }: { kind: TurnIconKind; className?: string }) {
  switch (kind) {
    case "left":
    case "slight-left":
      return <CornerUpLeft className={className} />;
    case "right":
    case "slight-right":
      return <CornerUpRight className={className} />;
    case "uturn":
    case "roundabout":
      return <RotateCcw className={className} />;
    case "arrive":
      return <Flag className={className} />;
    case "depart":
    case "straight":
    default:
      return <ArrowUp className={className} />;
  }
}

interface DriverNavigationHudProps {
  guidance: NavigationGuidance | null;
  destinationLabel: string;
  etaLabel: string | null;
  remainingLabel: string | null;
  loading?: boolean;
  unavailable?: boolean;
  waitingForPosition?: boolean;
}

export function DriverNavigationHud({
  guidance,
  destinationLabel,
  etaLabel,
  remainingLabel,
  loading,
  unavailable,
  waitingForPosition,
}: DriverNavigationHudProps) {
  if (unavailable || waitingForPosition) {
    return <div role="status" className="rounded-2xl bg-white/95 px-4 py-4 text-foreground shadow-xl">
      <p className="text-sm font-semibold">{waitingForPosition ? "En attente de la position GPS" : "Itinéraire indisponible"}</p>
      <p className="mt-1 text-xs">{waitingForPosition ? "Le guidage débutera avec une position exploitable." : "Aucun guidage ni durée fiable. Nouvelle tentative automatique ; Google Maps reste accessible ci-dessous."}</p>
    </div>;
  }
  if (loading || !guidance) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black px-4 py-5 text-white shadow-xl">
        <p className="text-sm font-medium opacity-90">Calcul du guidage…</p>
        <p className="mt-1 text-xs opacity-75">Vers {destinationLabel}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-black px-4 py-4 text-white shadow-xl transition-colors"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-center justify-center rounded-xl bg-white/15 px-3 py-2">
          <TurnIcon kind={guidance.icon} className="h-8 w-8" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-3xl font-bold leading-none tracking-tight">{guidance.distanceLabel}</p>
          <p className="mt-2 text-lg font-semibold leading-tight">{guidance.primaryAction}</p>
          {guidance.streetName && (
            <p className="mt-1 truncate text-base font-medium text-white/95">{guidance.streetName}</p>
          )}
          {guidance.nextPreview && (
            <p className="mt-2 truncate text-xs text-white/80">{guidance.nextPreview}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-3 text-xs text-white/85">
        <span className="inline-flex items-center gap-1.5 truncate">
          <Navigation className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{destinationLabel}</span>
        </span>
        <span className="shrink-0 pl-2">
          {remainingLabel}
          {etaLabel ? ` · ${etaLabel}` : ""}
        </span>
      </div>
    </div>
  );
}
