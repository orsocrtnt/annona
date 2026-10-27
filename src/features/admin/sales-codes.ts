"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

/** SALES-1, décision C10 : codes commerciaux gérés par le super-administrateur. */
export type SalesCodeLevel = "REFERRER" | "ASSISTED" | "AUTONOMOUS";

export const SALES_CODE_LEVELS: Array<{ value: SalesCodeLevel; label: string }> = [
  { value: "REFERRER", label: "Apporteur · 15 %" },
  { value: "ASSISTED", label: "Accompagné · 25 %" },
  { value: "AUTONOMOUS", label: "Autonome · 35 %" },
];

export type SalesCodeRow = {
  id: string;
  code: string;
  sellerName: string;
  sellerEmail: string;
  level: SalesCodeLevel;
  disabledAt: string | null;
  createdAt: string;
  attributions: number;
};

export type SalesCodePage = { items: SalesCodeRow[]; total: number; page: number; pageSize: number };

async function readJson<T>(res: Response) {
  let json: { error?: string; data?: T } = {};
  try {
    json = await res.json();
  } catch {
    throw new Error(res.ok ? "Réponse invalide du serveur" : `Erreur serveur (${res.status})`);
  }
  if (!res.ok) throw new Error(json.error ?? `Erreur serveur (${res.status})`);
  return json.data as T;
}

export async function fetchSalesCodes(page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return readJson<SalesCodePage>(await fetch(`/api/admin/sales-codes?${params.toString()}`, { cache: "no-store" }));
}

export function useSalesCodes(page: number, pageSize: number) {
  return useQuery({
    queryKey: ["admin", "sales-codes", page, pageSize],
    queryFn: () => fetchSalesCodes(page, pageSize),
    staleTime: QUERY_STALE_MS,
  });
}

export function useCreateSalesCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { sellerName: string; sellerEmail: string; level: SalesCodeLevel }) =>
      readJson<{ code: string }>(await fetch("/api/admin/sales-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "sales-codes"] }),
  });
}

export function useDisableSalesCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      readJson<unknown>(await fetch(`/api/admin/sales-codes/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable" }),
      })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "sales-codes"] }),
  });
}

export type SalesCommissionExplanation =
  | "ELIGIBLE" | "NOT_PAID" | "OUTSIDE_WINDOW" | "LATER_CHANGE_OR_USAGE"
  | "CONTRACT_CHANGED" | "PARTIAL_PAYMENT" | "UNRECOGNISED_INVOICE" | "REFUND";

export type SalesCodeHistory = {
  code: string;
  sellerName: string;
  attributions: Array<{
    id: string;
    companyName: string;
    level: SalesCodeLevel;
    rateBps: number;
    attributedAt: string;
    eligibleUntil: string;
    totalCommissionCents: number;
    entries: Array<{
      kind: "PAYMENT" | "UNPAID" | "REFUND";
      explanation: SalesCommissionExplanation;
      eligibleHtCents: number;
      commissionCents: number;
      receivedAt: string;
    }>;
  }>;
};

export function useSalesCodeHistory(id: string | null) {
  return useQuery({
    queryKey: ["admin", "sales-codes", "history", id],
    queryFn: async () => readJson<SalesCodeHistory>(await fetch(`/api/admin/sales-codes/${encodeURIComponent(id!)}`, { cache: "no-store" })),
    enabled: Boolean(id),
    staleTime: QUERY_STALE_MS,
  });
}
