import type {
  DeliveryCategory,
  DeliveryStatus,
  InvoiceStatus,
  OrderSource,
  OrderStatus,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import type { InvoiceLineItem } from "@/lib/validations/invoice";

export interface CompanyOrder {
  id: string;
  reference: string;
  status: OrderStatus;
  source: OrderSource;
  totalAmount: string | number;
  itemCount: number;
  createdAt: string;
  requestedDeliveryDate?: string | null;
  deliveryCategory?: DeliveryCategory;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  pickupInstructions?: string | null;
  customerEmail?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  deliveryInstructions?: string | null;
  notes?: string | null;
  missionDescription?: string | null;
  stops?: {
    id: string;
    sequence: number;
    label?: string | null;
    address: string;
    city?: string | null;
    postalCode?: string | null;
    instructions?: string | null;
  }[];
  customer?: { id: string; firstName: string; lastName: string; email: string; phone?: string | null } | null;
  items?: { id: string; name: string; quantity: number; unitPrice: string | number }[];
  deliveries?: {
    id: string;
    reference: string;
    status: DeliveryStatus;
    address?: string;
    city?: string | null;
    postalCode?: string | null;
    pickupAddress?: string | null;
    pickupCity?: string | null;
    pickupPostalCode?: string | null;
    scheduledAt?: string | null;
    estimatedArrival?: string | null;
    missionStartedAt?: string | null;
    missionAcceptedAt?: string | null;
    driverId?: string | null;
    driverName?: string | null;
    driver?: { id: string; firstName: string; lastName: string; phone?: string | null } | null;
    trackingEvents?: {
      id: string;
      label: string;
      description?: string | null;
      occurredAt: string;
    }[];
  }[];
  invoices?: {
    id: string;
    reference: string;
    status: InvoiceStatus;
    amount: string | number;
    dueDate: string | null;
    paidAt?: string | null;
    createdAt: string;
    updatedAt: string;
    lineItems?: InvoiceLineItem[];
    notes?: string | null;
  }[];
}
export interface CompanyDelivery {
  id: string;
  reference: string;
  status: DeliveryStatus;
  deliveryCategory?: DeliveryCategory;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  driverId: string | null;
  driverName: string | null;
  missionStartedAt: string | null;
  missionAcceptedAt: string | null;
  completedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  order: {
    id: string;
    reference: string;
    itemCount: number;
    totalAmount: string | number;
    deliveryCategory?: DeliveryCategory;
    pickupAddress?: string | null;
    pickupCity?: string | null;
    pickupPostalCode?: string | null;
    customerEmail: string | null;
    shippingAddress: string | null;
    shippingCity: string | null;
    shippingPostalCode: string | null;
    deliveryInstructions: string | null;
    requestedDeliveryDate: string | null;
    customer: { firstName: string; lastName: string; email: string } | null;
    items: { name: string; quantity: number }[];
  };
  driver: { id: string; firstName: string; lastName: string } | null;
}

export interface CompanyDriver {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  lastLoginAt?: string | null;
  assigned?: number;
  inTransit?: number;
  deliveredToday?: number;
  activityToday?: number;
  activeByCategory?: { STANDARD: number; COURIER: number; SPECIAL_MISSION?: number };
}

export interface DriverCategoryCounts {
  standard: number;
  courier: number;
}

export interface DriverDispatchWorkload {
  id: string;
  firstName: string;
  lastName: string;
  assigned: number;
  inTransit: number;
  today: DriverCategoryCounts;
  next7Days: DriverCategoryCounts;
}

export interface CompanyClient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { ordersAsCustomer: number; deliveriesAsCustomer: number };
  ordersToday: number;
  eventsToday: number;
}

export interface CompanyOrderStats {
  pendingOrders: number;
  activeDeliveries: number;
  deliveredToday: number;
  unassigned: number;
}

export interface DispatchOverview {
  deliveries: CompanyDelivery[];
  stats: CompanyOrderStats;
  settings: import("@/lib/validations/dispatch-settings").CompanyDispatchSettings;
  workload: DriverDispatchWorkload[];
}

export type {
  CompanyDashboardStats,
  DashboardAlerts,
  DashboardCategoryCounts,
  DashboardDeliveryItem,
  DashboardLists,
  DashboardPeriodKey,
  DashboardPeriodLists,
  DashboardPeriodStats,
  DashboardStatusBreakdown,
  DashboardStatusListKey,
  DashboardTodayStats,
} from "@/lib/dashboard/dashboard-types";
export interface CompanySupportTicket {
  id: string;
  subject: string;
  message: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  contactType: "ADMIN" | "DRIVER" | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
  relatedOrder: { id: string; reference: string } | null;
  relatedDelivery: { id: string; reference: string } | null;
  messages: Array<{
    id: string;
    body: string;
    isStaff: boolean;
    authorId: string;
    createdAt: string;
  }>;
}
