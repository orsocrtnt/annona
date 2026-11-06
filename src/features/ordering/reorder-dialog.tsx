"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeTotals } from "@/domains/catalog/pricing";
import type { PortalOrderSummary } from "@/domains/order/merchant-order.types";
import { PortalApiError } from "@/features/ordering/api";
import { DateSlotPicker } from "@/features/ordering/date-slot-picker";
import { usePortalCatalog, usePortalOrder, useReorder } from "@/features/ordering/hooks";
import { longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

const t = fr.order;

interface ReorderDialogProps {
  order: Pick<PortalOrderSummary, "id" | "deliveryDate" | "slot"> | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * CLI-08 / ENF-03 (critère 1) : recopie à l'identique en deux appuis — « Recommander », puis
 * « Valider la commande » — pour la première date ouverte et le même créneau, modifiables ici.
 */
export function ReorderDialog({ order, onOpenChange }: ReorderDialogProps) {
  const router = useRouter();
  const catalog = usePortalCatalog();
  const detail = usePortalOrder(order?.id ?? null);
  const reorder = useReorder();
  const [date, setDate] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; existingId?: string } | null>(null);

  const rules = catalog.data?.rules;
  const slots = catalog.data?.slots;
  useEffect(() => {
    if (!order || !rules || !slots) return;
    setDate(rules.firstOpenDate);
    setSlotId(slots.some((slot) => slot.id === order.slot.id) ? order.slot.id : slots[0]?.id ?? null);
    setError(null);
  }, [order, rules, slots]);

  const available = (detail.data?.lines ?? []).filter((line) => line.available);
  const dropped = (detail.data?.lines.length ?? 0) - available.length;
  const totals = computeTotals(available.map((line) => ({ quantity: line.quantity, unitPriceCents: line.currentUnitPriceCents, vatRateBasisPoints: line.vatRateBasisPoints })));

  const submit = () => {
    if (!order || !date || !slotId) return;
    setError(null);
    reorder.mutate(
      { id: order.id, deliveryDate: date, slotId },
      {
        onSuccess: (created) => {
          toast.success(t.reorderDone, { description: `${created.reference} · ${longDeliveryDateLabel(created.deliveryDate)}` });
          onOpenChange(false);
          router.push(`/portal/orders/${created.id}?saved=1`);
        },
        onError: (mutationError) => {
          if (mutationError instanceof PortalApiError && mutationError.code === "ORDER_EXISTS") {
            setError({ message: mutationError.message, existingId: String(mutationError.details?.orderId ?? "") });
          } else setError({ message: mutationError.message });
        },
      }
    );
  };

  return (
    <Dialog open={Boolean(order)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle>{t.reorderTitle}</DialogTitle>
          <DialogDescription>
            {order ? `${longDeliveryDateLabel(order.deliveryDate)} · ${order.slot.label}. ` : ""}
            {t.reorderHint}
          </DialogDescription>
        </DialogHeader>
        {catalog.data && date ? (
          <DateSlotPicker
            rules={catalog.data.rules}
            slots={catalog.data.slots}
            date={date}
            slotId={slotId}
            onDate={setDate}
            onSlot={setSlotId}
            idPrefix="reorder"
          />
        ) : null}
        <div className="rounded-xl bg-muted px-4 py-3 text-sm" data-testid="reorder-summary">
          {detail.isLoading ? (
            <p className="text-muted-foreground">…</p>
          ) : (
            <>
              <p className="font-medium">
                {t.lines(available.length)} · {t.items(totals.itemCount)}
              </p>
              <p className="tabular-nums text-muted-foreground">
                {formatCents(totals.subtotalCents)} {fr.common.exclVat} · {formatCents(totals.totalCents)} {fr.common.inclVat}
              </p>
              {dropped > 0 ? <p className="mt-1 text-xs text-muted-foreground">{t.unavailableProducts(dropped)}</p> : null}
            </>
          )}
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error.message}
              {error.existingId ? (
                <Button
                  type="button" variant="link" className="ml-1 h-auto p-0"
                  onClick={() => { onOpenChange(false); router.push(`/portal/orders/${error.existingId}`); }}
                >
                  {t.openExisting}
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" size="touch" onClick={() => onOpenChange(false)}>{fr.common.cancel}</Button>
          <Button variant="brand" size="touch" loading={reorder.isPending} disabled={!date || !slotId || available.length === 0} onClick={submit}>
            {t.validate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
