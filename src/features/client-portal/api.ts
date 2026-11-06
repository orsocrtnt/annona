import type {
  PortalSettings,
  PortalSupportContacts,
  PortalSupportTicket,
  PortalClientNotification,
} from "./types";
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
  getSupportTickets: () => fetchPortal<PortalSupportTicket[]>("/api/portal/support"),
  getSupportTicket: (id: string) =>
    fetchPortal<PortalSupportTicket>(`/api/portal/support/${id}`),
  getSupportContacts: (orderId?: string) =>
    fetchPortal<PortalSupportContacts>(
      `/api/portal/support/contacts${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ""}`
    ),
  createSupportTicket: (data: CreateSupportTicketInput) =>
    fetchPortal<PortalSupportTicket>("/api/portal/support", {
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
