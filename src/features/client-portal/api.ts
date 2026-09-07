import type {
  PortalAddress,
  PortalRecurringOrder,
  PortalSettings,
  PortalSupportContacts,
  PortalClientNotification,
} from "./types";
import type { CreateClientOrderInput, CreateRecurringOrderInput, UpdateRecurringOrderInput } from "@/lib/validations/order";
import type { CustomerAddressInput } from "@/lib/validations/address";
import type { CreateSupportTicketInput } from "@/lib/validations/support";
import type { ClientSettingsInput } from "@/lib/validations/settings";

async function fetchPortal<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.error ?? "Une erreur est survenue");
  }

  return json.data as T;
}

export const portalApi = {
  getDashboard: () => fetchPortal<import("./types").PortalDashboardStats>("/api/portal/dashboard"),
  getOrders: (history = false) =>
    fetchPortal<import("./types").PortalOrder[]>(`/api/portal/orders${history ? "?history=true" : ""}`),
  getOrder: (id: string) => fetchPortal<import("./types").PortalOrder>(`/api/portal/orders/${id}`),
  createOrder: (data: CreateClientOrderInput) =>
    fetchPortal<import("./types").PortalOrder>("/api/portal/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  estimateCourier: (data: {
    pickupAddress?: string;
    pickupCity?: string;
    pickupPostalCode?: string;
    shippingAddress?: string;
    shippingCity?: string;
    shippingPostalCode?: string;
    requestedDeliveryDate?: string;
  }) =>
    fetchPortal<{ enabled: boolean; amount: number | null; distanceKm: number | null }>(
      "/api/portal/order-estimate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    ),
  getDeliveries: () => fetchPortal<import("./types").PortalDelivery[]>("/api/portal/deliveries"),
  getDelivery: (id: string) => fetchPortal<import("./types").PortalDelivery>(`/api/portal/deliveries/${id}`),
  getInvoices: () => fetchPortal<import("./types").PortalInvoice[]>("/api/portal/invoices"),
  getInvoice: (id: string) => fetchPortal<import("./types").PortalInvoice>(`/api/portal/invoices/${id}`),
  getRecurringOrders: () => fetchPortal<PortalRecurringOrder[]>("/api/portal/recurring-orders"),
  createRecurringOrder: (data: CreateRecurringOrderInput) =>
    fetchPortal<PortalRecurringOrder>("/api/portal/recurring-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateRecurringOrder: (id: string, data: UpdateRecurringOrderInput) =>
    fetchPortal<PortalRecurringOrder>(`/api/portal/recurring-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getAddresses: () => fetchPortal<PortalAddress[]>("/api/portal/addresses"),
  createAddress: (data: CustomerAddressInput) =>
    fetchPortal<PortalAddress>("/api/portal/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateAddress: (id: string, data: Partial<CustomerAddressInput>) =>
    fetchPortal<PortalAddress>(`/api/portal/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  deleteAddress: (id: string) =>
    fetch(`/api/portal/addresses/${id}`, { method: "DELETE" }).then(async (res) => {
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Erreur");
      }
    }),
  getSettings: () => fetchPortal<PortalSettings>("/api/portal/settings"),
  updateSettings: (data: ClientSettingsInput) =>
    fetchPortal<PortalSettings>("/api/portal/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getNotifications: () => fetchPortal<PortalClientNotification[]>("/api/portal/notifications"),
  markNotificationsRead: (ids?: string[]) =>
    fetchPortal<PortalClientNotification[]>("/api/portal/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    }),
  getSupportTickets: () => fetchPortal<import("./types").PortalSupportTicket[]>("/api/portal/support"),
  getSupportTicket: (id: string) =>
    fetchPortal<import("./types").PortalSupportTicket>(`/api/portal/support/${id}`),
  getSupportContacts: (deliveryId?: string) =>
    fetchPortal<PortalSupportContacts>(
      `/api/portal/support/contacts${deliveryId ? `?deliveryId=${deliveryId}` : ""}`
    ),
  createSupportTicket: (data: CreateSupportTicketInput) =>
    fetchPortal<import("./types").PortalSupportTicket>("/api/portal/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  addSupportMessage: (ticketId: string, body: string) =>
    fetchPortal<{ id: string }>(`/api/portal/support/${ticketId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }),
};
