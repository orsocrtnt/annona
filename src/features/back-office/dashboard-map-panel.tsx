"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, Radio, X } from "lucide-react";
import { PageLoader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { useMapTheme } from "@/hooks/use-map-theme";
import { useNow } from "@/hooks/use-now";
import { useDispatchDeliveriesMap, useDriverLiveLocations } from "@/features/back-office/dispatch-map-hooks";
import { DISPATCH_MAP_STATUSES, countDispatchMapStatuses } from "@/features/back-office/dispatch-map-status";
import {
  DASHBOARD_MAP_EMPTY_MESSAGES,
  DASHBOARD_MAP_VIEWS,
  dashboardMapEmptyKind,
  isLocatedDriver,
  locatedDeliveries,
  nextDashboardMapView,
  shouldDropSelection,
  summarizeDelivery,
  summarizeDriver,
  type DashboardMapView,
} from "@/features/back-office/dashboard-map-model";
import { MAP_PIN_BODY, MAP_SHAPE_LABEL, MAP_STATUS_STYLE, statusCoreSvg } from "@/lib/maps/map-status-style";
import { TEAMS_PRESENCE } from "@/lib/driver-presence";
import { cn } from "@/lib/utils";

const DashboardMap = dynamic(() => import("@/components/maps/dashboard-map").then((m) => m.DashboardMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-border bg-muted/20">
      <PageLoader />
    </div>
  ),
});

/** Les positions avancent seules : le libellé « Il y a 3 min » est recalculé sans nouvelle requête. */
const CLOCK_TICK_MS = 30_000;

function StatusGlyph({ status, theme }: { status: keyof typeof MAP_STATUS_STYLE.light; theme: "light" | "dark" }) {
  const style = MAP_STATUS_STYLE[theme][status];
  // Même forme et même couleur que le cœur de l'épingle sur la carte.
  return (
    <svg width="18" height="18" viewBox="5 5 16 16" aria-hidden="true" className="shrink-0 rounded-full" style={{ background: MAP_PIN_BODY[theme] }} dangerouslySetInnerHTML={{ __html: statusCoreSvg(style.shape, style.core) }} />
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  );
}

