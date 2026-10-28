"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CompanyInvoiceFilter } from "@/domains/invoice/company-invoices.service";
import { companyInvoicesApi } from "./company-invoices-api";

export function useCompanyInvoices(status: CompanyInvoiceFilter) {
  return useQuery({
    queryKey: ["company", "invoices", status],
    queryFn: () => companyInvoicesApi.list(status),
    retry: 1,
  });
}

export function useRemindInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => companyInvoicesApi.remind(invoiceId),
    onSettled: () => qc.invalidateQueries({ queryKey: ["company", "invoices"] }),
  });
}
