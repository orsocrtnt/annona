"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DeliveriesMapApi } from "@/components/maps/deliveries-live-map";
import { mapGlassButtonStyle, mapGlassCardStyle } from "@/components/maps/map-glass-styles";

const DeliveriesLiveMap = dynamic(
  () => import("@/components/maps/deliveries-live-map").then((m) => m.DeliveriesLiveMap),
  { ssr: false }
);
import { DispatchDeliveriesMapPanel } from "@/features/back-office/dispatch-deliveries-map-panel";
import { useDispatchDeliveriesMap } from "@/features/back-office/dispatch-map-hooks";
import { PageLoader } from "@/components/ui/loader";
import { isLateDispatchDelivery } from "@/features/back-office/dispatch-focus";

export default function DispatchMapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-[#ececea]">
          <PageLoader />
        </div>
      }
    >
      <DispatchMapContent />
    </Suspense>
  );
}

function DispatchMapContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isPending, error, isError } = useDispatchDeliveriesMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<DeliveriesMapApi | null>(null);

  const deliveries = useMemo(() => data?.deliveries ?? [], [data?.deliveries]);
  const requestedDeliveryId = searchParams.get("delivery")?.trim() || null;
  const requestedLateFocus = searchParams.get("focus") === "late";
  const requestedDelivery = requestedDeliveryId
    ? deliveries.find((delivery) => delivery.id === requestedDeliveryId) ?? null
    : null;
  const requestedDeliveryAvailable = Boolean(
    requestedDelivery &&
      (!requestedLateFocus ||
        isLateDispatchDelivery({
          ...requestedDelivery,
          order: { requestedDeliveryDate: requestedDelivery.requestedDeliveryDate },
        }))
  );
  const requestedDeliveryUnavailable = Boolean(
    requestedDeliveryId && !isPending && !requestedDeliveryAvailable
  );

  useEffect(() => {
    if (!requestedDeliveryId) {
      setSelectedId(null);
      return;
    }
    setSelectedId(requestedDeliveryAvailable ? requestedDeliveryId : null);
  }, [requestedDeliveryAvailable, requestedDeliveryId]);

  const handleSelect = useCallback(
    (id: string) => {
      setSelectedId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("delivery", id);
      params.delete("focus");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const selectedDelivery = useMemo(
    () => deliveries.find((d) => d.id === selectedId) ?? null,
    [deliveries, selectedId]
  );

  if (isPending && !data && !isError) {
    return (
      <div className="flex h-full items-center justify-center bg-[#ececea]">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ececea]" data-dispatch-map-page>
      <div className="absolute inset-0">
        <DeliveriesLiveMap delivery={selectedDelivery} onMapReady={setMapApi} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1000] p-4">
        <DispatchDeliveriesMapPanel
          deliveries={deliveries}
          selectedId={selectedId}
          onSelect={handleSelect}
          focusSelectedId={requestedDeliveryAvailable ? requestedDeliveryId : null}
        />
      </div>

      {selectedDelivery && (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[1000] hidden justify-center px-4 md:flex md:pl-[min(380px,calc(100vw-16px))]">
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

      {requestedDeliveryUnavailable && (
        <div className="pointer-events-none absolute left-4 right-4 top-20 z-[1000] md:pl-[min(380px,calc(100vw-16px))]">
          <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950 shadow-lg"
          >
            {requestedLateFocus
              ? "Cette livraison n’est plus en retard ou n’est pas accessible."
              : "Cette livraison n’est plus active ou n’est pas accessible."}
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
