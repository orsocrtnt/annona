import Link from "next/link";
import { AssignDriverCell } from "./assign-driver-cell";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import {
  formatClientName,
  ORDER_TABLE_COL,
  TableDateCell,
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

export function getDispatchColumns(): TableColumn<CompanyDelivery>[] {
  return [
    {
      key: "reference",
      header: "Réf.",
      sortable: true,
      className: ORDER_TABLE_COL.reference,
      cell: (row) => (
        <Link
          href={`/dashboard/orders/${row.order.id}`}
          className="block truncate font-medium text-brand hover:underline"
          title={row.reference}
        >
          {row.reference}
        </Link>
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
      key: "client",
      header: "Client",
      hideOnMobile: true,
      className: ORDER_TABLE_COL.client,
      cell: (row) => {
        const label = formatClientName(row.order);
        return (
          <span className="block truncate" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: "address",
      header: "Adresse",
      hideOnMobile: true,
      className: ORDER_TABLE_COL.address,
      cell: (row) => {
        const label = getAddress(row);
        return (
          <span className="block truncate text-muted-foreground" title={label}>
            {label}
          </span>
        );
      },
    },
    {
      key: "scheduledAt",
      header: "Date",
      sortable: true,
      hideOnMobile: true,
      className: ORDER_TABLE_COL.createdAt,
      cell: (row) =>
        row.scheduledAt ? (
          <TableDateCell date={row.scheduledAt} />
        ) : (
          <TableDateCell date={row.createdAt} />
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
