import type { UpdateOrderStatusInput } from "@/lib/validations/order";
import type { CreateOrderInvoiceInput } from "@/lib/validations/invoice";
import type { AdminUpdateDeliveryInput } from "@/lib/validations/delivery";
import type { CompanyDashboardStats } from "@/lib/dashboard/dashboard-types";
import type { CompanyAnalytics } from "@/domains/analytics/analytics.service";
import type { DispatchSuggestions } from "@/domains/delivery/auto-dispatch.service";
import {
  orderHistorySearchParams,
  type OrderHistoryPage,
  type OrderHistoryQuery,
} from "@/lib/query/order-history";
import type {
  CompanyClient,
  CompanyDelivery,
  CompanyDeliveryDetail,
  CompanyDriver,
  CompanyOrder,
  CompanyOrderStats,
  DispatchOverview,
  DriverDispatchWorkload,
  CompanySupportTicket,
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
  getOrders: (query: OrderHistoryQuery) =>
    fetchJson<OrderHistoryPage<CompanyOrder>>(`/api/orders?${orderHistorySearchParams(query)}`),
  getOrder: (id: string) => fetchJson<CompanyOrder>(`/api/orders/${id}`),
  getDelivery: (id: string) => fetchJson<CompanyDeliveryDetail>(`/api/deliveries/${encodeURIComponent(id)}`),
  getOrderStats: () => fetchJson<CompanyOrderStats>("/api/orders/stats"),
  getDeliveries: (unassignedOnly = false) =>
    fetchJson<CompanyDelivery[]>(`/api/deliveries${unassignedOnly ? "?unassigned=true" : ""}`),
  getDispatchOverview: (deliveryId?: string | null) =>
    fetchJson<DispatchOverview>(
      `/api/dispatch/overview${
        deliveryId ? `?delivery=${encodeURIComponent(deliveryId)}` : ""
      }`
    ),
  getDrivers: () => fetchJson<CompanyDriver[]>("/api/drivers"),
  getDriverDispatchWorkload: () =>
    fetchJson<DriverDispatchWorkload[]>("/api/dispatch/drivers-workload"),
  assignDelivery: (deliveryId: string, driverId: string, force = false) =>
    fetchJson<CompanyDelivery>(`/api/deliveries/${deliveryId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, force }),
    }),
  getDispatchSuggestions: (deliveryId: string) =>
    fetchJson<DispatchSuggestions>(`/api/dispatch/suggestions?deliveryId=${encodeURIComponent(deliveryId)}`),
  assignFromSuggestion: (deliveryId: string, driverId: string) =>
    fetchJson<{ id: string; driverId: string | null; status: string }>("/api/dispatch/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId, driverId }),
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
  markOrderInvoicePaid: (orderId: string, invoiceId: string, expectedUpdatedAt: string) =>
    fetchJson(`/api/orders/${orderId}/invoice`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId, expectedUpdatedAt }),
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
  getSupportTickets: () => fetchJson<CompanySupportTicket[]>("/api/support"),
  addSupportMessage: (ticketId: string, body: string) =>
    fetchJson<CompanySupportTicket>(`/api/support/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }),
  updateSupportStatus: (ticketId: string, status: CompanySupportTicket["status"]) =>
    fetchJson<CompanySupportTicket>(`/api/support/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }),
};
