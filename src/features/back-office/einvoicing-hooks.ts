"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientInvoiceIdentity, CompanyEinvoicingUpdate } from "@/lib/validations/einvoicing";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type CompanyEinvoicingData = {
  identity: Record<keyof CompanyEinvoicingUpdate["identity"], string | null>;
  einvoicing: Partial<Record<keyof CompanyEinvoicingUpdate["einvoicing"], string>>;
};

export function useCompanyEinvoicing(enabled: boolean) {
  return useQuery({
    queryKey: ["company", "settings", "einvoicing"],
    queryFn: () => fetchJson<CompanyEinvoicingData>("/api/company/einvoicing"),
    enabled,
    retry: 1,
  });
}

export function useUpdateCompanyEinvoicing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) => fetchJson<CompanyEinvoicingUpdate>("/api/company/einvoicing", jsonInit("PATCH", data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company", "settings", "einvoicing"] }),
  });
}

export function useClientInvoiceIdentity(clientId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["company", "clients", clientId, "invoice-identity"],
    queryFn: () => fetchJson<ClientInvoiceIdentity | null>(`/api/company/clients/${encodeURIComponent(clientId)}/invoice-identity`),
    enabled: enabled && Boolean(clientId),
    retry: 1,
  });
}

export function useUpdateClientInvoiceIdentity(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: unknown) =>
      fetchJson<ClientInvoiceIdentity>(`/api/company/clients/${encodeURIComponent(clientId)}/invoice-identity`, jsonInit("PUT", data)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company", "clients", clientId, "invoice-identity"] }),
  });
}
