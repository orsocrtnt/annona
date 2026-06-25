import type { DispatchMapDelivery } from "@/domains/delivery/dispatch-map.service";
import type { RouteWaypoint } from "@/lib/maps/osrm-route";
import { formatDriverFromParts } from "@/lib/format/person-labels";

export type DeliveryMapMarkerKind = "destination" | "pickup" | "step";

export type DeliveryMapMarker = {
  id: string;
  kind: DeliveryMapMarkerKind;
  latitude: number;
  longitude: number;
  label: string;
  subtitle?: string;
  stepIndex?: number;
};

const ACTIVE_ROUTE_STATUSES = ["ASSIGNED", "PURCHASING", "IN_DELIVERY"] as const;

export function isMissionStarted(delivery: { missionStartedAt: string | null }) {
  return delivery.missionStartedAt != null;
}

/** Commande : mission démarrée, en attente que le chauffeur lance les achats. */
export function isAwaitingPurchasePhase(delivery: DispatchMapDelivery) {
  return (
    delivery.deliveryCategory === "STANDARD" &&
    isMissionStarted(delivery) &&
    delivery.status === "ASSIGNED"
  );
}

/** Points de l'itinéraire à tracer selon le type et le statut de la livraison. */
export function getDeliveryRouteWaypoints(
  delivery: DispatchMapDelivery
): RouteWaypoint[] | null {
  const driver = delivery.driverLocation;
  const dest = delivery.destination;

  if (!driver) return null;

  if (delivery.deliveryCategory === "COURIER") {
    if (!ACTIVE_ROUTE_STATUSES.includes(delivery.status as (typeof ACTIVE_ROUTE_STATUSES)[number])) {
      return null;
    }

    const waypoints: RouteWaypoint[] = [
      {
        latitude: driver.latitude,
        longitude: driver.longitude,
        label: delivery.driverName
          ? formatDriverFromParts(null, delivery.driverName)
          : "Livreur",
      },
    ];

    const pickupPoints =
      delivery.pickups.length > 0
        ? delivery.pickups
        : delivery.pickup
          ? [
              {
                latitude: delivery.pickup.latitude,
                longitude: delivery.pickup.longitude,
                label: "Collecte",
              },
            ]
          : [];

    for (const pickupPoint of pickupPoints) {
      waypoints.push({
        latitude: pickupPoint.latitude,
        longitude: pickupPoint.longitude,
        label: "label" in pickupPoint ? pickupPoint.label : "Collecte",
      });
    }

    waypoints.push({
      latitude: dest.latitude,
      longitude: dest.longitude,
      label: "Adresse de livraison",
    });
    return waypoints;
  }

  if (
    delivery.deliveryCategory === "STANDARD" &&
    ACTIVE_ROUTE_STATUSES.includes(delivery.status as (typeof ACTIVE_ROUTE_STATUSES)[number])
  ) {
    return [
      {
        latitude: driver.latitude,
        longitude: driver.longitude,
        label: delivery.driverName
          ? formatDriverFromParts(null, delivery.driverName)
          : "Livreur",
      },
      {
        latitude: dest.latitude,
        longitude: dest.longitude,
        label: "Adresse de livraison",
      },
    ];
  }

  return null;
}

export function buildDeliveryMapMarkers(
  delivery: DispatchMapDelivery
): DeliveryMapMarker[] {
  const markers: DeliveryMapMarker[] = [
    {
      id: `${delivery.id}-dest`,
      kind: "destination",
      latitude: delivery.destination.latitude,
      longitude: delivery.destination.longitude,
      label: "Livraison",
      subtitle: delivery.address,
    },
  ];

  if (delivery.pickups.length > 0) {
    for (const pickupPoint of delivery.pickups) {
      markers.push({
        id: `${delivery.id}-pickup-${pickupPoint.id}`,
        kind: "pickup",
        latitude: pickupPoint.latitude,
        longitude: pickupPoint.longitude,
        label: pickupPoint.label,
        subtitle: pickupPoint.address,
      });
    }
  } else if (delivery.pickup) {
    markers.push({
      id: `${delivery.id}-pickup`,
      kind: "pickup",
      latitude: delivery.pickup.latitude,
      longitude: delivery.pickup.longitude,
      label: "Collecte",
      subtitle: delivery.pickupAddress ?? undefined,
    });
  }

  if (
    delivery.deliveryCategory === "STANDARD" &&
    (delivery.status === "PURCHASING" || delivery.status === "IN_DELIVERY")
  ) {
    const liveDriver = showDriverOnMap(delivery) ? delivery.driverLocation : null;

    delivery.trackingSteps.forEach((step, index) => {
      if (step.latitude == null || step.longitude == null) return;

      if (
        liveDriver &&
        isNearCoordinate(
          { latitude: step.latitude, longitude: step.longitude },
          liveDriver
        )
      ) {
        return;
      }

      markers.push({
        id: step.id,
        kind: "step",
        latitude: step.latitude,
        longitude: step.longitude,
        label: step.label,
        subtitle: step.description ?? undefined,
        stepIndex: index + 1,
      });
    });
  }

  return markers;
}

export function isPurchasingPhase(delivery: DispatchMapDelivery) {
  return delivery.deliveryCategory === "STANDARD" && delivery.status === "PURCHASING";
}

export function showDriverOnMap(delivery: DispatchMapDelivery) {
  return Boolean(delivery.driverId && delivery.driverLocation);
}

function isNearCoordinate(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  epsilon = 0.0002
) {
  return (
    Math.abs(a.latitude - b.latitude) < epsilon &&
    Math.abs(a.longitude - b.longitude) < epsilon
  );
}

export function isPreMissionDriverLocation(delivery: DispatchMapDelivery) {
  return Boolean(
    delivery.driverId && delivery.driverLocation && !isMissionStarted(delivery)
  );
}

export function getDeliveryMapPhaseHint(delivery: DispatchMapDelivery): string | null {
  if (isPreMissionDriverLocation(delivery)) {
    return "Livreur assigné · itinéraire estimé vers la livraison";
  }

  if (isAwaitingPurchasePhase(delivery)) {
    return "Attente d'achat · itinéraire vers la livraison";
  }

  if (
    delivery.deliveryCategory === "COURIER" &&
    ACTIVE_ROUTE_STATUSES.includes(delivery.status as (typeof ACTIVE_ROUTE_STATUSES)[number])
  ) {
    return "Itinéraire chauffeur → collecte(s) → livraison";
  }

  if (isPurchasingPhase(delivery)) {
    return "Achats en cours";
  }

  if (delivery.status === "IN_DELIVERY") {
    return delivery.deliveryCategory === "COURIER"
      ? "Itinéraire chauffeur → A → B"
      : "Itinéraire chauffeur → livraison";
  }

  if (
    delivery.deliveryCategory === "STANDARD" &&
    delivery.status === "ASSIGNED" &&
    showDriverOnMap(delivery)
  ) {
    return "Itinéraire estimé vers la livraison";
  }

  return null;
}
