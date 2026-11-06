import type { DeliveryCategory } from "@prisma/client";
import type { CreateClientOrderInput, UpdateOrderStatusInput } from "@/lib/validations/order";
import type { CompanyDeliverySlots } from "@/lib/validations/delivery-slots";
import type { CreateOrderInvoiceInput } from "@/lib/validations/invoice";
import type { AdminUpdateDeliveryInput } from "@/lib/validations/delivery";
import type { CompanyDashboardStats } from "@/lib/dashboard/dashboard-types";
import type { CompanyAnalytics } from "@/domains/analytics/analytics.service";
import type { DispatchIncident } from "@/lib/dispatch/dispatch-incidents";
import type { PresentedRound, RoundProposals } from "@/domains/delivery/delivery-rounds.service";
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

export type RoundSubmission = {
  driverId: string;
  stops: Array<{ deliveryId: string; kind: "PICKUP" | "DROPOFF" }>;
  dryRun?: boolean;
  acceptViolations?: boolean;
};

export type RoundSubmissionResult =
  | { status: "PREVIEW" | "NEEDS_CONFIRMATION"; round: PresentedRound }
  | { status: "DONE"; round: PresentedRound; roundId: string; assigned: string[]; failed: Array<{ deliveryId: string; code: string }> };

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
  getRoundProposals: () => fetchJson<RoundProposals>("/api/dispatch/rounds"),
  submitRound: (body: RoundSubmission) =>
    fetchJson<RoundSubmissionResult>("/api/dispatch/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getDispatchIncidents: () => fetchJson<DispatchIncident[]>("/api/dispatch/incidents"),
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
  getOrderCreateOptions: () =>
    fetchJson<{ enabled: DeliveryCategory[]; deliverySlots: CompanyDeliverySlots }>("/api/orders/create-options"),
  /** La même clé repart à chaque clic d'un même formulaire : une seule commande. */
  createCustomerOrder: (customerId: string, order: CreateClientOrderInput, idempotencyKey: string) =>
    fetchJson<{ id: string; reference?: string }>("/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ customerId, order }),
    }),
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
