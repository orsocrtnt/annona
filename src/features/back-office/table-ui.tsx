import Link from "next/link";
import type { DeliveryCategory } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatClientFromParts, formatDriverFromParts } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CompanyOrder } from "./types";

/** Classes communes pour les selects dans les tableaux admin */
export const TABLE_SELECT_TRIGGER_CLASS =
  "h-8 w-full min-w-0 text-xs px-2 shadow-none [&>span]:truncate [&>svg]:h-3.5 [&>svg]:w-3.5";

export const ORDER_TABLE_COL = {
  reference: "w-[6.5rem]",
  type: "w-[5.5rem]",
  client: "w-[7.5rem] max-w-[7.5rem]",
  createdAt: "w-[5rem] whitespace-nowrap",
  deliveryDate: "w-[5.5rem] whitespace-nowrap",
  status: "w-[7rem]",
  driver: "w-[7rem]",
  address: "min-w-0",
  actions: "w-8 px-1",
} as const;

export function TableTypeBadge({ category }: { category?: DeliveryCategory | null }) {
  if (category === "COURIER") {
    return (
      <Badge variant="brand" className="whitespace-nowrap px-1 py-0 text-[10px] font-medium">
        Course
      </Badge>
    );
  }
  if (category === "SPECIAL_MISSION") {
    return (
      <Badge variant="warning" className="whitespace-nowrap px-1 py-0 text-[10px] font-medium">
        Mission
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="whitespace-nowrap px-1 py-0 text-[10px] font-medium">
      Commande
    </Badge>
  );
}

type ClientNameSource = {
  customer?: { firstName: string; lastName: string } | null;
  customerEmail?: string | null;
};

export function formatClientName(source: ClientNameSource): string {
  if (!source.customer && !source.customerEmail?.trim()) return "—";
  return formatClientFromParts(source.customer, source.customerEmail);
}

export function TableClientCell({ order }: { order: CompanyOrder }) {
  const label = formatClientName(order);

  return (
    <span className="block truncate" title={label}>
      {label}
    </span>
  );
}

export function TableReferenceLink({ order }: { order: CompanyOrder }) {
  return (
    <Link
      href={`/dashboard/orders/${order.id}`}
      className="block truncate font-medium text-brand hover:underline"
      title={order.reference}
    >
      {order.reference}
    </Link>
  );
}

export function TableDriverLabel({ order }: { order: CompanyOrder }) {
  const delivery = order.deliveries?.[0];
  if (!delivery) return <span className="text-muted-foreground">—</span>;

  const label = formatDriverFromParts(delivery.driver, delivery.driverName ?? null);

  return (
    <span className="block truncate text-muted-foreground" title={label}>
      {label}
    </span>
  );
}

export function TableDateCell({ date }: { date: string }) {
  return <span className="text-muted-foreground">{formatDate(date)}</span>;
}

export function TableRequestedDeliveryCell({ date }: { date?: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  return <span>{formatDate(date)}</span>;
}

export function tableSelectWrapper(className?: string) {
  return cn("w-full min-w-0", className);
}
