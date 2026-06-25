"use client";

import { AssignDriverSelect } from "./assign-driver-select";
import type { CompanyDelivery } from "./types";

interface AssignDriverCellProps {
  delivery: CompanyDelivery;
}

export function AssignDriverCell({ delivery }: AssignDriverCellProps) {
  return (
    <AssignDriverSelect
      deliveryId={delivery.id}
      status={delivery.status}
      driverId={delivery.driverId}
      driverName={delivery.driverName}
      driver={delivery.driver}
      deliveryCategory={delivery.deliveryCategory ?? delivery.order.deliveryCategory}
      postalCode={delivery.postalCode ?? delivery.order.shippingPostalCode}
      pickupPostalCode={delivery.pickupPostalCode ?? delivery.order.pickupPostalCode}
      compact
    />
  );
}
