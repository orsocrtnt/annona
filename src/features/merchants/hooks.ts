"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { merchantsApi } from "./api";
import type { UpdateMerchantInput } from "@/lib/validations/company-admin";

const KEYS = {
  list: (status: string) => ["merchants", "list", status] as const,
  detail: (id: string) => ["merchants", "detail", id] as const,
};

export function useMerchants(status: "all" | "active" | "inactive") {
  return useQuery({ queryKey: KEYS.list(status), queryFn: () => merchantsApi.list(status) });
}

export function useMerchant(id: string | null) {
  return useQuery({ queryKey: KEYS.detail(id ?? ""), queryFn: () => merchantsApi.get(id!), enabled: Boolean(id) });
}

function useInvalidateMerchants() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["merchants"] });
    // Listes de clients des autres écrans (prix spécifiques, commandes, comptes).
    void qc.invalidateQueries({ queryKey: ["catalog", "merchants"] });
    void qc.invalidateQueries({ queryKey: ["users"] });
  };
}

export function useCreateMerchant() {
  const invalidate = useInvalidateMerchants();
  return useMutation({ mutationFn: merchantsApi.create, onSuccess: invalidate });
}

export function useUpdateMerchant(id: string) {
  const invalidate = useInvalidateMerchants();
  return useMutation({ mutationFn: (input: UpdateMerchantInput) => merchantsApi.update(id, input), onSuccess: invalidate });
}
