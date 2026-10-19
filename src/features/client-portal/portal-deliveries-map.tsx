"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { DeliveriesMapApi } from "@/components/maps/deliveries-live-map";
import { mapGlassButtonStyle, mapGlassCardStyle } from "@/components/maps/map-glass-styles";
import { PageLoader } from "@/components/ui/loader";
import { PortalDeliveriesMapPanel } from "@/features/client-portal/portal-deliveries-map-panel";
import { usePortalDeliveriesMap } from "@/features/client-portal/hooks";
import { DeliveryMapStatusBar } from "@/components/maps/delivery-map-status-bar";
import { cn } from "@/lib/utils";

const DeliveriesLiveMap = dynamic(
  () => import("@/components/maps/deliveries-live-map").then((module) => module.DeliveriesLiveMap),
  { ssr: false }
);

interface PortalDeliveriesMapProps {
  fullscreen?: boolean;
  height?: number;
}

export function PortalDeliveriesMap({ fullscreen = true, height = 480 }: PortalDeliveriesMapProps) {
  const { data, isPending, isError, error } = usePortalDeliveriesMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<DeliveriesMapApi | null>(null);

  const activeDeliveries = useMemo(() => data?.active ?? [], [data?.active]);
  const historyDeliveries = useMemo(() => data?.history ?? [], [data?.history]);
  const allDeliveries = useMemo(
    () => [...activeDeliveries, ...historyDeliveries],
    [activeDeliveries, historyDeliveries]
  );

  const selectedDelivery = useMemo(
    () => allDeliveries.find((delivery) => delivery.id === selectedId) ?? null,
    [allDeliveries, selectedId]
  );

  useEffect(() => {
    if (allDeliveries.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !allDeliveries.some((delivery) => delivery.id === selectedId)) {
      setSelectedId(activeDeliveries[0]?.id ?? historyDeliveries[0]?.id ?? null);
    }
  }, [allDeliveries, activeDeliveries, historyDeliveries, selectedId]);

  if (isPending && !isError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden bg-[#ececea]",
          fullscreen ? "h-full w-full" : "rounded-2xl"
        )}
        style={fullscreen ? undefined : { height }}
      >
        <PageLoader />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[#ececea]",
        fullscreen ? "h-full w-full" : "rounded-2xl shadow-md"
      )}
      style={fullscreen ? undefined : { height }}
      data-dispatch-map-page
    >
      <div className="absolute inset-0">
        <DeliveriesLiveMap delivery={selectedDelivery} onMapReady={setMapApi} />
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[1000] flex flex-col items-stretch p-4",
          fullscreen
            ? "pt-[calc(var(--portal-chrome,calc(4rem+1.5rem+2.875rem))+0.75rem)]"
            : "pt-4"
        )}
      >
        {selectedDelivery && !selectedDelivery.isHistorical ? (
          <div className="flex justify-center">
            <DeliveryMapStatusBar
              status={selectedDelivery.status}
              deliveryCategory={selectedDelivery.deliveryCategory}
            />
          </div>
        ) : null}

        {selectedDelivery?.isHistorical ? (
          <div className="flex justify-center">
            <p className="rounded-full px-4 py-2 text-sm text-muted-foreground" style={mapGlassCardStyle}>
              Livraison terminée · {selectedDelivery.statusLabel}
            </p>
          </div>
        ) : null}

        <div className={cn("flex justify-start", selectedDelivery && "mt-3")}>
          <PortalDeliveriesMapPanel
            activeDeliveries={activeDeliveries}
            historyDeliveries={historyDeliveries}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {isError && (
        <div
          className={cn(
            "pointer-events-none absolute left-4 right-4 z-[1000]",
            fullscreen
              ? "top-[calc(var(--portal-chrome,calc(4rem+1.5rem+2.875rem))+1.75rem)]"
              : "top-20"
          )}
        >
          <div className="rounded-2xl bg-red-500 px-4 py-2.5 text-center text-sm text-white shadow-lg">
            {error instanceof Error ? error.message : "Erreur de chargement"}
          </div>
        </div>
      )}

      {!selectedDelivery && allDeliveries.length === 0 && !isError && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-[1000] flex justify-center px-4">
          <p className="rounded-full px-4 py-2 text-sm text-muted-foreground" style={mapGlassCardStyle}>
            Aucune livraison à afficher
          </p>
        </div>
      )}

      <div className="absolute bottom-5 right-5 z-[1100] flex flex-col gap-2 max-md:bottom-4 max-md:right-3">
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
