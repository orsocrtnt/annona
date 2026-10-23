"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import {
  hasSaasFeature,
  isOfferAccessPending,
  lockedOfferReason,
  SAAS_FEATURE_LABELS,
  type OfferSaasFeature,
} from "@/domains/saas/saas-access";
import { useOfferAccess } from "@/features/saas/use-offer-access";
import { useAuthStore } from "@/stores/auth.store";

export function LockedOfferFeature({ feature }: { feature: OfferSaasFeature }) {
  const access = useOfferAccess();
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <EmptyState
        icon={Lock}
        title={`${SAAS_FEATURE_LABELS[feature]} indisponible`}
        description={lockedOfferReason(feature, access?.planCode)}
      />
    </div>
  );
}

export function OfferFeatureGate({
  feature,
  children,
}: {
  feature: OfferSaasFeature;
  children: ReactNode;
}) {
  const access = useOfferAccess();
  const isLoading = useAuthStore((state) => state.isLoading);
  if (isOfferAccessPending(access, isLoading)) {
    return <PageSkeleton />;
  }
  if (!hasSaasFeature(access, feature)) {
    return <LockedOfferFeature feature={feature} />;
  }
  return children;
}
