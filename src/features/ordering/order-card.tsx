"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PortalOrderSummary } from "@/domains/order/merchant-order.types";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { deadlineLabel, longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { capitalize } from "@/lib/utils";

const t = fr.order;

interface OrderCardProps {
  order: PortalOrderSummary;
  timeZone: string;
  onReorder: (order: PortalOrderSummary) => void;
  onToCart: (id: string) => void;
  onEdit: (id: string) => void;
}

/** Une commande de l'historique ou à venir (CLI-07) et ses actions (CLI-06, CLI-08). */
export function OrderCard({ order, timeZone, onReorder, onToCart, onEdit }: OrderCardProps) {
  return (
    <li className="rounded-2xl border bg-card p-4 shadow-sm" data-testid={`order-card-${order.reference}`}>
      <Link href={`/portal/orders/${order.id}`} className="group flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{capitalize(longDeliveryDateLabel(order.deliveryDate))}</p>
          <p className="text-sm text-muted-foreground">
            {order.slot.label} · {order.reference}
          </p>
          <p className="mt-1 text-sm tabular-nums">
            {t.lines(order.lineCount)} · {t.items(order.itemCount)} · {formatCents(order.subtotalCents)} {fr.common.exclVat}
          </p>
          {order.editable ? (
            <p className="mt-1 text-xs text-muted-foreground">{t.editableUntil(deadlineLabel(order.cutoffAt, timeZone))}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <OrderStatusBadge status={order.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="brand" size="touch" className="rounded-full" onClick={() => onReorder(order)}>
          {t.reorder}
        </Button>
        {order.editable ? (
          <Button variant="outline" size="touch" className="rounded-full" onClick={() => onEdit(order.id)}>
            {fr.common.edit}
          </Button>
        ) : (
          <Button variant="outline" size="touch" className="rounded-full" onClick={() => onToCart(order.id)}>
            {t.toCart}
          </Button>
        )}
      </div>
    </li>
  );
}
