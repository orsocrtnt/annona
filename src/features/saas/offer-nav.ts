import {
  hasSaasFeature,
  lockedOfferReason,
  OFFER_FEATURE_HREFS,
  type SessionSaasAccess,
} from "@/domains/saas/saas-access";

export function applyOfferNavLocks<
  T extends { href: string; disabled?: boolean; disabledReason?: string },
>(items: T[], access: SessionSaasAccess | null | undefined): T[] {
  return items.map((item) => {
    const feature = OFFER_FEATURE_HREFS[item.href];
    if (!feature || hasSaasFeature(access, feature)) return item;
    return {
      ...item,
      disabled: true,
      disabledReason: lockedOfferReason(feature, access?.planCode),
    };
  });
}
