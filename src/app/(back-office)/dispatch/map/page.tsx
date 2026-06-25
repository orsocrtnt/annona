"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DeliveriesMapApi } from "@/components/maps/deliveries-live-map";
import { mapGlassButtonStyle, mapGlassCardStyle } from "@/components/maps/map-glass-styles";

const DeliveriesLiveMap = dynamic(
  () => import("@/components/maps/deliveries-live-map").then((m) => m.DeliveriesLiveMap),
  { ssr: false }
);
import { DispatchDeliveriesMapPanel } from "@/features/back-office/dispatch-deliveries-map-panel";
import { useDispatchDeliveriesMap } from "@/features/back-office/dispatch-map-hooks";
import { PageLoader } from "@/components/ui/loader";

export default function DispatchMapPage() {
  const { data, isLoading, error, isError } = useDispatchDeliveriesMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<DeliveriesMapApi | null>(null);

  const deliveries = data?.deliveries ?? [];

  const selectedDelivery = useMemo(
    () => deliveries.find((d) => d.id === selectedId) ?? null,
    [deliveries, selectedId]
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#f0f0f0]">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f0f0f0]" data-dispatch-map-page>
      <div className="absolute inset-0">
        <DeliveriesLiveMap delivery={selectedDelivery} onMapReady={setMapApi} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1000] p-4">
        <DispatchDeliveriesMapPanel
          deliveries={deliveries}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      {selectedDelivery && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] flex justify-center px-4 md:pl-[min(380px,calc(100vw-16px))]">
          <div className="pointer-events-auto max-w-lg text-sm" style={mapGlassCardStyle}>
            <span className="font-semibold text-foreground">{selectedDelivery.reference}</span>
            {selectedDelivery.deliveryCategory === "STANDARD" && selectedDelivery.customerName && (
              <span className="text-muted-foreground"> — {selectedDelivery.customerName}</span>
            )}
          </div>
        </div>
      )}

      {isError && (
        <div className="pointer-events-none absolute left-4 right-4 top-20 z-[1000] md:pl-[min(380px,calc(100vw-16px))]">
          <div className="rounded-2xl bg-red-500 px-4 py-2.5 text-center text-sm text-white shadow-lg">
            {error instanceof Error ? error.message : "Erreur de chargement"}
          </div>
        </div>
      )}

      {!selectedDelivery && deliveries.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-[1000] flex justify-center px-4">
          <p className="rounded-full px-4 py-2 text-sm text-muted-foreground" style={mapGlassCardStyle}>
            Sélectionnez une livraison pour afficher l&apos;adresse sur la carte
          </p>
        </div>
      )}

      <div className="absolute bottom-5 right-5 z-[1100] flex flex-col gap-2 max-md:bottom-4 max-md:right-3">
        <button
          type="button"
          aria-label="Zoomer"
          className="shrink-0 transition-opacity hover:opacity-80"
          style={mapGlassButtonStyle}
          onClick={() => mapApi?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Dézoomer"
          className="shrink-0 transition-opacity hover:opacity-80"
          style={mapGlassButtonStyle}
          onClick={() => mapApi?.zoomOut()}
        >
          −
        </button>
      </div>
    </div>
  );
}
