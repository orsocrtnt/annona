"use client";

import { useQuery } from "@tanstack/react-query";
import type { DeliveryCategory } from "@prisma/client";
import type { CompanyDeliveryOptions } from "@/lib/validations/company-settings";

interface PortalDeliveryOptionsResponse {
  options: CompanyDeliveryOptions;
  enabled: DeliveryCategory[];
}

async function fetchDeliveryOptions(): Promise<PortalDeliveryOptionsResponse> {
  const res = await fetch("/api/portal/delivery-options");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data as PortalDeliveryOptionsResponse;
}

export function usePortalDeliveryOptions() {
  return useQuery({
    queryKey: ["portal", "delivery-options"],
    queryFn: fetchDeliveryOptions,
  });
}
