import type { DeliveryCategory, DeliveryStatus } from "@prisma/client";

export interface DriverMissionItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: string | number;
  orderStopId?: string | null;
}

export interface DriverMission {
  id: string;
  orderId: string;
  reference: string;
  status: DeliveryStatus;
  deliveryCategory: DeliveryCategory;
  pickupAddress: string | null;
  pickupCity: string | null;
  pickupPostalCode: string | null;
  address: string;
  city: string | null;
  postalCode: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  missionStartedAt: string | null;
  missionAcceptedAt: string | null;
  updatedAt: string;
  driverId: string | null;
  driverName: string | null;
  podPhotoUrl?: string | null;
  podFailureCode?: string | null;
  podNote?: string | null;
  order: {
    reference: string;
    itemCount: number;
    notes: string | null;
    deliveryInstructions: string | null;
    customerEmail: string | null;
    customer: { firstName: string; lastName: string; phone: string | null } | null;
    items: DriverMissionItem[];
    stops?: {
      sequence: number;
      label?: string | null;
      address: string;
      city?: string | null;
      postalCode?: string | null;
      instructions?: string | null;
      items?: DriverMissionItem[];
    }[];
  };
}

export interface DriverStats {
  assigned: number;
  inTransit: number;
  deliveredToday: number;
}
