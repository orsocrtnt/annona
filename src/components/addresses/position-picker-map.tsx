"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { PickerPosition } from "@/components/addresses/position-picker-map-inner";

const PositionPickerMapInner = dynamic(
  () => import("@/components/addresses/position-picker-map-inner").then((module) => module.PositionPickerMapInner),
  {
    ssr: false,
    loading: () => <div className="flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">Carte…</div>,
  }
);

interface PositionPickerMapProps {
  position: PickerPosition;
  onChange: (position: PickerPosition) => void;
  label: string;
  hint: string;
}

/** Carte de la position de livraison : repère déplaçable, coordonnées affichées. */
export function PositionPickerMap({ position, onChange, label, hint }: PositionPickerMapProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border" data-testid="position-picker">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
        <span className="font-medium text-foreground">{label}</span>
        <span>{hint}</span>
        <span className="ml-auto tabular-nums" data-testid="position-coordinates">
          {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
        </span>
      </div>
      <div className="h-56 w-full">
        <PositionPickerMapInner position={position} onChange={onChange} />
      </div>
    </div>
  );
}
