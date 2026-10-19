import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { AssignDriverSelect } from "./assign-driver-select";
import { DeleteOrderButton } from "./delete-order-button";
import { OrderStatusSelect } from "./order-status-select";
import {
  ORDER_TABLE_COL,
  TableClientCell,
  TableDateCell,
  TableDriverLabel,
  TableReferenceLink,
  TableRequestedDeliveryCell,
  TableTypeBadge,
  tableSelectWrapper,
} from "./table-ui";
import type { TableColumn } from "@/types";
import type { CompanyOrder } from "./types";

type ColumnMode = "readonly" | "interactive";

export function getCompanyOrderColumns(mode: ColumnMode): TableColumn<CompanyOrder>[] {
  const cols: TableColumn<CompanyOrder>[] = [
    {
      key: "reference",
      header: "Réf.",
      sortable: true,
      className: ORDER_TABLE_COL.reference,
      cell: (row) => <TableReferenceLink order={row} />,
    },
    {
      key: "deliveryCategory",
      header: "Type",
      hideOnMobile: true,
      className: ORDER_TABLE_COL.type,
      cell: (row) => <TableTypeBadge category={row.deliveryCategory} />,
    },
    {
      key: "customerEmail",
      header: "Client",
      hideOnMobile: true,
      className: ORDER_TABLE_COL.client,
      cell: (row) => <TableClientCell order={row} />,
    },
    {
      key: "createdAt",
      header: "Création",
      sortable: true,
      hideOnMobile: true,
      className: ORDER_TABLE_COL.createdAt,
      cell: (row) => <TableDateCell date={row.createdAt} />,
    },
    {
      key: "requestedDeliveryDate",
      header: "Livraison",
      sortable: true,
      hideOnMobile: true,
      className: ORDER_TABLE_COL.deliveryDate,
      cell: (row) => <TableRequestedDeliveryCell date={row.requestedDeliveryDate} />,
    },
    {
      key: "status",
      header: "Statut",
      className: ORDER_TABLE_COL.status,
      cell: (row) =>
        mode === "interactive" ? (
          <div className={tableSelectWrapper()}>

            <OrderStatusSelect
              orderId={row.id}
              currentStatus={row.status}
              deliveryCategory={row.deliveryCategory}
              compact
            />
          </div>
        ) : (
          <OrderStatusBadge status={row.status} deliveryCategory={row.deliveryCategory} />
        ),
    },
    {
      key: "driver",
      header: "Chauffeur",
      className: ORDER_TABLE_COL.driver,
      cell: (row) => {
        const delivery = row.deliveries?.[0];
        if (!delivery) {
          if (row.status === "QUOTE_REQUESTED") {
            return <span className="text-xs text-amber-700 dark:text-amber-400">Devis</span>;
          }
          return <span className="text-muted-foreground">—</span>;
        }

        if (mode === "readonly") {
          return <TableDriverLabel order={row} />;
        }

        return (
          <div className={tableSelectWrapper()}>
            <MissionAcknowledgement {...delivery} />
            <AssignDriverSelect
              deliveryId={delivery.id}
              status={delivery.status}
              driverId={delivery.driverId}
              driverName={delivery.driverName}
              driver={delivery.driver ?? null}
              missionStartedAt={delivery.missionStartedAt}
              deliveryCategory={row.deliveryCategory}
              postalCode={delivery.postalCode ?? row.shippingPostalCode}
              pickupPostalCode={delivery.pickupPostalCode ?? row.pickupPostalCode}
              compact
            />
          </div>
        );
      },
    },
  ];

  if (mode === "interactive") {
    cols.push({
      key: "actions",
      header: "",
      className: ORDER_TABLE_COL.actions,
      cell: (row) => {
        const counts = (
          row as CompanyOrder & {
            _count?: { deliveries: number; invoices: number };
          }
        )._count;
        const canDelete =
          row.status === "QUOTE_REQUESTED" &&
          counts?.deliveries === 0 &&
          counts.invoices === 0;

        return canDelete ? (
          <DeleteOrderButton orderId={row.id} orderReference={row.reference} />
        ) : null;
      },
    });
  }

  return cols;
}
