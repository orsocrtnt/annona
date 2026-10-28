"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DeliveriesMapApi } from "@/components/maps/deliveries-live-map";
import { mapGlassButtonStyle } from "@/components/maps/map-glass-styles";

const DeliveriesLiveMap = dynamic(
  () => import("@/components/maps/deliveries-live-map").then((m) => m.DeliveriesLiveMap),
  { ssr: false }
);
import { DispatchDeliveriesMapPanel } from "@/features/back-office/dispatch-deliveries-map-panel";
import { useDispatchDeliveriesMap } from "@/features/back-office/dispatch-map-hooks";
import { PageLoader } from "@/components/ui/loader";
import { isLateDispatchDelivery } from "@/features/back-office/dispatch-focus";
import {
  countDispatchMapStatuses,
  DISPATCH_MAP_STATUSES,
  getDispatchMapStatus,
  type DispatchMapStatusKey,
} from "@/features/back-office/dispatch-map-status";
import { cn } from "@/lib/utils";
import { OfferFeatureGate } from "@/features/saas/locked-offer-feature";

/** Écart maximal entre deux clics d'un double-clic (macOS : environ 500 ms). */
const DOUBLE_CLICK_MS = 500;
/**
 * Dernier clic sur une livraison. Hors du composant : la mise à jour de l'URL après le premier
 * clic peut recréer le composant, et un état local serait perdu avant le second clic.
 */
let lastDeliveryClick: { id: string; at: number } | null = null;

export default function DispatchMapPage() {
  return (
    <OfferFeatureGate feature="admin_gps">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-[#ececea]">
            <PageLoader />
          </div>
        }
      >
        <DispatchMapContent />
      </Suspense>
    </OfferFeatureGate>
  );
}

function DispatchMapContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data, isPending, error, isError } = useDispatchDeliveriesMap();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapApi, setMapApi] = useState<DeliveriesMapApi | null>(null);
  const [statusFilter, setStatusFilter] = useState<DispatchMapStatusKey | "all">("all");

  const deliveries = useMemo(() => data?.deliveries ?? [], [data?.deliveries]);
  const statusCounts = useMemo(() => countDispatchMapStatuses(deliveries), [deliveries]);
  const visibleDeliveries = useMemo(
    () =>
      statusFilter === "all"
        ? deliveries
        : deliveries.filter((delivery) => getDispatchMapStatus(delivery) === statusFilter),
    [deliveries, statusFilter]
  );
  const unlocatedCount = visibleDeliveries.filter((delivery) => !delivery.destination).length;
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

  // Double-clic : la fiche de la livraison (UX-03), qui donne aussi accès à sa commande.
  const openDetails = useCallback(
    (id: string) => {
      if (deliveries.some((d) => d.id === id)) router.push(`/dashboard/deliveries/${id}`);
    },
    [deliveries, router]
  );

  // Clic : sélectionner ; clic sur la livraison déjà sélectionnée : désélectionner.
  // Deux clics sur la même livraison à moins de DOUBLE_CLICK_MS : ouvrir le détail. Le
  // double-clic est reconnu ici et non par le navigateur, car l'épingle change entre les clics.
  const handleSelect = useCallback(
    (id: string) => {
      const now = Date.now();
      const previous = lastDeliveryClick;
      if (previous && previous.id === id && now - previous.at < DOUBLE_CLICK_MS) {
        lastDeliveryClick = null;
        openDetails(id);
        return;
      }
      lastDeliveryClick = { id, at: now };
      const deselect = id === selectedId;
      setSelectedId(deselect ? null : id);
      const params = new URLSearchParams(searchParams.toString());
      if (deselect) params.delete("delivery");
      else params.set("delivery", id);
      params.delete("focus");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [openDetails, pathname, router, searchParams, selectedId]
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
        <DeliveriesLiveMap
          delivery={selectedDelivery}
          deliveries={visibleDeliveries}
          onSelect={handleSelect}
          onMapReady={setMapApi}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-[1000] p-4">
        <DispatchDeliveriesMapPanel
          deliveries={visibleDeliveries}
          selectedId={selectedId}
          onSelect={handleSelect}
          focusSelectedId={requestedDeliveryAvailable ? requestedDeliveryId : null}
        />
      </div>

      <div
        role="toolbar"
        aria-label="Filtrer par statut"
        className="pointer-events-none absolute inset-x-0 top-4 z-[1000] hidden px-4 md:flex md:pl-[calc(min(360px,100vw-32px)+32px)]"
      >
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
            className={cn(
              "inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-[0_8px_24px_rgba(14,40,25,0.10)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
              statusFilter === "all" ? "bg-[#0e1310] text-white" : "bg-white/95 text-[#0e1310] hover:bg-white"
            )}
          >
            Toutes · {deliveries.length}
          </button>
          {DISPATCH_MAP_STATUSES.map((status) => (
            <button
              key={status.key}
              type="button"
              aria-pressed={statusFilter === status.key}
              onClick={() => setStatusFilter(statusFilter === status.key ? "all" : status.key)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-[0_8px_24px_rgba(14,40,25,0.10)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2",
                statusFilter === status.key ? status.pill : "bg-white/95 text-[#0e1310] hover:bg-white"
              )}
            >
              {status.label} · {statusCounts[status.key]}
            </button>
          ))}
          {unlocatedCount > 0 && (
            <span
              role="status"
              className="inline-flex min-h-9 items-center rounded-full bg-white/80 px-4 text-sm text-[#68726b] shadow-[0_8px_24px_rgba(14,40,25,0.08)]"
            >
              {unlocatedCount} non localisée{unlocatedCount > 1 ? "s" : ""} sur la carte
            </span>
          )}
        </div>
      </div>

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
