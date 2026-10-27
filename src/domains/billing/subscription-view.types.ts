export type SubscriptionView = {
  formula: { code: string; name: string };
  billingInterval: "MONTHLY" | "ANNUAL";
  period: { startsAt: string; endsAt: string | null };
  premiumDiscovery: {
    endsAt: string;
    features: Array<{ code: string; name: string }>;
  } | null;
  options: Array<{ code: string; name: string; quantity: number; unitPriceCents: number }>;
  usage: {
    usedOrders: number;
    includedOrders: number;
    overageOrders: number;
  } | null;
  status: string;
  alerts: Array<{ code: string; label: string }>;
  history: Array<{ type: "operation" | "invoice"; label: string; status: string; occurredAt: string; amountCents?: number }>;
};
