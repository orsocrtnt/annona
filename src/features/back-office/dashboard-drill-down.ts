import type {
  CompanyDashboardStats,
  DashboardDeliveryItem,
  DashboardPeriodKey,
  DashboardStatusListKey,
} from "@/lib/dashboard/dashboard-types";

export type DashboardDrillDown =
  | {
      scope: "alert";
      key: keyof CompanyDashboardStats["lists"]["alerts"];
      title: string;
      description?: string;
    }
  | {
      scope: "today";
      key: keyof CompanyDashboardStats["lists"]["today"];
      title: string;
      description?: string;
    }
  | {
      scope: "period";
      key: "all" | "standard" | "courier" | "late";
      title: string;
      description?: string;
    }
  | {
      scope: "periodStatus";
      status: DashboardStatusListKey;
      category?: "standard" | "courier";
      title: string;
      description?: string;
    };

export function filterByCategory(
  items: DashboardDeliveryItem[],
  category: "standard" | "courier"
) {
  const deliveryCategory = category === "standard" ? "STANDARD" : "COURIER";
  return items.filter((item) => item.deliveryCategory === deliveryCategory);
}

export function resolveDrillDownItems(
  dashboard: CompanyDashboardStats,
  period: DashboardPeriodKey,
  drillDown: DashboardDrillDown | null
): DashboardDeliveryItem[] {
  if (!drillDown) return [];

  if (drillDown.scope === "alert") {
    return dashboard.lists.alerts[drillDown.key];
  }

  if (drillDown.scope === "today") {
    return dashboard.lists.today[drillDown.key];
  }

  const periodLists = dashboard.lists.periods[period];

  if (drillDown.scope === "period") {
    return periodLists[drillDown.key];
  }

  const statusItems = periodLists.byStatus[drillDown.status];
  if (drillDown.category) {
    return filterByCategory(statusItems, drillDown.category);
  }
  return statusItems;
}

export const STATUS_ROWS: {
  key: DashboardStatusListKey;
  label: string;
}[] = [
  { key: "pending", label: "Sans livreur" },
  { key: "assigned", label: "Assignées" },
  { key: "purchasing", label: "Achat / Collecté" },
  { key: "inDelivery", label: "En livraison" },
  { key: "delivered", label: "Livrées" },
];

export const PERIOD_OPTIONS: { key: DashboardPeriodKey; label: string }[] = [
  { key: "3d", label: "3 jours" },
  { key: "7d", label: "7 jours" },
  { key: "30d", label: "30 jours" },
];

export const STATUS_WIDGET_MAP = {
  "stat-status-pending": "pending",
  "stat-status-assigned": "assigned",
  "stat-status-purchasing": "purchasing",
  "stat-status-in-delivery": "inDelivery",
  "stat-status-delivered": "delivered",
} as const;
