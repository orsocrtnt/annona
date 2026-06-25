import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";
import type { DashboardPeriodKey, PeriodDashboardStats } from "@/lib/dashboard/period-stats";

export interface DashboardDeliveryItem {
  id: string;
  reference: string;
  status: DeliveryStatus;
  deliveryCategory: DeliveryCategory;
  requestedDeliveryDate: string | null;
  scheduledAt: string | null;
  customerName: string | null;
  orderReference: string;
  driverName: string | null;
  address: string | null;
  city: string | null;
}

export type DashboardStatusListKey =
  | "pending"
  | "assigned"
  | "purchasing"
  | "inDelivery"
  | "delivered";

export interface DashboardPeriodLists {
  all: DashboardDeliveryItem[];
  standard: DashboardDeliveryItem[];
  courier: DashboardDeliveryItem[];
  late: DashboardDeliveryItem[];
  byStatus: Record<DashboardStatusListKey, DashboardDeliveryItem[]>;
}

export interface DashboardLists {
  alerts: {
    late: DashboardDeliveryItem[];
    unassigned: DashboardDeliveryItem[];
    assignedNotStarted: DashboardDeliveryItem[];
    inProgress: DashboardDeliveryItem[];
  };
  today: {
    delivered: DashboardDeliveryItem[];
    inProgress: DashboardDeliveryItem[];
    remaining: DashboardDeliveryItem[];
    late: DashboardDeliveryItem[];
  };
  periods: Record<DashboardPeriodKey, DashboardPeriodLists>;
}

export interface DashboardAlerts {
  late: number;
  unassigned: number;
  assignedNotStarted: number;
  inProgress: number;
}

export interface DashboardCategoryCounts {
  standard: number;
  courier: number;
  total: number;
}

export interface DashboardStatusBreakdown {
  pending: DashboardCategoryCounts;
  assigned: DashboardCategoryCounts;
  purchasing: DashboardCategoryCounts;
  inDelivery: DashboardCategoryCounts;
  delivered: DashboardCategoryCounts;
}

export interface DashboardPeriodStats {
  total: DashboardCategoryCounts;
  byStatus: DashboardStatusBreakdown;
  late: DashboardCategoryCounts;
}

export interface DashboardTodayStats {
  delivered: DashboardCategoryCounts;
  inProgress: DashboardCategoryCounts;
  remaining: DashboardCategoryCounts;
  late: number;
}

export interface CompanyDashboardStats {
  periods: Record<DashboardPeriodKey, DashboardPeriodStats>;
  lists: DashboardLists;
  alerts: DashboardAlerts;
  today: DashboardTodayStats;
}

export type { DashboardPeriodKey, PeriodDashboardStats };
