"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator } from "lucide-react";
import { portalApi } from "./api";
import { formatCurrency } from "./utils";

export type CourierEstimateFn = typeof portalApi.estimateCourier;

interface CourierEstimateBannerProps {
  pickupAddress?: string;
  pickupCity?: string;
  pickupPostalCode?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingPostalCode?: string;
  requestedDeliveryDate?: string;
  /** Saisie par l'équipe : sa propre route ; par défaut, celle du portail client. */
  estimate?: CourierEstimateFn;
}

/**
 * Affiche une estimation indicative du prix d'une course.
 * Ne s'affiche que si l'entreprise a activé l'option (l'API renvoie `enabled`).
 */
export function CourierEstimateBanner({ estimate, ...props }: CourierEstimateBannerProps) {
  const [params, setParams] = useState(props);

  useEffect(() => {
    const timer = setTimeout(() => setParams(props), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.pickupAddress,
    props.pickupCity,
    props.pickupPostalCode,
    props.shippingAddress,
    props.shippingCity,
    props.shippingPostalCode,
    props.requestedDeliveryDate,
  ]);

  const ready = Boolean(params.pickupAddress && params.shippingAddress);

  const { data } = useQuery({
    queryKey: [estimate ? "company" : "portal", "courier-estimate", params],
    queryFn: () => (estimate ?? portalApi.estimateCourier)(params),
    enabled: ready,
    staleTime: 60_000,
  });

  if (!data?.enabled || data.total == null) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-subtle px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Calculator className="h-4 w-4 text-brand" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Estimation indicative</p>
          {data.distanceKm != null && (
            <p className="text-xs text-muted-foreground">
              ~{data.distanceKm} km · prix final confirmé par l&apos;entreprise
            </p>
          )}
        </div>
      </div>
      <span className="text-lg font-semibold text-brand">~ {formatCurrency(data.total)}</span>
    </div>
  );
}
