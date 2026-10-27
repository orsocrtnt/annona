"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DriversMapApi } from "@/components/maps/drivers-live-map";
import { mapGlassButtonStyle, mapGlassCardStyle } from "@/components/maps/map-glass-styles";

const DriversLiveMap = dynamic(
  () => import("@/components/maps/drivers-live-map").then((m) => m.DriversLiveMap),
  { ssr: false }
);
import { useDriverLiveLocations } from "@/features/back-office/dispatch-map-hooks";
import { OfferFeatureGate } from "@/features/saas/locked-offer-feature";

export default function DispatchDriversMapPage() {
  return (
    <OfferFeatureGate feature="admin_gps">
      <DispatchDriversMapContent />
    </OfferFeatureGate>
  );
}

function DispatchDriversMapContent() {
  const { data: drivers, error, isError } = useDriverLiveLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<DriversMapApi | null>(null);

  const list = useMemo(() => drivers ?? [], [drivers]);
  const onlineCount = useMemo(() => list.filter((d) => d.isOnline).length, [list]);
  const locatedCount = useMemo(
    () => list.filter((d) => d.latitude != null).length,
    [list]
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ececea]">
      <h1 className="sr-only">Carte des chauffeurs</h1>
      <div className="absolute inset-0">
        <DriversLiveMap
          drivers={list}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onMapReady={setMapApi}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex justify-center p-4">
        <div className="pointer-events-auto text-sm" style={mapGlassCardStyle}>
          <span className="font-semibold text-foreground">{onlineCount}</span>
          <span className="text-muted-foreground">
            {" "}
            {onlineCount === 1 ? "connecté" : "connectés"}
          </span>
          <span className="mx-2 text-muted-foreground" aria-hidden="true">·</span>
          <span className="sr-only">, </span>
          <span className="font-semibold text-foreground">{locatedCount}</span>
          <span className="text-muted-foreground">
            {" "}
            {locatedCount === 1 ? "localisé" : "localisés"}
          </span>
        </div>
      </div>

      {isError && (
        <div className="pointer-events-none absolute left-4 right-4 top-20 z-[1000]">
          <div className="rounded-2xl bg-red-500 px-4 py-2.5 text-center text-sm text-white shadow-lg">
            {error instanceof Error ? error.message : "Erreur de chargement"}
          </div>
        </div>
      )}

      <div
        className="absolute z-[1100] flex flex-col gap-2"
        style={{ bottom: 20, right: 20 }}
      >
        <button
          type="button"
          aria-label="Zoomer"
          className="shrink-0 rounded-xl outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          style={mapGlassButtonStyle}
          onClick={() => mapApi?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Dézoomer"
          className="shrink-0 rounded-xl outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          style={mapGlassButtonStyle}
          onClick={() => mapApi?.zoomOut()}
        >
          −
        </button>
      </div>
    </div>
  );
}
