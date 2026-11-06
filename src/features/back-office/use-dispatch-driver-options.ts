"use client";

import { useMemo } from "react";
import type { DeliveryCategory } from "@prisma/client";
import {
  formatEligibilityReasons,
  getDriverEligibilityReasons,
  isOnlySoftIneligibility,
  splitEligibilityReasons,
  type DeliveryForEligibility,
  type DriverEligibilityReason,
} from "@/lib/dispatch/driver-eligibility";
import { getDispatchDriverRule } from "@/lib/validations/dispatch-settings";
import { useCompanyDrivers } from "./hooks";
import { useCompanyDispatchSettings } from "./dispatch-settings-hooks";
import type { CompanyDriver } from "./types";

export type DispatchDriverOption = {
  driver: CompanyDriver;
  eligible: boolean;
  /** Charge max atteinte — assignation possible après confirmation admin. */
  overCapacity: boolean;
  reasons: string;
};

export function useDispatchDriverOptions(delivery: DeliveryForEligibility) {
  const { data: drivers } = useCompanyDrivers();
  const { data: settings } = useCompanyDispatchSettings();

  return useMemo(() => {
    if (!drivers?.length || !settings) {
      return {
        compatible: [] as DispatchDriverOption[],
        overCapacity: [] as DispatchDriverOption[],
        incompatible: [] as DispatchDriverOption[],
      };
    }

    const options = drivers.map((driver) => {
      const reasonCodes = getDriverEligibilityReasons(
        driver,
        delivery,
        settings
      );
      const { soft } = splitEligibilityReasons(reasonCodes);
      const overCapacity = isOnlySoftIneligibility(reasonCodes);
      return {
        driver,
        eligible: reasonCodes.length === 0,
        overCapacity,
        reasons: formatEligibilityReasons(
          overCapacity ? (soft as DriverEligibilityReason[]) : reasonCodes
        ),
      };
    });

    return {
      compatible: options.filter((item) => item.eligible),
      overCapacity: options.filter((item) => item.overCapacity),
      incompatible: options.filter((item) => !item.eligible && !item.overCapacity),
    };
  }, [drivers, settings, delivery]);
}

export function useDriverDispatchProfile(driverId: string) {
  const { data: settings } = useCompanyDispatchSettings();
  if (!settings) return null;
  return getDispatchDriverRule(settings, driverId);
}

export function getDeliveryEligibilityInput(delivery: {
  deliveryCategory?: DeliveryCategory;
  postalCode?: string | null;
  pickupPostalCode?: string | null;
  order?: {
    deliveryCategory?: DeliveryCategory;
    shippingPostalCode?: string | null;
    pickupPostalCode?: string | null;
  };
}): DeliveryForEligibility {
  const category =
    delivery.deliveryCategory ?? delivery.order?.deliveryCategory ?? "STANDARD";
  return {
    deliveryCategory: category,
    postalCode: delivery.postalCode ?? delivery.order?.shippingPostalCode ?? null,
    pickupPostalCode:
      delivery.pickupPostalCode ?? delivery.order?.pickupPostalCode ?? null,
  };
}
