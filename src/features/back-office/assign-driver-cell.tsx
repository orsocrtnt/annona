"use client";

import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { AssignDriverSelect } from "./assign-driver-select";
import type { CompanyDelivery } from "./types";

interface AssignDriverCellProps {
  delivery: CompanyDelivery;
}

export function AssignDriverCell({ delivery }: AssignDriverCellProps) {
  return (
    <div className="space-y-1">
    <MissionAcknowledgement {...delivery} compact />
    <AssignDriverSelect
      deliveryId={delivery.id}
      status={delivery.status}
      driverId={delivery.driverId}
      driverName={delivery.driverName}
      driver={delivery.driver}
      missionStartedAt={delivery.missionStartedAt}
      deliveryCategory={delivery.deliveryCategory ?? delivery.order.deliveryCategory}
      postalCode={delivery.postalCode ?? delivery.order.shippingPostalCode}
      pickupPostalCode={delivery.pickupPostalCode ?? delivery.order.pickupPostalCode}
      compact
    />
    </div>
  );
}
