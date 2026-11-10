"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { ProductThumb } from "@/features/catalog/product-thumb";
import { useCancelOrder, usePortalCatalog, usePortalOrder } from "@/features/ordering/hooks";
import { ReorderDialog } from "@/features/ordering/reorder-dialog";
import { useOrderActions } from "@/features/ordering/use-order-actions";
import { ORDER_ORIGIN_LABELS } from "@/lib/constants/order-status";
import { deadlineLabel, longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { capitalize } from "@/lib/utils";

const t = fr.order;

/** Détail d'une commande du client (CLI-06, CLI-07, CLI-08). */
export function OrderDetail({ orderId }: { orderId: string }) {
  const order = usePortalOrder(orderId);
  const catalog = usePortalCatalog();
  const cancel = useCancelOrder();
  const actions = useOrderActions();
  const [reordering, setReordering] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const timeZone = catalog.data?.rules.timeZone ?? "Europe/Paris";

  if (order.isLoading) return <PageSkeleton />;
  if (order.error || !order.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="destructive"><AlertDescription>{order.error instanceof Error ? order.error.message : t.errors.notFound}</AlertDescription></Alert>
      </div>
    );
  }
  const data = order.data;

  return (
    <div className="space-y-5">
      <BackLink />
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{capitalize(longDeliveryDateLabel(data.deliveryDate))}</h1>
          <OrderStatusBadge status={data.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {data.slot.label} · {data.reference} · {ORDER_ORIGIN_LABELS[data.origin]}
        </p>
        <p className="text-sm" data-testid="order-deadline">
          {data.editable
            ? t.editableUntil(deadlineLabel(data.cutoffAt, timeZone))
            : data.status === "CANCELLED"
              ? t.cancelled
              : t.lockedSince(deadlineLabel(data.cutoffAt, timeZone))}
        </p>
      </header>

      <ul className="divide-y rounded-2xl border bg-card px-3" aria-label="Lignes de la commande">
        {data.lines.map((line) => (
          <li key={line.productId} className="flex items-center gap-3 py-3" data-testid={`order-line-${line.name}`}>
            <ProductThumb productId={line.productId} photoVersion={line.photoVersion} className="h-12 w-12 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{line.name}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatCents(line.unitPriceCents)} {fr.common.exclVat} · {line.unit}
                {line.available ? "" : " · plus proposé"}
              </p>
              {line.promoQuantity > 0 && line.promoUnitPriceCents !== null ? (
                <p className="text-xs text-warning tabular-nums" data-testid="order-line-promo">
                  {fr.promotions.badge} · {line.promoQuantity < line.quantity ? fr.promotions.promoUnits(line.promoQuantity) : `× ${line.quantity}`} à {formatCents(line.promoUnitPriceCents)}
                </p>
              ) : null}
            </div>
            <div className="text-right text-sm tabular-nums">
              <p className="font-semibold">× {line.quantity}</p>
              <p className="text-muted-foreground">{formatCents(line.lineTotalCents)}</p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="space-y-1 rounded-2xl border bg-card p-4 text-sm tabular-nums">
        <div className="flex justify-between"><dt className="text-muted-foreground">{t.subtotal}</dt><dd>{formatCents(data.subtotalCents)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">{t.vat}</dt><dd>{formatCents(data.vatCents)}</dd></div>
        <div className="flex justify-between text-base font-semibold"><dt>{t.total}</dt><dd>{formatCents(data.totalCents)}</dd></div>
      </dl>

      {confirmCancel ? (
        <div className="space-y-2 rounded-2xl border p-4">
          <p className="text-sm">{t.cancelConfirm}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="touch" className="flex-1" onClick={() => setConfirmCancel(false)}>{t.keepOrder}</Button>
            <Button
              variant="destructive" size="touch" className="flex-1" loading={cancel.isPending}
              onClick={() => cancel.mutate(data.id, {
                onSuccess: () => { toast.success(t.cancelled); setConfirmCancel(false); void order.refetch(); },
                onError: (error) => toast.error(error.message),
              })}
            >
              {t.cancelOrder}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          {data.editable ? (
            <Button variant="brand" size="touch" className="rounded-full" onClick={() => actions.edit(data.id)}>{fr.common.edit}</Button>
          ) : null}
          <Button variant={data.editable ? "outline" : "brand"} size="touch" className="rounded-full" onClick={() => setReordering(true)}>{t.reorder}</Button>
          <Button variant="outline" size="touch" className="rounded-full" onClick={() => actions.toCart(data.id)}>{t.toCart}</Button>
          <Button asChild variant="ghost" size="touch" className="rounded-full">
            <Link href={`/portal/recurring?from=${encodeURIComponent(data.id)}`}><Repeat /> {t.makeRecurring}</Link>
          </Button>
          {data.editable ? (
            <Button variant="ghost" size="touch" className="rounded-full text-destructive" onClick={() => setConfirmCancel(true)}>{t.cancelOrder}</Button>
          ) : null}
        </div>
      )}

      <ReorderDialog order={reordering ? data : null} onOpenChange={(open) => setReordering(open)} />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/portal/orders" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {t.backToOrders}
    </Link>
  );
}
