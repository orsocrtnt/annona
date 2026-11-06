"use client";

import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui/loader";

const PortalDeliveriesMap = dynamic(
  () =>
    import("@/features/client-portal/portal-deliveries-map").then((m) => m.PortalDeliveriesMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#f0f0f0] dark:bg-muted">
        <PageLoader />
      </div>
    ),
  }
);

export default function ClientDeliveriesPage() {
  return (
    <>
      <h1 className="sr-only">Carte des livraisons</h1>
      <PortalDeliveriesMap fullscreen />
    </>
  );
}
