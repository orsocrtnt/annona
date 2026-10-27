"use client";

import Link from "next/link";
import { OrderTracking } from "@/components/shared/order-tracking";
import { OrderConversation } from "@/components/shared/order-conversation";
import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalDelivery } from "@/features/client-portal/hooks";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import { etaDayLabel, formatEta } from "@/features/client-portal/utils";
import dynamic from "next/dynamic";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import { isLegacyFakeTrackingCoord } from "@/lib/geocoding";
import { formatDriverFromParts, withoutRolePrefix } from "@/lib/format/person-labels";
import { dateTimeLabel } from "@/lib/format/relative-day";
import { ArrowLeft, Truck, Clock, Phone } from "lucide-react";
import { ProofOfDeliveryCard } from "@/features/deliveries/proof-of-delivery-card";

const DeliveryMap = dynamic(
  () => import("@/components/maps/delivery-map").then((m) => m.DeliveryMap),
  { ssr: false }
);

export default function ClientDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: delivery, isLoading, error } = usePortalDelivery(id ?? "");

  if (isInitialQueryLoading(isLoading, delivery)) return <PageSkeleton />;

  if (error || !delivery) {
    return (
      <EmptyState
        icon={Truck}
        title="Livraison introuvable"
        description="Cette livraison n'existe pas ou ne vous appartient pas."
        action={{ label: "Retour aux livraisons", onClick: () => window.location.href = "/portal/deliveries" }}
      />
    );
  }

  const category = delivery.deliveryCategory ?? delivery.order?.deliveryCategory ?? "STANDARD";
  const courierPickups = getCourierPickupStops({
    deliveryCategory: category,
    stops: delivery.order?.stops,
    pickupAddress: delivery.pickupAddress ?? delivery.order?.pickupAddress,
    pickupCity: delivery.pickupCity ?? delivery.order?.pickupCity,
    pickupPostalCode: delivery.pickupPostalCode ?? delivery.order?.pickupPostalCode,
    pickupInstructions: delivery.order?.pickupInstructions,
  });

  const mapMarkers = (delivery.trackingEvents ?? [])
    .filter(
      (e) =>
        e.latitude != null &&
        e.longitude != null &&
        !isLegacyFakeTrackingCoord(e.latitude, e.longitude)
    )
    .map((e) => ({
      id: e.id,
      label: e.label,
      latitude: e.latitude!,
      longitude: e.longitude!,
    }));

  return (
    <div className="space-y-6">
      <Link href="/portal/deliveries" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Retour aux livraisons
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{delivery.reference}</h1>
          {delivery.order && (
            <p className="mt-1 text-muted-foreground">Commande {delivery.order.reference}</p>
          )}
        </div>
        <DeliveryStatusBadge status={delivery.status} deliveryCategory={category} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itinéraire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MissionAcknowledgement {...delivery} compact />
            <DeliveryRouteDisplay
              category={category}
              pickups={courierPickups.length ? courierPickups : undefined}
              pickup={
                !courierPickups.length && delivery.pickupAddress
                  ? {
                      address: delivery.pickupAddress,
                      city: delivery.pickupCity,
                      postalCode: delivery.pickupPostalCode,
                    }
                  : null
              }
              destination={{
                address: delivery.address,
                city: delivery.city,
                postalCode: delivery.postalCode,
                instructions: delivery.order?.deliveryInstructions,
              }}
            />

            {(delivery.driver || delivery.driverName) && (
              <div className="space-y-1 border-t border-border pt-4">
                <div className="flex items-center gap-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <span>Livreur : {withoutRolePrefix(formatDriverFromParts(delivery.driver, delivery.driverName))}</span>
                </div>
                {delivery.driver?.phone ? (
                  <a
                    href={`tel:${delivery.driver.phone}`}
                    className="ml-7 flex items-center gap-1 text-sm text-brand hover:underline"
                  >
                    <Phone className="h-3 w-3" /> {delivery.driver.phone}
                  </a>
                ) : (
                  <p className="ml-7 text-sm text-muted-foreground">Téléphone non renseigné</p>
                )}
              </div>
            )}

            {delivery.estimatedArrival && (
              <div className="flex items-center gap-3 border-t border-border pt-4">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Arrivée estimée {etaDayLabel(delivery.estimatedArrival)} à {formatEta(delivery.estimatedArrival)}</span>
              </div>
            )}
            {(delivery.status === "DELIVERED" || delivery.status === "FAILED") && (
              <div className="border-t border-border pt-4">
                <ProofOfDeliveryCard
                  status={delivery.status}
                  photoUrl={delivery.podPhotoUrl}
                  failureCode={delivery.podFailureCode}
                  note={delivery.podNote}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Carte de suivi</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryMap markers={mapMarkers} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Suivi détaillé</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {delivery.trackingEvents?.map((event, i) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    {/* Étapes passées en encre, la dernière en vert : l'avancement se lit sans les dates. */}
                    <div className={`h-3 w-3 rounded-full ${i === (delivery.trackingEvents?.length ?? 0) - 1 ? "bg-primary ring-4 ring-primary/20" : "bg-[#0e1310]"}`} aria-hidden="true" />
                    {i < (delivery.trackingEvents?.length ?? 0) - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">{event.label}</p>
                    {event.description && (
                      <p className="text-xs text-muted-foreground">{event.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <time dateTime={event.occurredAt}>{dateTimeLabel(event.occurredAt)}</time>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <OrderTracking orderId={delivery.orderId} />
      <OrderConversation orderId={delivery.orderId} />
    </div>
  );
}
