"use client";

import { Suspense } from "react";
import { PageLoader } from "@/components/ui/loader";
import { DispatchUnifiedMap } from "@/features/back-office/dispatch-unified-map";
import { OfferFeatureGate } from "@/features/saas/locked-offer-feature";

export default function DispatchMapPage() {
  return (
    <OfferFeatureGate feature="admin_gps">
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-[#ececea] dark:bg-muted">
            <PageLoader />
          </div>
        }
      >
        <DispatchUnifiedMap defaultView="all" />
      </Suspense>
    </OfferFeatureGate>
  );
}
