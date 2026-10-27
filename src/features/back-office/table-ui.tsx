import Link from "next/link";
import type { DeliveryCategory } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatClientFromParts, formatDriverFromParts } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { formatPlace } from "@/lib/format/place";
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { TableDueCell, TableIdentityCell, TableRelativeDateCell } from "@/components/shared/table-cells";
import { driverDaySegments, driverDaySentence, type DriverDay } from "@/lib/dispatch/workload-bars";
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
export function plainClientName(order: {
  customer?: { firstName: string; lastName: string } | null;
  customerEmail?: string | null;
}): string {
  const name = order.customer ? `${order.customer.firstName} ${order.customer.lastName}`.trim() : "";
  return name || order.customerEmail?.trim() || "Client non renseigné";
}

export function TableOrderCell({ order }: { order: CompanyOrder }) {
  return (
    <TableIdentityCell
      href={`/dashboard/orders/${order.id}`}
      title={plainClientName(order)}
      subtitle={formatPlace(order.shippingAddress ?? order.pickupAddress, order.shippingCity)}
      reference={order.reference}
    />
  );
}

export function TableDeliveryDueCell({ order }: { order: CompanyOrder }) {
  return <TableDueCell status={order.status} date={order.requestedDeliveryDate} />;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Une personne : initiales, nom (lien), et un moyen de la joindre en dessous. */
export function TablePersonCell({ href, name, detail }: { href: string; name: string; detail?: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef4f0] text-xs font-semibold text-foreground"
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <Link
          href={href}
          className="block truncate rounded font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
        >
          {name}
        </Link>
        {detail && (
          <span className="block truncate text-xs text-muted-foreground" title={detail}>
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

/** Dernière connexion en jours relatifs ; « Jamais » plutôt qu'un tiret. */
export function TableLastSeenCell({ date }: { date?: string | null }) {
  if (!date) return <span className="text-muted-foreground">Jamais</span>;
  return (
    <time dateTime={date} title={fullDateLabel(date)} className="whitespace-nowrap text-muted-foreground">
      {relativeDayLabel(date, undefined, { withTime: true })}
    </time>
  );
}

/** Journée d'un livreur : barre livrées / en cours / à faire, et la même chose en mots. */
export function TableDriverDayCell({ day, actions }: { day: DriverDay; actions?: number }) {
  const segments = driverDaySegments(day);
  return (
    <div className="min-w-[10rem]">
      <p className="text-sm text-foreground">{driverDaySentence(day)}</p>
      {segments.total > 0 && (
        <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[#eef1ef]" aria-hidden="true">
          <span className="h-full bg-[#0e1310]" style={{ width: `${segments.delivered}%` }} />
          <span className="h-full bg-[#00a855]" style={{ width: `${segments.inTransit}%` }} />
          <span className="h-full bg-[#c9d3cd]" style={{ width: `${segments.toDo}%` }} />
        </div>
      )}
      {actions ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {actions} action{actions > 1 ? "s" : ""} enregistrée{actions > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}

export { TableDueCell, TableIdentityCell, TableRelativeDateCell };
