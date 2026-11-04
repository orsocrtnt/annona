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
import { ClientDeliveryArrival } from "@/features/client-portal/client-delivery-arrival";
import dynamic from "next/dynamic";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import { isLegacyFakeTrackingCoord } from "@/lib/geocoding";
import { formatLateness } from "@/lib/format/lateness";
import { dateTimeLabel } from "@/lib/format/relative-day";
import { ArrowLeft, Truck } from "lucide-react";
import { ClientDriverInfo } from "@/features/client-portal/client-driver-info";
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
          {delivery.timing?.dueAt && (
            <p className="mt-1 text-sm" data-delivery-due="true">
              <span className="text-muted-foreground">À livrer avant le</span>{" "}
              <time dateTime={delivery.timing.dueAt} className="font-medium">{dateTimeLabel(delivery.timing.dueAt)}</time>
              {delivery.timing.late && delivery.timing.lateByMinutes !== null && (
                <span className="font-medium text-destructive"> · en retard de {formatLateness(delivery.timing.lateByMinutes)}</span>
              )}
            </p>
          )}
          {delivery.order && (
            <p className="mt-1 text-xs text-muted-foreground">Commande {delivery.order.reference}</p>
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

            {delivery.driver && (
              <div className="border-t border-border pt-4">
                <ClientDriverInfo driver={delivery.driver} />
              </div>
            )}

            <ClientDeliveryArrival deliveryId={delivery.id} status={delivery.status} estimatedArrival={delivery.estimatedArrival} />
            {(delivery.status === "DELIVERED" || delivery.status === "FAILED") && (
              <div className="border-t border-border pt-4">
                <ProofOfDeliveryCard
                  status={delivery.status}
                  photoUrl={delivery.podPhotoUrl}
                  failureCode={delivery.podFailureCode}
                  note={delivery.podNote}
                  signatureUrl={delivery.podSignatureUrl}
                  pdfUrl={delivery.podPdfUrl}
                  recipientName={delivery.podRecipientName}
                  signatureRefusedReason={delivery.podSignatureRefusedReason}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Carte seulement si des positions existent : « aucune position enregistrée » contredisait le suivi partagé. */}
        {mapMarkers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Carte de suivi</CardTitle>
            </CardHeader>
            <CardContent>
              <DeliveryMap markers={mapMarkers} />
            </CardContent>
          </Card>
        )}

      </div>
      {/* La chronologie des actions est dans le suivi partagé : elle n'est plus affichée deux fois. */}
      <OrderTracking orderId={delivery.orderId} />
      <OrderConversation orderId={delivery.orderId} />
    </div>
  );
}
