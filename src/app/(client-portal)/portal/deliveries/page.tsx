"use client";

import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/loader";
import { OfferFeatureGate } from "@/features/saas/locked-offer-feature";

const PortalDeliveriesMap = dynamic(
  () =>
    import("@/features/client-portal/portal-deliveries-map").then((m) => m.PortalDeliveriesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <PageLoader />
      </div>
    ),
  }
);

export default function ClientDeliveriesPage() {
  return (
    <OfferFeatureGate feature="client_gps">
      <h1 className="sr-only">Carte des livraisons</h1>
      <PortalDeliveriesMap fullscreen />
    </OfferFeatureGate>
  );
}