export function DashboardMapPanel({ height = 280, initialView = "drivers", showDrivers = true }: { height?: number; initialView?: DashboardMapView; showDrivers?: boolean }) {
  const [view, setView] = useState<DashboardMapView>(showDrivers ? initialView : "deliveries");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drivers = useDriverLiveLocations(showDrivers, view === "drivers");
  const deliveries = useDispatchDeliveriesMap(view === "deliveries");
  const theme = useMapTheme();
  const now = useNow(CLOCK_TICK_MS);
  const tabsId = useId();
  const tabRefs = useRef<Record<DashboardMapView, HTMLButtonElement | null>>({ drivers: null, deliveries: null });

  const driverList = useMemo(() => drivers.data ?? [], [drivers.data]);
  const deliveryList = useMemo(() => deliveries.data?.deliveries ?? [], [deliveries.data?.deliveries]);
  const statusCounts = useMemo(() => countDispatchMapStatuses(deliveryList, new Date(now)), [deliveryList, now]);

  const query = view === "drivers" ? drivers : deliveries;
  const hasError = query.isError;
  const emptyKind = hasError && !query.data ? "none" : dashboardMapEmptyKind(view, driverList, deliveryList);
  const views = showDrivers ? DASHBOARD_MAP_VIEWS : DASHBOARD_MAP_VIEWS.filter((v) => v.key === "deliveries");

  // Une sélection qui n'existe plus (mission terminée, livreur déconnecté) est abandonnée, pas affichée vide.
  const selectedDriver = view === "drivers" ? driverList.find((d) => d.id === selectedId) : undefined;
  const selectedDelivery = view === "deliveries" ? deliveryList.find((d) => d.id === selectedId) : undefined;
  useEffect(() => {
    if (shouldDropSelection(selectedId, Boolean(selectedDriver || selectedDelivery), Boolean(drivers.data || deliveries.data))) setSelectedId(null);
  }, [selectedId, selectedDriver, selectedDelivery, drivers.data, deliveries.data]);

  const openerRef = useRef<HTMLElement | null>(null);
  const select = useCallback((id: string) => {
    // Mémorise l'élément qui ouvre la fiche (marqueur ou ligne de liste) pour lui rendre le focus.
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSelectedId(id);
  }, []);
  const closeDetail = useCallback(() => {
    setSelectedId(null);
    const opener = openerRef.current;
    openerRef.current = null;
    window.requestAnimationFrame(() => {
      if (opener && opener.isConnected && !opener.hasAttribute("disabled")) opener.focus();
      else tabRefs.current[viewRef.current]?.focus();
    });
  }, []);
  const viewRef = useRef(view);
  viewRef.current = view;
  const changeView = useCallback((next: DashboardMapView) => {
    setView(next);
    setSelectedId(null);
    // La vue qui devient active repart d'un relevé frais (l'autre ne se rafraîchissait plus).
    void (next === "drivers" ? drivers : deliveries).refetch?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch stable ; évite de recréer le gestionnaire à chaque relevé
  }, []);

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next = nextDashboardMapView(view, event.key);
    if (!next || !views.some((v) => v.key === next)) return;
    event.preventDefault();
    changeView(next);
    tabRefs.current[next]?.focus();
  };

  const loading = query.isPending;
  const errorMessage = query.isError ? (query.error instanceof Error ? query.error.message : "Erreur de chargement") : null;
  const onlineCount = driverList.filter((d) => d.isOnline).length;
  const locatedCount = driverList.filter(isLocatedDriver).length;
  const geoCount = locatedDeliveries(deliveryList).length;
  const driverSummary = selectedDriver ? summarizeDriver(selectedDriver, now) : null;
  const deliverySummary = selectedDelivery ? summarizeDelivery(selectedDelivery, new Date(now)) : null;
  const panelTitleId = `${tabsId}-detail`;

  return (
    <section
      aria-label="Carte en direct"
      className="space-y-3"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedId && !event.defaultPrevented) closeDetail();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Contenu de la carte" className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
          {views.map((tab) => {
            const active = tab.key === view;
            const count = tab.key === "drivers" ? driverList.length : deliveryList.length;
            return (
              <button
                key={tab.key}
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                id={`${tabsId}-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={`${tabsId}-panel`}
                tabIndex={active ? 0 : -1}
                onClick={() => changeView(tab.key)}
                onKeyDown={onTabKeyDown}
                className={cn(
                  "min-h-11 min-w-[7.5rem] rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-card text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{loading && !active ? "" : count}</span>
              </button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" className="min-h-11" asChild>
          <Link href={view === "drivers" ? "/dispatch/drivers" : "/dispatch/map"}>
            {view === "drivers" ? <MapPin className="mr-2 h-4 w-4" aria-hidden /> : <Radio className="mr-2 h-4 w-4" aria-hidden />}
            {view === "drivers" ? "Carte complète" : "Dispatch"}
          </Link>
        </Button>
      </div>

      {errorMessage && <ErrorBanner message={errorMessage} onRetry={() => void query.refetch()} />}

      <div id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${view}`} className="relative overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex items-center justify-center bg-muted/20" style={{ height }} role="status" aria-label="Chargement de la carte">
            <PageLoader />
          </div>
        ) : (
          <DashboardMap view={view} drivers={driverList} deliveries={deliveryList} selectedId={selectedId} onSelect={select} height={height} />
        )}
        {!loading && emptyKind !== "none" && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center px-3">
            <p role="status" className="rounded-full border border-border bg-card/95 px-4 py-2 text-center text-sm text-foreground shadow-md">
              {DASHBOARD_MAP_EMPTY_MESSAGES[emptyKind]}
            </p>
          </div>
        )}

        {(driverSummary || deliverySummary) && (
          <div
            role="region"
            aria-labelledby={panelTitleId}
            className="relative z-[1100] border-t border-border bg-card p-3 text-sm md:absolute md:bottom-3 md:left-3 md:w-80 md:rounded-xl md:border md:shadow-lg"
          >
            <div className="flex items-start justify-between gap-2">
              <p id={panelTitleId} className="font-semibold text-foreground">
                {driverSummary ? driverSummary.name : deliverySummary!.reference}
              </p>
              <button
                type="button"
                aria-label="Fermer la fiche"
                onClick={closeDetail}
                className="-m-2 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            {driverSummary && (
              <div className="mt-1 space-y-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: driverSummary.state === "unlocated" ? "var(--color-text-tertiary)" : driverSummary.state === "live" ? TEAMS_PRESENCE.online : driverSummary.state === "estimated" ? TEAMS_PRESENCE.recent : TEAMS_PRESENCE.lost }} />
                  <span className="sr-only">Signal</span>
                  <p className="font-medium text-foreground">{driverSummary.stateLabel}</p>
                </div>
                {driverSummary.state === "lost" && <p>Position périmée : dernier relevé connu.</p>}
                <p>{driverSummary.missionsLabel}</p>
                {driverSummary.accuracyLabel && <p>{driverSummary.accuracyLabel}</p>}
              </div>
            )}
            {deliverySummary && (
              <div className="mt-1 space-y-1 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <StatusGlyph status={deliverySummary.status} theme={theme} />
                  <span className="sr-only">Statut</span>
                  <p className="font-medium text-foreground">
                    {deliverySummary.statusLabel} · {deliverySummary.stageLabel}
                  </p>
                </div>
                {deliverySummary.customer && <p>Client : {deliverySummary.customer}</p>}
                <p>Livreur : {deliverySummary.driver}</p>
                <p>Destination : {deliverySummary.address}</p>
                {deliverySummary.pickupAddress && <p>Collecte : {deliverySummary.pickupAddress}</p>}
                {deliverySummary.positionLabel && <p>Position du livreur : {deliverySummary.positionLabel}</p>}
              </div>
            )}
            <Button size="sm" className="mt-3 min-h-11 w-full" asChild>
              <Link href={driverSummary ? driverSummary.href : deliverySummary!.href}>{driverSummary ? "Voir la fiche du livreur" : "Voir la livraison"}</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Légende de la carte" role="group">
        {view === "deliveries"
          ? DISPATCH_MAP_STATUSES.map((status) => (
              <span key={status.key} className="inline-flex items-center gap-1.5">
                <StatusGlyph status={status.key} theme={theme} />
                {status.label} ({MAP_SHAPE_LABEL[MAP_STATUS_STYLE[theme][status.key].shape]}) · {statusCounts[status.key]}
              </span>
            ))
          : (
            <>
              {[
                ["En direct", TEAMS_PRESENCE.online],
                ["Position estimée", TEAMS_PRESENCE.recent],
                ["Signal perdu", TEAMS_PRESENCE.lost],
              ].map(([label, color]) => (
                <span key={label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  {label}
                </span>
              ))}
              <span>{onlineCount} connecté{onlineCount > 1 ? "s" : ""} · {locatedCount} localisé{locatedCount > 1 ? "s" : ""}</span>
            </>
          )}
        {view === "deliveries" && <span>{geoCount} sur {deliveryList.length} localisée{geoCount > 1 ? "s" : ""}</span>}
      </div>

      {!loading && (view === "drivers" ? driverList.length > 0 : deliveryList.length > 0) && (
        <details className="rounded-lg border border-border bg-card text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Liste {view === "drivers" ? "des livreurs" : "des livraisons"} ({view === "drivers" ? driverList.length : deliveryList.length})
          </summary>
          <ul className="max-h-64 divide-y divide-border overflow-auto">
            {view === "drivers"
              ? driverList.map((driver) => {
                  const summary = summarizeDriver(driver, now);
                  return (
                    <li key={driver.id}>
                      <button type="button" aria-pressed={selectedId === driver.id} disabled={summary.state === "unlocated"} onClick={() => select(driver.id)} className={cn("flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60", selectedId === driver.id && "bg-accent")}>
                        <span className="font-medium">{summary.name}</span>
                        <span className="text-xs text-muted-foreground">{summary.stateLabel}</span>
                      </button>
                    </li>
                  );
                })
              : deliveryList.map((delivery) => {
                  const summary = summarizeDelivery(delivery, new Date(now));
                  return (
                    <li key={delivery.id}>
                      <button type="button" aria-pressed={selectedId === delivery.id} disabled={!summary.hasDestination} onClick={() => select(delivery.id)} className={cn("flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:opacity-60", selectedId === delivery.id && "bg-accent")}>
                        <span className="flex items-center gap-2 font-medium">
                          <StatusGlyph status={summary.status} theme={theme} />
                          {summary.reference}
                        </span>
                        <span className="text-xs text-muted-foreground">{summary.hasDestination ? summary.statusLabel : "Adresse non localisée"}</span>
                      </button>
                    </li>
                  );
                })}
          </ul>
        </details>
      )}
    </section>
  );
}
