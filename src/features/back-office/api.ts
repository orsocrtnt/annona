import type { CompanySupportTicket } from "./types";

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
