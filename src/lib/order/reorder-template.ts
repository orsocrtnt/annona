import type { DeliveryCategory } from "@prisma/client";
import type { CreateClientOrderFormInput } from "@/lib/validations/order";

type ReorderItem = {
  name: string;
  quantity: number;
  unitPrice: unknown;
  orderStopId?: string | null;
};

type ReorderStop = {
  sequence: number;
  label?: string | null;
  address: string;
  city?: string | null;
  postalCode?: string | null;
  instructions?: string | null;
  items?: ReorderItem[];
};

export type OrderForReorder = {
  deliveryCategory: DeliveryCategory;
  missionDescription?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingPostalCode?: string | null;
  deliveryInstructions?: string | null;
  pickupAddress?: string | null;
  pickupCity?: string | null;
  pickupPostalCode?: string | null;
  pickupInstructions?: string | null;
  notes?: string | null;
  items: ReorderItem[];
  stops: ReorderStop[];
};

function mapItemForForm(item: ReorderItem, includePrice: boolean) {
  const price = Number(item.unitPrice);
  return {
    name: item.name,
    quantity: item.quantity,
    estimatedPrice:
      includePrice && !Number.isNaN(price) && price > 0 ? price : undefined,
  };
}

const emptyShipping = {
  shippingAddress: "",
  shippingCity: "",
  shippingPostalCode: "",
  deliveryInstructions: "",
  requestedDeliveryDate: "",
  notes: "",
  saveAddress: false,
  addressLabel: "",
};

export function buildReorderFormValues(order: OrderForReorder): CreateClientOrderFormInput {
  const base = {
    ...emptyShipping,
    pickupAddress: "",
    pickupCity: "",
    pickupPostalCode: "",
    pickupInstructions: "",
    pickupStops: undefined as CreateClientOrderFormInput["pickupStops"],
    stops: undefined as CreateClientOrderFormInput["stops"],
    items: [] as CreateClientOrderFormInput["items"],
    missionDescription: "",
  };

  if (order.deliveryCategory === "SPECIAL_MISSION") {
    return {
      ...base,
      deliveryCategory: "SPECIAL_MISSION",
      missionDescription: order.missionDescription ?? "",
      notes: order.notes ?? "",
      stops:
        order.stops.length > 0
          ? order.stops.map((stop) => ({
              label: stop.label ?? undefined,
              address: stop.address,
              city: stop.city ?? "",
              postalCode: stop.postalCode ?? "",
              instructions: stop.instructions ?? undefined,
            }))
          : [{ label: "", address: "", city: "", postalCode: "", instructions: "" }],
    };
  }

  const shipping = {
    shippingAddress: order.shippingAddress ?? "",
    shippingCity: order.shippingCity ?? "",
    shippingPostalCode: order.shippingPostalCode ?? "",
    deliveryInstructions: order.deliveryInstructions ?? "",
    notes: order.notes ?? "",
    requestedDeliveryDate: "",
    saveAddress: false,
    addressLabel: "",
  };

  if (order.deliveryCategory === "COURIER") {
    const pickupStops =
      order.stops.length > 0
        ? order.stops.map((stop, index) => ({
            label: stop.label?.trim() || `Collecte ${index + 1}`,
            address: stop.address,
            city: stop.city ?? "",
            postalCode: stop.postalCode ?? "",
            instructions: stop.instructions ?? "",
            items:
              stop.items && stop.items.length > 0
                ? stop.items.map((item) => mapItemForForm(item, false))
                : [{ name: "", quantity: 1, estimatedPrice: undefined }],
          }))
        : [
            {
              label: "Collecte 1",
              address: order.pickupAddress ?? "",
              city: order.pickupCity ?? "",
              postalCode: order.pickupPostalCode ?? "",
              instructions: order.pickupInstructions ?? "",
              items:
                order.items.length > 0
                  ? order.items.map((item) => mapItemForForm(item, false))
                  : [{ name: "", quantity: 1, estimatedPrice: undefined }],
            },
          ];

    return {
      ...base,
      deliveryCategory: "COURIER",
      ...shipping,
      pickupStops,
      items: [{ name: "", quantity: 1, estimatedPrice: undefined }],
    };
  }

  return {
    ...base,
    deliveryCategory: "STANDARD",
    ...shipping,
    items:
      order.items.length > 0
        ? order.items.map((item) => mapItemForForm(item, true))
        : [{ name: "", quantity: 1, estimatedPrice: undefined }],
  };
}
