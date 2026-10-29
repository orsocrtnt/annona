import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import type { LiveDriverLocation } from "@/domains/driver/driver-location.service";
import { getDispatchMapStatus, getDispatchMapStatusMeta, type DispatchMapStatusKey } from "@/features/back-office/dispatch-map-status";
import { driverSignalLabel, getDriverPresenceStatus, type DriverPresenceStatus } from "@/lib/driver-presence";
import { withoutRolePrefix } from "@/lib/format/person-labels";

/** Les deux vues de la carte unifiée du tableau de bord. */
export type DashboardMapView = "drivers" | "deliveries";
export const DASHBOARD_MAP_VIEWS: { key: DashboardMapView; label: string }[] = [
  { key: "drivers", label: "Livreurs" },
  { key: "deliveries", label: "Livraisons" },
];

/** Navigation clavier d'une liste d'onglets (flèches, Début, Fin) : retourne la vue à activer, ou null. */
export function nextDashboardMapView(current: DashboardMapView, key: string): DashboardMapView | null {
  const keys = DASHBOARD_MAP_VIEWS.map((view) => view.key);
  const index = keys.indexOf(current);
  if (key === "ArrowRight" || key === "ArrowDown") return keys[(index + 1) % keys.length]!;
  if (key === "ArrowLeft" || key === "ArrowUp") return keys[(index - 1 + keys.length) % keys.length]!;
  if (key === "Home") return keys[0]!;
  if (key === "End") return keys[keys.length - 1]!;
  return null;
}

export function isLocatedDriver(driver: LiveDriverLocation): boolean {
  return driver.latitude != null && driver.longitude != null;
}

/** Position périmée : le dernier relevé dépasse la durée d'estimation (présence « perdue » ou inconnue). */
export type DriverMapState = "live" | "estimated" | "lost" | "unlocated";

export function driverMapState(driver: LiveDriverLocation, now: number): DriverMapState {
  if (!isLocatedDriver(driver)) return "unlocated";
  const presence: DriverPresenceStatus = getDriverPresenceStatus(driver.isOnline, driver.updatedAt, now);
  return presence === "online" ? "live" : presence === "recent" ? "estimated" : "lost";
}

export type DriverMapSummary = {
  id: string;
  name: string;
  state: DriverMapState;
  stateLabel: string;
  missionsLabel: string;
  /** Précision annoncée par le relevé, jamais inventée : absente quand l'appareil n'en a pas donné. */
  accuracyLabel: string | null;
  href: string;
};

export function summarizeDriver(driver: LiveDriverLocation, now: number): DriverMapSummary {
  const state = driverMapState(driver, now);
  const stateLabel =
    state === "unlocated"
      ? "Pas de position"
      : driverSignalLabel({ isOnline: driver.isOnline, estimated: driver.estimated, updatedAt: driver.updatedAt }, now);
  const missions = driver.activeMissions;
  return {
    id: driver.id,
    name: withoutRolePrefix(driver.name),
    state,
    stateLabel,
    missionsLabel: missions === 0 ? "Aucune mission active" : `${missions} mission${missions > 1 ? "s" : ""} active${missions > 1 ? "s" : ""}`,
    accuracyLabel: driver.accuracy != null && Number.isFinite(driver.accuracy) && state === "live" ? `Précision relevée : environ ${Math.round(driver.accuracy)} m` : null,
    href: `/dashboard/drivers/${driver.id}`,
  };
}

export type DeliveryMapSummary = {
  id: string;
  reference: string;
  status: DispatchMapStatusKey;
  statusLabel: string;
  stageLabel: string;
  customer: string | null;
  driver: string;
  address: string;
  pickupAddress: string | null;
  positionLabel: string | null;
  hasDestination: boolean;
  href: string;
};

export function summarizeDelivery(delivery: DispatchMapDelivery, now = new Date()): DeliveryMapSummary {
  const status = getDispatchMapStatus(delivery, now);
  return {
    id: delivery.id,
    reference: delivery.reference,
    status,
    statusLabel: getDispatchMapStatusMeta(status).label,
    stageLabel: delivery.statusLabel,
    customer: delivery.customerName,
    driver: delivery.driverName ? withoutRolePrefix(delivery.driverName) : "Sans livreur",
    address: delivery.address,
    pickupAddress: delivery.pickupAddress,
    positionLabel: delivery.driverLocation ? driverSignalLabel(delivery.driverLocation, now.getTime()) : null,
    hasDestination: delivery.destination != null,
    href: `/dashboard/deliveries/${delivery.id}`,
  };
}

/** Livraisons à afficher : seules celles qui ont une destination géolocalisée figurent sur la carte. */
export function locatedDeliveries(deliveries: DispatchMapDelivery[]): DispatchMapDelivery[] {
  return deliveries.filter((delivery) => delivery.destination != null);
}

export type DashboardMapEmptyKind = "none" | "no-driver" | "no-position" | "no-mission" | "no-destination";

/** Raison explicite d'une carte sans repère (jamais un fond muet). */
export function dashboardMapEmptyKind(
  view: DashboardMapView,
  drivers: LiveDriverLocation[],
  deliveries: DispatchMapDelivery[]
): DashboardMapEmptyKind {
  if (view === "drivers") {
    if (drivers.length === 0) return "no-driver";
    return drivers.some(isLocatedDriver) ? "none" : "no-position";
  }
  if (deliveries.length === 0) return "no-mission";
  return locatedDeliveries(deliveries).length === 0 ? "no-destination" : "none";
}

export const DASHBOARD_MAP_EMPTY_MESSAGES: Record<Exclude<DashboardMapEmptyKind, "none">, string> = {
  "no-driver": "Aucun livreur à afficher pour le moment.",
  "no-position": "Aucun livreur n'a de position : elle apparaît dès que le service est démarré.",
  "no-mission": "Aucune mission active à afficher.",
  "no-destination": "Les missions actives n'ont pas encore d'adresse localisée sur la carte.",
};
