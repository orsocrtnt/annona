"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { DeliveriesMapApi } from "@/components/maps/deliveries-live-map";
import { mapGlassButtonStyle, mapGlassCardStyle } from "@/components/maps/map-glass-styles";
import { DispatchDeliveriesMapPanel } from "@/features/back-office/dispatch-deliveries-map-panel";
import { useDispatchDeliveriesMap, useDriverLiveLocations } from "@/features/back-office/dispatch-map-hooks";
import { PageLoader } from "@/components/ui/loader";
import { isLateDispatchDelivery } from "@/features/back-office/dispatch-focus";
import {
  countDispatchMapStatuses,
  DISPATCH_MAP_STATUSES,
  getDispatchMapStatus,
  type DispatchMapStatusKey,
} from "@/features/back-office/dispatch-map-status";
import {
  DASHBOARD_MAP_VIEWS,
  allowedMapViews,
  mapViewShows,
  resolveMapView,
  summarizeDriver,
  type DashboardMapView,
} from "@/features/back-office/dashboard-map-model";
import { usePermissions } from "@/hooks/use-permissions";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/utils";

const DeliveriesLiveMap = dynamic(
  () => import("@/components/maps/deliveries-live-map").then((m) => m.DeliveriesLiveMap),
  { ssr: false }
);

/** Écart maximal entre deux clics d'un double-clic (macOS : environ 500 ms). */
const DOUBLE_CLICK_MS = 500;
/**
 * Dernier clic sur une livraison. Hors du composant : la mise à jour de l'URL après le premier
 * clic peut recréer le composant, et un état local serait perdu avant le second clic.
 */
let lastDeliveryClick: { id: string; at: number } | null = null;

const PANEL_COLLAPSED_KEY = "tutelliv-dispatch-map-panel-collapsed";

const PILL =
  "inline-flex min-h-9 max-md:min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium shadow-[0_8px_24px_rgba(14,40,25,0.10)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 dark:focus-visible:ring-ring";
const PILL_ACTIVE = "bg-[#0e1310] text-white dark:bg-foreground dark:text-background";
const PILL_IDLE = "bg-white/95 text-[#0e1310] hover:bg-white dark:bg-card/95 dark:text-foreground dark:hover:bg-card";

