"use client";

import { useState } from "react";
import Link from "next/link";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import type { OrderTotals } from "@/domains/catalog/pricing";
import type { PortalCatalog, PortalOrderDetail } from "@/domains/order/merchant-order.types";
import { PortalApiError } from "@/features/ordering/api";
import { useCartStore } from "@/features/ordering/cart-store";
import { useCancelOrder, useSaveOrder } from "@/features/ordering/hooks";
import { QuantityStepper } from "@/features/ordering/quantity-stepper";
import type { CartLine } from "@/features/ordering/use-cart-lines";
import { useMediaQuery } from "@/hooks/use-media-query";
import { deadlineLabel, longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

const t = fr.order;

interface CartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: PortalCatalog;
  lines: CartLine[];
  totals: OrderTotals;
  unavailable: number;
  existing: PortalOrderDetail | null;
  onSaved: (orderId: string) => void;
}

/** CLI-04 / CLI-06 : panier récapitulatif modifiable, validation, modification ou annulation. */
export function CartSheet({ open, onOpenChange, catalog, lines, totals, unavailable, existing, onSaved }: CartSheetProps) {
  const desktop = useMediaQuery("(min-width: 768px)");
  const cart = useCartStore();
  const save = useSaveOrder();
  const cancel = useCancelOrder();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slot = catalog.slots.find((item) => item.id === cart.slotId);
  const locked = Boolean(existing && !existing.editable);

  const submit = () => {
    if (!cart.deliveryDate || !cart.slotId) return setError(t.chooseSlot);
    if (lines.length === 0) return setError(t.errors.emptyOrder);
    setError(null);
    save.mutate(
      { deliveryDate: cart.deliveryDate, slotId: cart.slotId, lines: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) },
      {
        onSuccess: (order) => {
          toast.success(existing ? t.updated : t.validated, { description: `${order.reference} · ${longDeliveryDateLabel(order.deliveryDate)}` });
          cart.clear();
          onOpenChange(false);
          onSaved(order.id);
        },
        onError: (mutationError) => setError(mutationError instanceof PortalApiError ? mutationError.message : fr.common.genericError),
      }
    );
  };

  const cancelOrder = () => {
    if (!existing) return;
    cancel.mutate(existing.id, {
      onSuccess: () => {
        toast.success(t.cancelled);
        cart.clear();
        setConfirmCancel(false);
        onOpenChange(false);
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  return (
    <Drawer open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) { setConfirmCancel(false); setError(null); } }}>
      <DrawerContent side={desktop ? "right" : "bottom"} className="flex flex-col gap-0 p-0 md:w-[28rem] md:max-w-[28rem]">
        <DrawerHeader className="border-b px-5 pb-4 pt-5">
          <DrawerTitle>{t.cart}</DrawerTitle>
          <DrawerDescription>
            {cart.deliveryDate ? longDeliveryDateLabel(cart.deliveryDate) : t.deliveryDate} · {slot?.label ?? t.chooseSlot}
            {existing ? (
              <>
                <br />
                {existing.reference} · {existing.editable ? t.editableUntil(deadlineLabel(existing.cutoffAt, catalog.rules.timeZone)) : t.lockedOrder}
              </>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5">
          {lines.length === 0 ? (
            <div className="py-10 text-center text-sm">
              <p className="font-medium">{t.cartEmpty}</p>
              <p className="mt-1 text-muted-foreground">{t.cartEmptyHint}</p>
            </div>
          ) : (
            <ul className="divide-y" aria-label={t.cart}>
              {lines.map((line) => (
                <li key={line.product.id} className="flex items-center gap-3 py-3" data-testid={`cart-line-${line.product.name}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug">{line.product.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatCents(line.product.unitPriceCents)} × {line.quantity} = <span className="font-semibold text-foreground">{formatCents(line.lineTotalCents)}</span>
                    </p>
                  </div>
                  <QuantityStepper
                    productName={line.product.name}
                    value={line.quantity}
                    onChange={(value) => cart.setQuantity(line.product.id, value)}
                    disabled={locked}
                  />
                </li>
              ))}
            </ul>
          )}
          {unavailable > 0 ? <p className="pb-3 text-xs text-muted-foreground">{t.unavailableProducts(unavailable)}</p> : null}
        </div>

        <div className="space-y-3 border-t px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <dl className="space-y-1 text-sm tabular-nums">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t.subtotal}</dt><dd>{formatCents(totals.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t.vat}</dt><dd>{formatCents(totals.vatCents)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>{t.total}</dt><dd data-testid="cart-total">{formatCents(totals.totalCents)}</dd></div>
          </dl>
          {error ? (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          ) : null}
          {confirmCancel && existing ? (
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-sm">{t.cancelConfirm}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="touch" className="flex-1" onClick={() => setConfirmCancel(false)}>{t.keepOrder}</Button>
                <Button variant="destructive" size="touch" className="flex-1" loading={cancel.isPending} onClick={cancelOrder}>{t.cancelOrder}</Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="brand" size="lg" className="w-full rounded-full" loading={save.isPending} disabled={locked || lines.length === 0} onClick={submit}>
                {existing ? t.saveChanges : t.validate}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {existing?.editable ? (
                  <Button variant="ghost" size="touch" className="text-destructive" onClick={() => setConfirmCancel(true)}>{t.cancelOrder}</Button>
                ) : <span />}
                {lines.length > 0 ? (
                  <Button asChild variant="ghost" size="touch">
                    <Link href="/portal/recurring?from=cart" onClick={() => onOpenChange(false)}><Repeat /> {t.makeRecurring}</Link>
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
