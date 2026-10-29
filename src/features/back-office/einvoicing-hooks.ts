"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ClientInvoiceIdentity, CompanyEinvoicingUpdate } from "@/lib/validations/einvoicing";

/** Refus du serveur avec un message par champ (clé du champ du formulaire). */
export class FieldErrorsError extends Error {
  constructor(message: string, readonly fieldErrors: Record<string, string>) {
    super(message);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json.error ?? "Erreur serveur";
    throw json.fieldErrors ? new FieldErrorsError(message, json.fieldErrors) : new Error(message);
  }
  return json.data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export type CompanyEinvoicingData = {
  identity: Record<keyof CompanyEinvoicingUpdate["identity"], string | null>;
  einvoicing: Partial<Record<Exclude<keyof CompanyEinvoicingUpdate["einvoicing"], "enabled">, string>> & { enabled?: boolean };
  /** Champs stockés invalides, écartés à la lecture : à ressaisir. */
  invalidFields?: string[];
  /** Mentions que l'export Factur-X réclamerait aujourd'hui (même règle que le serveur). */
  missing?: Array<{ field: string; message: string }>;
  /** La facture électronique est activée ou déjà utilisée : les mentions manquantes bloquent l'enregistrement. */
  enforced?: boolean;
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
    mutationFn: (data: unknown) => fetchJson<CompanyEinvoicingUpdate & { enforced?: boolean; missing?: Array<{ field: string; message: string }> }>("/api/company/einvoicing", jsonInit("PATCH", data)),
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
