"use client";

import dynamic from "next/dynamic";
import type { DriverTracking } from "@/domains/round/driver-tracking.service";

export interface TrackingMapProps {
  tracking: DriverTracking;
  selectedRoundId: string | null;
  onSelect: (roundId: string) => void;
  colorOf: (roundId: string) => string;
  height?: number;
}

const Inner = dynamic(() => import("./tracking-map-inner").then((loaded) => loaded.TrackingMapInner), {
  ssr: false,
  loading: () => <div className="h-[460px] w-full animate-pulse rounded-xl bg-muted" />,
});

/** Lot 1, demande 5 : carte des livreurs en tournée et de leur trajet vers les prochains arrêts. */
export function TrackingMap(props: TrackingMapProps) {
  return <Inner {...props} />;
}
