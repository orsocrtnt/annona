"use client";

import dynamic from "next/dynamic";
import type { StopStatus } from "@prisma/client";

export interface RoundsMapRound {
  id: string;
  name: string;
  color: string;
  driverName?: string | null;
  driverPosition?: { latitude: number; longitude: number } | null;
  stops: Array<{ id: string; sequence: number; status: StopStatus; merchantName: string; latitude: number | null; longitude: number | null }>;
}

export interface RoundsMapProps {
  depot: { latitude: number; longitude: number } | null;
  rounds: RoundsMapRound[];
  selectedRoundId: string | null;
  height?: number;
}

/** Couleurs des tournées sur la carte (contraste suffisant sur le plan clair et le liseré blanc). */
export const ROUND_COLORS = ["#2563eb", "#c2410c", "#7c3aed", "#0f766e", "#be185d", "#4d7c0f", "#a16207", "#0369a1"] as const;

const Inner = dynamic(() => import("./rounds-map-inner").then((module) => module.RoundsMapInner), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-xl bg-muted" />,
});

/** Carte des tournées (ADM-06) et du suivi en direct (ADM-08) : un numéro par arrêt, une couleur par tournée. */
export function RoundsMap(props: RoundsMapProps) {
  return <Inner {...props} />;
}
