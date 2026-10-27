import Link from "next/link";
import type { DeliveryCategory } from "@prisma/client";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatClientFromParts, formatDriverFromParts } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { formatPlace } from "@/lib/format/place";
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { isOrderOverdue } from "@/lib/orders/overdue";
import { cn } from "@/lib/utils";
import type { CompanyOrder } from "./types";

/** Classes communes pour les selects dans les tableaux admin */
export const TABLE_SELECT_TRIGGER_CLASS =
  "h-8 w-full min-w-0 text-xs px-2 shadow-none [&>span]:truncate [&>svg]:h-3.5 [&>svg]:w-3.5";

export const ORDER_TABLE_COL = {
  reference: "w-[6.5rem]",
  order: "min-w-[12rem]",
  type: "w-[5.5rem]",
  client: "w-[7.5rem] max-w-[7.5rem]",
  createdAt: "w-[5rem] whitespace-nowrap",
  deliveryDate: "w-[7.5rem] whitespace-nowrap",
  status: "w-[7rem]",
  driver: "w-[10rem]",
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

/** Nom du client tel quel : la colonne dit déjà « Client », pas besoin du préfixe. */
function plainClientName(order: Pick<CompanyOrder, "customer" | "customerEmail">): string {
  const name = order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : "";
  return name || order.customerEmail?.trim() || "Client non renseigné";
}

/**
 * Une commande se reconnaît à son client et à son adresse ; la référence reste en
 * petit dessous, pour la recherche et les échanges avec le support.
 */
export function TableOrderCell({ order }: { order: CompanyOrder }) {
  const client = plainClientName(order);
  const place = formatPlace(order.shippingAddress ?? order.pickupAddress, order.shippingCity);
  return (
    <Link
      href={`/dashboard/orders/${order.id}`}
      className="group block min-w-0 rounded-md py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
    >
      <span className="block truncate font-medium text-foreground group-hover:underline" title={client}>
        {client}
      </span>
      {place && (
        <span className="block truncate text-xs text-muted-foreground" title={place}>
          {place}
        </span>
      )}
      <span className="block truncate text-xs tabular-nums text-muted-foreground">{order.reference}</span>
    </Link>
  );
}

export function TableRelativeDateCell({ date }: { date: string }) {
  return (
    <time dateTime={date} title={fullDateLabel(date)} className="whitespace-nowrap text-muted-foreground">
      {relativeDayLabel(date)}
    </time>
  );
}

/** Échéance demandée ; un retard se voit sans lire la date (texte + icône, pas la couleur seule). */
export function TableDeliveryDueCell({ order }: { order: CompanyOrder }) {
  const date = order.requestedDeliveryDate;
  if (!date) return <span className="text-muted-foreground">—</span>;
  const late = isOrderOverdue(order.status, date);
  return (
    <div className="whitespace-nowrap">
      <time dateTime={date} title={fullDateLabel(date)} className={late ? "font-medium text-[#b3352a]" : undefined}>
        {relativeDayLabel(date, undefined, { withTime: true })}
      </time>
      {late && (
        <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[#b3352a]">
          <Clock className="h-3 w-3" aria-hidden="true" />
          En retard
        </span>
      )}
    </div>
  );
}
