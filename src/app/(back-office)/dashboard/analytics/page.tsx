import { CompanyAnalyticsContent } from "@/features/back-office/company-analytics-content";
import { OfferFeatureGate } from "@/features/saas/locked-offer-feature";

export default function CompanyAnalyticsPage() {
  return (
    <OfferFeatureGate feature="advanced_analytics">
      <CompanyAnalyticsContent />
    </OfferFeatureGate>
  );
}
