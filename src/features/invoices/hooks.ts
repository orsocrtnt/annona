"use client";

import type { BillingPeriod, PaymentMethod } from "@prisma/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesApi, type AdminInvoiceFiltersInput } from "./api";

export const INVOICE_KEYS = {
  all: ["invoices"] as const,
  list: (filters: AdminInvoiceFiltersInput) => ["invoices", "list", filters] as const,
  detail: (id: string) => ["invoices", "detail", id] as const,
  portal: (periodType: BillingPeriod, date: string) => ["portal-invoices", periodType, date] as const,
};

export function useAdminInvoices(filters: AdminInvoiceFiltersInput) {
  return useQuery({ queryKey: INVOICE_KEYS.list(filters), queryFn: () => invoicesApi.list(filters), placeholderData: (previous) => previous });
}

export function useAdminInvoice(id: string) {
  return useQuery({
    queryKey: INVOICE_KEYS.detail(id),
    queryFn: () => invoicesApi.detail(id),
    // Envoi en cours : relit l'état jusqu'à la fin de la tâche.
    refetchInterval: (query) => (query.state.data?.email?.state === "PENDING" ? 3_000 : false),
  });
}

function useInvalidateInvoices() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: INVOICE_KEYS.all });
}

export function useGenerateInvoices() {
  const invalidate = useInvalidateInvoices();
  return useMutation({ mutationFn: invoicesApi.generate, onSuccess: () => void invalidate() });
}

export function useRecordPayment(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({
    mutationFn: (input: { amountCents: number; method: PaymentMethod; paidAt: string; reference: string | null }) => invoicesApi.recordPayment(id, input),
    onSuccess: () => void invalidate(),
  });
}

export function useDeletePayment(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({ mutationFn: (paymentId: string) => invoicesApi.deletePayment(id, paymentId), onSuccess: () => void invalidate() });
}

export function useSendInvoice(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({ mutationFn: () => invoicesApi.send(id), onSuccess: () => void invalidate() });
}

export function useRemindInvoice(id: string) {
  const invalidate = useInvalidateInvoices();
  return useMutation({ mutationFn: () => invoicesApi.remind(id), onSuccess: () => void invalidate() });
}

export function usePortalInvoices(periodType: BillingPeriod, date: string) {
  return useQuery({ queryKey: INVOICE_KEYS.portal(periodType, date), queryFn: () => invoicesApi.portal(periodType, date), placeholderData: (previous) => previous });
}
