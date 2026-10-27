const PLANS = ["STARTER", "PRO", "BUSINESS"] as const;
const INTERVALS = ["MONTHLY", "ANNUAL"] as const;

export function signupEntryFromSearch(search: string): { planCode: (typeof PLANS)[number]; billingInterval: (typeof INTERVALS)[number] } | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const plan = params.get("plan");
  const interval = params.get("interval");
  if (!PLANS.includes(plan as (typeof PLANS)[number])) return null;
  return {
    planCode: plan as (typeof PLANS)[number],
    billingInterval: INTERVALS.includes(interval as (typeof INTERVALS)[number])
      ? interval as (typeof INTERVALS)[number]
      : "MONTHLY",
  };
}