/** Bascule de la carte unique : Tout, Livreurs ou Livraisons (MAP-UNIFY-2). */
function MapViewToggle({ views, view, onChange, className }: { views: DashboardMapView[]; view: DashboardMapView; onChange: (view: DashboardMapView) => void; className?: string }) {
  if (views.length < 2) return null;
  return (
    <div role="group" aria-label="Afficher sur la carte" className={cn("pointer-events-auto flex gap-1 rounded-full bg-white/95 p-1 shadow-[0_8px_24px_rgba(14,40,25,0.10)] dark:bg-card/95", className)}>
      {DASHBOARD_MAP_VIEWS.filter((v) => views.includes(v.key)).map((v) => (
        <button
          key={v.key}
          type="button"
          aria-pressed={view === v.key}
          onClick={() => onChange(v.key)}
          className={cn(PILL, "shadow-none", view === v.key ? PILL_ACTIVE : "text-[#0e1310] hover:bg-black/5 dark:text-foreground dark:hover:bg-muted")}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

/**
 * La carte unique du Dispatch : livreurs et livraisons ensemble, ou l'un des deux seul.
 * `/dispatch/map` ouvre « Tout » ; `/dispatch/drivers` (ancienne carte livreurs) ouvre « Livreurs ».
 */
export function DispatchUnifiedMap({ defaultView }: { defaultView: DashboardMapView }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const canSeeDrivers = can("drivers:read");
  const allowedViews = useMemo(() => allowedMapViews(canSeeDrivers, true), [canSeeDrivers]);
  const view = resolveMapView(searchParams.get("view") ?? defaultView, allowedViews) ?? "deliveries";
  const shows = mapViewShows(view);
  const { data, isPending, error, isError } = useDispatchDeliveriesMap(shows.deliveries);
  const drivers = useDriverLiveLocations(canSeeDrivers, shows.drivers);
  const driverList = useMemo(() => drivers.data ?? [], [drivers.data]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // Le choix replié / déplié est gardé d'une visite à l'autre.
  useEffect(() => {
    setPanelCollapsed(window.localStorage.getItem(PANEL_COLLAPSED_KEY) === "1");
  }, []);
  const changePanelCollapsed = useCallback((next: boolean) => {
    setPanelCollapsed(next);
    window.localStorage.setItem(PANEL_COLLAPSED_KEY, next ? "1" : "0");
  }, []);
  // Décalage des éléments posés à droite de la liste (ordinateur) : liste ouverte ou pastille.
  const panelOffset = !shows.deliveries ? "" : panelCollapsed ? "md:pl-[calc(14rem+32px)]" : "md:pl-[calc(min(360px,100vw-32px)+32px)]";
  const now = useNow(30_000);
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
  const requestedDeliveryId = shows.deliveries ? searchParams.get("delivery")?.trim() || null : null;
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
      setSelectedDriverId(null);
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
    () => (shows.deliveries ? deliveries.find((d) => d.id === selectedId) ?? null : null),
    [deliveries, selectedId, shows.deliveries]
  );
  const selectedDriver = shows.drivers ? driverList.find((d) => d.id === selectedDriverId) ?? null : null;
  const driverSummary = selectedDriver ? summarizeDriver(selectedDriver, now) : null;
  const onlineCount = driverList.filter((d) => d.isOnline).length;
  const locatedCount = driverList.filter((d) => d.latitude != null && d.longitude != null).length;

  // Clic sur un livreur : sa fiche courte ; nouveau clic : la referme. Les livreurs ne sont cliquables
  // que dans la vue d'ensemble, donc sans livraison sélectionnée.
  const handleSelectDriver = useCallback((id: string) => {
    setSelectedDriverId((current) => (current === id ? null : id));
  }, []);

  const changeView = useCallback(
    (next: DashboardMapView) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", next);
      if (!mapViewShows(next).deliveries) {
        params.delete("delivery");
        params.delete("focus");
      }
      setSelectedDriverId(null);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const errorMessage =
    (shows.deliveries && isError ? (error instanceof Error ? error.message : "Erreur de chargement") : null) ??
    (shows.drivers && drivers.isError ? (drivers.error instanceof Error ? drivers.error.message : "Erreur de chargement") : null);

  const waitingDeliveries = shows.deliveries && isPending && !data && !isError;
  const waitingDrivers = !shows.deliveries && drivers.isPending && !drivers.isError && drivers.fetchStatus !== "idle";
  if (waitingDeliveries || waitingDrivers) {
    return (
      <div className="flex h-full items-center justify-center bg-[#ececea] dark:bg-muted">
        <PageLoader />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#ececea] dark:bg-muted" data-dispatch-map-page>
      <h1 className="sr-only">Carte</h1>
      <div className="absolute inset-0">
        <DeliveriesLiveMap
          delivery={selectedDelivery}
          deliveries={shows.deliveries ? visibleDeliveries : []}
          onSelect={handleSelect}
          onMapReady={setMapApi}
          liveDrivers={shows.drivers ? driverList : []}
          selectedDriverId={selectedDriver?.id ?? null}
          onSelectDriver={handleSelectDriver}
        />
      </div>

      {shows.deliveries && (
        <div className="pointer-events-none absolute inset-0 z-[1000] p-4">
          <DispatchDeliveriesMapPanel
            deliveries={visibleDeliveries}
            selectedId={selectedId}
            onSelect={handleSelect}
            focusSelectedId={requestedDeliveryAvailable ? requestedDeliveryId : null}
            collapsed={panelCollapsed}
            onCollapsedChange={changePanelCollapsed}
          />
        </div>
      )}

      {/* Téléphone : la bascule en bas, la liste des livraisons occupe le haut. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-[1000] flex justify-start pl-3 pr-16 md:hidden">
        <MapViewToggle views={allowedViews} view={view} onChange={changeView} />
      </div>

      <div
        role="toolbar"
        aria-label="Contenu de la carte"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-4 z-[1000] hidden px-4 md:flex",
          panelOffset
        )}
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <MapViewToggle views={allowedViews} view={view} onChange={changeView} />
          {shows.deliveries && (
            <>
              <button
                type="button"
                aria-pressed={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                className={cn(PILL, statusFilter === "all" ? PILL_ACTIVE : PILL_IDLE)}
              >
                Toutes · {deliveries.length}
              </button>
              {DISPATCH_MAP_STATUSES.map((status) => (
                <button
                  key={status.key}
                  type="button"
                  aria-pressed={statusFilter === status.key}
                  onClick={() => setStatusFilter(statusFilter === status.key ? "all" : status.key)}
                  className={cn(PILL, statusFilter === status.key ? status.pill : PILL_IDLE)}
                >
                  {status.label} · {statusCounts[status.key]}
                </button>
              ))}
              {unlocatedCount > 0 && (
                <span
                  role="status"
                  className="inline-flex min-h-9 items-center rounded-full bg-white/80 px-4 text-sm text-[#68726b] dark:bg-card/80 dark:text-muted-foreground shadow-[0_8px_24px_rgba(14,40,25,0.08)]"
                >
                  {unlocatedCount} non localisée{unlocatedCount > 1 ? "s" : ""} sur la carte
                </span>
              )}
            </>
          )}
          {shows.drivers && (
            <span className="inline-flex min-h-9 items-center rounded-full bg-white/95 px-4 text-sm shadow-[0_8px_24px_rgba(14,40,25,0.08)] dark:bg-card/95">
              <span className="font-semibold text-foreground">{onlineCount}</span>
              <span className="ml-1 text-muted-foreground">{onlineCount > 1 ? "livreurs connectés" : "livreur connecté"}</span>
              <span className="mx-2 text-muted-foreground" aria-hidden="true">·</span>
              <span className="font-semibold text-foreground">{locatedCount}</span>
              <span className="ml-1 text-muted-foreground">{locatedCount > 1 ? "localisés" : "localisé"}</span>
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className={cn("pointer-events-none absolute left-0 right-4 top-20 z-[1000] pl-4", panelOffset)}>
          <div className="rounded-2xl bg-red-500 px-4 py-2.5 text-center text-sm text-white shadow-lg">{errorMessage}</div>
        </div>
      )}

      {requestedDeliveryUnavailable && (
        <div className={cn("pointer-events-none absolute left-0 right-4 top-20 z-[1000] pl-4", panelOffset)}>
          <div
            role="alert"
            className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-950 dark:border-warning/40 dark:bg-warning-subtle dark:text-foreground shadow-lg"
          >
            {requestedLateFocus
              ? "Cette livraison n’est plus en retard ou n’est pas accessible."
              : "Cette livraison n’est plus active ou n’est pas accessible."}
          </div>
        </div>
      )}

      {driverSummary && (
        <div
          role="region"
          aria-label={`Livreur ${driverSummary.name}`}
          className="pointer-events-auto absolute bottom-20 left-3 right-3 z-[1100] rounded-2xl p-4 text-sm md:bottom-5 md:left-auto md:right-20 md:w-80"
          style={mapGlassCardStyle}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground">{driverSummary.name}</p>
            <button
              type="button"
              aria-label="Fermer la fiche"
              onClick={() => setSelectedDriverId(null)}
              className="-m-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-1 space-y-1 text-muted-foreground">
            <p className="font-medium text-foreground">{driverSummary.stateLabel}</p>
            {driverSummary.state === "lost" && <p>Position périmée : dernier relevé connu.</p>}
            <p>{driverSummary.missionsLabel}</p>
            {driverSummary.accuracyLabel && <p>{driverSummary.accuracyLabel}</p>}
          </div>
          <Link
            href={driverSummary.href}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#0e1310] px-4 text-sm font-medium text-white outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring dark:bg-foreground dark:text-background"
          >
            Voir la fiche du livreur
          </Link>
        </div>
      )}

      <div className="absolute bottom-5 right-5 z-[1100] flex flex-col gap-2 max-md:bottom-4 max-md:right-3">
        <button
          type="button"
          aria-label="Zoomer"
          className="shrink-0 rounded-xl outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-black dark:hover:bg-muted dark:focus-visible:ring-ring focus-visible:ring-offset-2"
          style={mapGlassButtonStyle}
          onClick={() => mapApi?.zoomIn()}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Dézoomer"
          className="shrink-0 rounded-xl outline-none transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-black dark:hover:bg-muted dark:focus-visible:ring-ring focus-visible:ring-offset-2"
          style={mapGlassButtonStyle}
          onClick={() => mapApi?.zoomOut()}
        >
          −
        </button>
      </div>
    </div>
  );
}
