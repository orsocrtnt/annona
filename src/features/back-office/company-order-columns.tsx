import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { MissionAcknowledgement } from "@/components/shared/mission-acknowledgement";
import { AssignDriverSelect } from "./assign-driver-select";
import { DeleteOrderButton } from "./delete-order-button";
import { OrderStatusSelect } from "./order-status-select";
import {
  ORDER_TABLE_COL,
  TableDeliveryDueCell,
  TableDriverLabel,
  TableOrderCell,
  TableRelativeDateCell,
  TableTypeBadge,
  tableSelectWrapper,
} from "./table-ui";
import type { TableColumn } from "@/types";
import type { CompanyOrder } from "./types";

type ColumnMode = "readonly" | "interactive";

export function getCompanyOrderColumns(mode: ColumnMode): TableColumn<CompanyOrder>[] {
  const cols: TableColumn<CompanyOrder>[] = [
    {
      // Client et adresse d'abord, la référence en petit : on reconnaît une commande sans la déchiffrer.
      key: "reference",
      header: "Commande",
      className: ORDER_TABLE_COL.order,
      cell: (row) => <TableOrderCell order={row} />,
    },
    {
      key: "deliveryCategory",
      header: "Type",
      hideOnMobile: true,
      className: ORDER_TABLE_COL.type,
      cell: (row) => <TableTypeBadge category={row.deliveryCategory} />,
    },
    {
      key: "requestedDeliveryDate",
      header: "Livraison prévue",
      sortable: true,
      hideOnMobile: true,
      className: ORDER_TABLE_COL.deliveryDate,
      cell: (row) => <TableDeliveryDueCell order={row} />,
    },
    {
      key: "createdAt",
      header: "Créée",
      sortable: true,
      hideOnMobile: true,
      className: ORDER_TABLE_COL.createdAt,
      cell: (row) => <TableRelativeDateCell date={row.createdAt} />,
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
            <MissionAcknowledgement {...delivery} compact />
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
