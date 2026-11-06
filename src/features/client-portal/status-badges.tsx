import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus, OrderStatus, SupportTicketStatus } from "@prisma/client";
import { ORDER_STATUS_LABELS } from "@/lib/constants/order-status";
import { INVOICE_STATUS_LABELS } from "@/lib/constants/invoice-status";

type Variant = "success" | "brand" | "warning" | "secondary" | "error";

const ORDER_VARIANTS: Record<OrderStatus, Variant> = {
  DRAFT: "secondary",
  VALIDATED: "brand",
  LOCKED: "warning",
  PREPARED: "brand",
  DELIVERED: "success",
  CANCELLED: "error",
};

const INVOICE_VARIANTS: Record<InvoiceStatus, Variant> = {
  PAID: "success",
  PENDING: "warning",
  OVERDUE: "error",
  DRAFT: "secondary",
  CANCELLED: "error",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={ORDER_VARIANTS[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
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
