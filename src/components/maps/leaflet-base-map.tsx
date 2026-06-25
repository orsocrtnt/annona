"use client";

import dynamic from "next/dynamic";

export const PARIS_CENTER: [number, number] = [48.8566, 2.3522];

export interface LeafletBaseMapProps {
  height?: number;
  fill?: boolean;
  variant?: "default" | "uber";
  center?: [number, number];
  zoom?: number;
  children?: React.ReactNode;
  className?: string;
}

const LeafletBaseMapInner = dynamic(
  () => import("./leaflet-base-map-inner").then((m) => m.LeafletBaseMapInner),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center bg-[#f0f0f0] text-sm text-muted-foreground"
        style={{ height: 700 }}
      >
        Chargement…
      </div>
    ),
  }
);

export function LeafletBaseMap({ height = 600, ...props }: LeafletBaseMapProps) {
  return <LeafletBaseMapInner height={height} {...props} />;
}
