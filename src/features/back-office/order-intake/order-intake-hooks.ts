"use client";

import type { CompanyDeliverySlots } from "@/lib/validations/delivery-slots";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { IntakeOrderInput } from "@/domains/order-intake/order-intake.form";
import { orderIntakeApi } from "./order-intake-api";

const STATUS_KEY = ["company", "order-intake", "status"] as const;

export function useOrderIntakeStatus() {
  return useQuery({ queryKey: STATUS_KEY, queryFn: orderIntakeApi.getStatus, retry: false });
}

export function useToggleOrderIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: orderIntakeApi.setEnabled,
    onSuccess: () => qc.invalidateQueries({ queryKey: STATUS_KEY }),
  });
}

export function useAnalyzeOrderMessage() {
  return useMutation({
    mutationFn: ({ text, sender }: { text: string; sender: string }) => orderIntakeApi.analyze(text, sender),
  });
}

export function useCreateIntakeOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { customerId: string; order: IntakeOrderInput; idempotencyKey: string }) =>
      orderIntakeApi.createOrder(input.customerId, input.order, input.idempotencyKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company"] }),
  });
}

export function useIntakeDeliverySlots() {
  return useQuery({
    queryKey: ["company", "intake", "delivery-slots"],
    queryFn: async (): Promise<CompanyDeliverySlots> => {
      const response = await fetch("/api/orders/intake/delivery-slots");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Erreur serveur");
      return json.data as CompanyDeliverySlots;
    },
    retry: false,
  });
}
