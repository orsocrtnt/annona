import type { CompanyOnboardingStatus } from "@/domains/onboarding/onboarding.service";

export const ONBOARDING_QUERY_KEY = ["company", "onboarding"] as const;

export async function fetchOnboardingStatus(): Promise<CompanyOnboardingStatus> {
  const response = await fetch("/api/onboarding");
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error ?? "Impossible de charger l’onboarding");
  return payload.data as CompanyOnboardingStatus;
}
