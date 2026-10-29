import { Badge } from "@/components/ui/badge";
import type {
  DeliveryCategory,
  OrderStatus,
  DeliveryStatus,
  InvoiceStatus,
  SupportTicketStatus,
} from "@prisma/client";
import { getFulfillmentStatusLabel } from "@/lib/constants/order-status";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-status";

const ORDER_VARIANTS: Record<OrderStatus, "success" | "brand" | "warning" | "secondary" | "error"> = {
  QUOTE_REQUESTED: "warning",
  PENDING: "secondary",
  ASSIGNED: "brand",
  PURCHASING: "warning",
  IN_DELIVERY: "brand",
  DELIVERED: "success",
  INVOICED: "warning",
  PAID: "success",
  CANCELLED: "error",
  FAILED: "error",
};

const DELIVERY_VARIANTS: Record<DeliveryStatus, "success" | "brand" | "warning" | "secondary" | "error"> = {
  PENDING: "secondary",
  ASSIGNED: "brand",
  PURCHASING: "warning",
  IN_DELIVERY: "brand",
  DELIVERED: "success",
  INVOICED: "warning",
  PAID: "success",
  CANCELLED: "error",
  FAILED: "error",
};

const INVOICE_VARIANTS: Record<InvoiceStatus, "success" | "brand" | "warning" | "secondary" | "error"> = {
  PAID: "success",
  PENDING: "warning",
  OVERDUE: "error",
  DRAFT: "secondary",
  CANCELLED: "error",
};

export function OrderStatusBadge({
  status,
  deliveryCategory,
}: {
  status: OrderStatus;
  deliveryCategory?: DeliveryCategory | null;
}) {
  return (
    <Badge variant={ORDER_VARIANTS[status]}>
      {getFulfillmentStatusLabel(status, deliveryCategory)}
    </Badge>
  );
}

export function DeliveryStatusBadge({
  status,
  deliveryCategory,
}: {
  status: DeliveryStatus;
  deliveryCategory?: DeliveryCategory | null;
}) {
  return (
    <Badge variant={DELIVERY_VARIANTS[status]}>
      {getFulfillmentStatusLabel(status, deliveryCategory)}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status, daysOverdue = 0 }: { status: InvoiceStatus; daysOverdue?: number }) {
  const label = status === "OVERDUE" && daysOverdue > 0 ? `En retard · ${daysOverdue} j` : INVOICE_STATUS_LABELS[status];
  return <Badge variant={INVOICE_VARIANTS[status]}>{label}</Badge>;
}

const TICKET_LABELS: Record<SupportTicketStatus, string> = {
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  CLOSED: "Fermé",
};

export function TicketStatusBadge({ status }: { status: SupportTicketStatus }) {
  const variants: Record<SupportTicketStatus, "brand" | "warning" | "success" | "secondary"> = {
    OPEN: "brand",
    IN_PROGRESS: "warning",
    RESOLVED: "success",
    CLOSED: "secondary",
  };
  return <Badge variant={variants[status]}>{TICKET_LABELS[status]}</Badge>;
}
