import { AssignDriverCell } from "./assign-driver-cell";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import {
  ORDER_TABLE_COL,
  plainClientName,
  TableDueCell,
  TableIdentityCell,
  TableTypeBadge,
  tableSelectWrapper,
} from "./table-ui";
import type { TableColumn } from "@/types";
import type { CompanyDelivery } from "./types";

function getAddress(delivery: CompanyDelivery) {
  const isCourier =
    delivery.deliveryCategory === "COURIER" || delivery.order.deliveryCategory === "COURIER";

  if (isCourier && (delivery.pickupAddress || delivery.order.pickupAddress)) {
    const pickup = [
      delivery.pickupAddress ?? delivery.order.pickupAddress,
      delivery.pickupPostalCode ?? delivery.order.pickupPostalCode,
      delivery.pickupCity ?? delivery.order.pickupCity,
    ]
      .filter(Boolean)
      .join(", ");
    const dest = [
      delivery.order.shippingAddress ?? delivery.address,
      delivery.order.shippingPostalCode ?? delivery.postalCode,
      delivery.order.shippingCity ?? delivery.city,
    ]
      .filter(Boolean)
      .join(", ");
    return `${pickup} → ${dest}`;
  }

  return [
    delivery.order.shippingAddress ?? delivery.address,
    delivery.order.shippingPostalCode ?? delivery.postalCode,
    delivery.order.shippingCity ?? delivery.city,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Recherche de la file : référence, client et adresse, comme ce que la ligne affiche. */
export function dispatchSearchText(row: CompanyDelivery): string {
  return [row.reference, row.order.reference, plainClientName(row.order), getAddress(row)].join(" ");
}

export function getDispatchColumns(): TableColumn<CompanyDelivery>[] {
  return [
    {
      // Client et adresse d'abord (collecte → destination pour une course), la référence en petit.
      key: "reference",
      header: "Livraison",
      className: ORDER_TABLE_COL.order,
      cell: (row) => (
        <TableIdentityCell
          href={`/dashboard/orders/${row.order.id}`}
          client={plainClientName(row.order)}
          place={getAddress(row) || null}
          reference={row.reference}
        />
      ),
    },
    {
      key: "deliveryCategory",
      header: "Type",
      hideOnMobile: true,
      className: ORDER_TABLE_COL.type,
      cell: (row) => (
        <TableTypeBadge category={row.deliveryCategory ?? row.order.deliveryCategory} />
      ),
    },
    {
      key: "scheduledAt",
      header: "Prévue",
      sortable: true,
      hideOnMobile: true,
      className: ORDER_TABLE_COL.deliveryDate,
      cell: (row) => (
        <TableDueCell
          status={row.status}
          date={row.scheduledAt ?? row.order.requestedDeliveryDate ?? row.createdAt}
          deadline={row.order.requestedDeliveryDate}
        />
      ),
    },
    {
      key: "status",
      header: "Statut",
      className: ORDER_TABLE_COL.status,
      cell: (row) => (
        <DeliveryStatusBadge
          status={row.status}
          deliveryCategory={row.deliveryCategory ?? row.order.deliveryCategory}
        />
      ),
    },
    {
      key: "driver",
      header: "Chauffeur",
      className: ORDER_TABLE_COL.driver,
      cell: (row) => (
        <div className={tableSelectWrapper()}>
          <AssignDriverCell delivery={row} />
        </div>
      ),
    },
  ];
}
