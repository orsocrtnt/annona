import type { UpdateOrderStatusInput } from "@/lib/validations/order";
import type { CreateOrderInvoiceInput } from "@/lib/validations/invoice";
import type { AdminUpdateDeliveryInput } from "@/lib/validations/delivery";
import type { CompanyDashboardStats } from "@/lib/dashboard/dashboard-types";
import type { CompanyAnalytics } from "@/domains/analytics/analytics.service";
import type {
  CompanyClient,
  CompanyDelivery,
  CompanyDriver,
  CompanyOrder,
  CompanyOrderStats,
  DispatchOverview,
  DriverDispatchWorkload,
} from "./types";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

export const backOfficeApi = {
  getDashboard: () =>
    fetchJson<CompanyDashboardStats>("/api/back-office/dashboard"),
  getAnalytics: (days: 7 | 30 = 30) =>
    fetchJson<CompanyAnalytics>(`/api/back-office/analytics?days=${days}`),
  getOrders: () => fetchJson<CompanyOrder[]>("/api/orders"),
  getOrder: (id: string) => fetchJson<CompanyOrder>(`/api/orders/${id}`),
  getOrderStats: () => fetchJson<CompanyOrderStats>("/api/orders/stats"),
  getDeliveries: (unassignedOnly = false) =>
    fetchJson<CompanyDelivery[]>(`/api/deliveries${unassignedOnly ? "?unassigned=true" : ""}`),
  getDispatchOverview: () => fetchJson<DispatchOverview>("/api/dispatch/overview"),
  getDrivers: () => fetchJson<CompanyDriver[]>("/api/drivers"),
  getDriverDispatchWorkload: () =>
    fetchJson<DriverDispatchWorkload[]>("/api/dispatch/drivers-workload"),
  assignDelivery: (deliveryId: string, driverId: string, force = false) =>
    fetchJson<CompanyDelivery>(`/api/deliveries/${deliveryId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, force }),
    }),
  updateOrderStatus: (orderId: string, data: UpdateOrderStatusInput) =>
    fetchJson<CompanyOrder>(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteOrder: (orderId: string) =>
    fetchJson<void>(`/api/orders/${orderId}`, { method: "DELETE" }),
  createOrderInvoice: (orderId: string, data: CreateOrderInvoiceInput) =>
    fetchJson<{ id: string; reference: string }>(`/api/orders/${orderId}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getClients: () => fetchJson<CompanyClient[]>("/api/clients"),
  getClient: (id: string) => fetchJson<Record<string, unknown>>(`/api/clients/${id}`),
  getDriver: (id: string) => fetchJson<Record<string, unknown>>(`/api/drivers/${id}`),
  updateDelivery: (deliveryId: string, data: AdminUpdateDeliveryInput) =>
    fetchJson<CompanyDelivery>(`/api/deliveries/${deliveryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
