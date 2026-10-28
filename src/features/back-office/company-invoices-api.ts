import type { CompanyInvoiceFilter, CompanyInvoiceList } from "@/domains/invoice/company-invoices.service";

export type InvoiceReminderResponse = {
  reminder: { id: string; result: string; channel: string; createdAt: string };
  duplicate: boolean;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

export const companyInvoicesApi = {
  list: (status: CompanyInvoiceFilter) =>
    fetchJson<CompanyInvoiceList>(`/api/invoices?status=${encodeURIComponent(status)}`),
  remind: (invoiceId: string) =>
    fetchJson<InvoiceReminderResponse>(`/api/invoices/${encodeURIComponent(invoiceId)}/reminders`, { method: "POST" }),
};
