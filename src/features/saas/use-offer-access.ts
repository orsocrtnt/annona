"use client";

import {
  hasSaasFeature,
  hasSaasSeat,
  isOfferAccessPending,
  type OfferSaasFeature,
  type SessionSaasAccess,
} from "@/domains/saas/saas-access";
import { useAuthStore } from "@/stores/auth.store";

export function useOfferAccess(): SessionSaasAccess | null {
  return useAuthStore((state) => state.saas);
}

function useOfferAccessState() {
  const access = useOfferAccess();
  const isLoading = useAuthStore((state) => state.isLoading);
  return { access, pending: isOfferAccessPending(access, isLoading) };
}

export function useHasOfferFeature(feature: OfferSaasFeature) {
  const { access, pending } = useOfferAccessState();
  if (pending) return false;
  return hasSaasFeature(access, feature);
}

export function useHasOfferSeat(key: "drivers" | "admins" | "dispatchers") {
  const { access, pending } = useOfferAccessState();
  if (pending) return false;
  return hasSaasSeat(access, key);
}
