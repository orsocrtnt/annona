import type { BillingPeriod, PaymentMethod } from "@prisma/client";
import type { AdminInvoiceDetail, AdminInvoiceList, GenerationResultView, PortalInvoiceList } from "@/domains/invoice/invoice.types";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export interface AdminInvoiceFiltersInput {
  from?: string | null;
  to?: string | null;
  merchantId?: string | null;
  status?: string | null;
}

export function invoiceFilterParams(filters: AdminInvoiceFiltersInput) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params;
}

const enc = encodeURIComponent;

/** FACT-1 — factures du back-office (ADM-10) et du portail commerçant (CLI-10). */
export const invoicesApi = {
  list: (filters: AdminInvoiceFiltersInput) => call<AdminInvoiceList>(`/api/invoices?${invoiceFilterParams(filters).toString()}`),
  detail: (id: string) => call<AdminInvoiceDetail>(`/api/invoices/${enc(id)}`),
  generate: (input: { periodType: BillingPeriod; date: string; merchantId: string | null }) =>
    call<GenerationResultView>("/api/invoices/generate", jsonInit("POST", input)),
  recordPayment: (id: string, input: { amountCents: number; method: PaymentMethod; paidAt: string; reference: string | null }) =>
    call<{ paymentId: string }>(`/api/invoices/${enc(id)}/payments`, jsonInit("POST", input)),
  deletePayment: (id: string, paymentId: string) => call<unknown>(`/api/invoices/${enc(id)}/payments/${enc(paymentId)}`, jsonInit("DELETE")),
  send: (id: string) => call<{ attempt: number; alreadyPending: boolean }>(`/api/invoices/${enc(id)}/send`, jsonInit("POST")),
  remind: (id: string) => call<{ duplicate: boolean }>(`/api/invoices/${enc(id)}/remind`, jsonInit("POST")),
  portal: (periodType: BillingPeriod, date: string) =>
    call<PortalInvoiceList>(`/api/portal/invoices?periodType=${enc(periodType)}&date=${enc(date)}`),
};

export const adminInvoicePdfUrl = (id: string, facturx = false) => `/api/invoices/${enc(id)}/pdf${facturx ? "?format=facturx" : ""}`;
export const portalInvoicePdfUrl = (id: string) => `/api/portal/invoices/${enc(id)}/pdf`;
export const portalStatementUrl = (periodType: BillingPeriod, date: string) =>
  `/api/portal/invoices/statement?periodType=${enc(periodType)}&date=${enc(date)}`;
export const invoiceExportUrl = (filters: AdminInvoiceFiltersInput) => `/api/invoices/export?${invoiceFilterParams(filters).toString()}`;
