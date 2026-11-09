"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { PortalCatalog, PortalRecurringOrder } from "@/domains/order/merchant-order.types";
import { orderingApi } from "@/features/ordering/api";
import { useCartStore } from "@/features/ordering/cart-store";
import { useDeleteRecurring, usePortalCatalog, useRecurringOrders, useSaveRecurring } from "@/features/ordering/hooks";
import { QuantityStepper } from "@/features/ordering/quantity-stepper";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.recurring;

type Draft = {
  id: string | null;
  label: string;
  slotId: string | null;
  weekdays: number[];
  quantities: Record<string, number>;
  active: boolean;
};

function weekdaysLabel(weekdays: number[]) {
  if (weekdays.length === 7) return "Tous les jours";
  return weekdays.map((day) => t.weekdayShort[day - 1]).join(", ");
}

/** CLI-09 : commandes récurrentes (commande type, jours, créneau ; activer, suspendre, modifier). */
export function RecurringContent() {
  const router = useRouter();
  const params = useSearchParams();
  const list = useRecurringOrders();
  const catalog = usePortalCatalog();
  const save = useSaveRecurring();
  const remove = useDeleteRecurring();
  const [draft, setDraft] = useState<Draft | null>(null);

  const emptyDraft = (quantities: Record<string, number> = {}, slotId?: string | null): Draft => ({
    id: null,
    label: "",
    slotId: slotId ?? catalog.data?.slots[0]?.id ?? null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    quantities,
    active: true,
  });

  // Création depuis le panier (`?from=cart`) ou depuis une commande (`?from=<id>`).
  const from = params.get("from");
  useEffect(() => {
    if (!from || !catalog.data) return;
    router.replace("/portal/recurring", { scroll: false });
    if (from === "cart") {
      const cart = useCartStore.getState();
      setDraft(emptyDraft({ ...cart.quantities }, cart.slotId));
      return;
    }
    orderingApi
      .order(from)
      .then((order) =>
        setDraft(emptyDraft(Object.fromEntries(order.lines.filter((line) => line.available).map((line) => [line.productId, line.quantity])), order.slot.id))
      )
      .catch((error: Error) => toast.error(error.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, catalog.data]);

  if (list.isLoading || catalog.isLoading) return <PageSkeleton />;

  const toggleActive = (row: PortalRecurringOrder) =>
    save.mutate(
      { id: row.id, input: { active: !row.active } },
      { onSuccess: () => toast.success(row.active ? t.suspended : t.active), onError: (error) => toast.error(error.message) }
    );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="brand" size="touch" className="rounded-full" onClick={() => setDraft(emptyDraft())} disabled={!catalog.data}>
          <Plus /> {t.create}
        </Button>
      </div>

      {list.error ? <Alert variant="destructive"><AlertDescription>{list.error.message}</AlertDescription></Alert> : null}

      {(list.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-6 text-center text-sm">
          <p className="font-medium">{t.empty}</p>
          <p className="mt-1 text-muted-foreground">{t.emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {(list.data ?? []).map((row) => (
            <li key={row.id} className="rounded-2xl border bg-card p-4 shadow-sm" data-testid="recurring-card">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.label || weekdaysLabel(row.weekdays)}</p>
                  <p className="text-sm text-muted-foreground">{row.label ? `${weekdaysLabel(row.weekdays)} · ${row.slot.label}` : row.slot.label}</p>
                  <p className="mt-1 text-sm tabular-nums">
                    {fr.order.lines(row.lines.length)} · {formatCents(row.subtotalCents)} {fr.common.exclVat}
                  </p>
                </div>
                <Badge variant={row.active ? "success" : "secondary"}>{row.active ? t.active : t.suspended}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 pr-2">
                  <Switch id={`rec-${row.id}`} checked={row.active} onCheckedChange={() => toggleActive(row)} aria-label={row.active ? t.suspend : t.resume} />
                  <Label htmlFor={`rec-${row.id}`} className="text-sm">{row.active ? t.active : t.suspended}</Label>
                </div>
                <Button
                  variant="outline" size="touch" className="rounded-full"
                  onClick={() => setDraft({
                    id: row.id,
                    label: row.label ?? "",
                    slotId: row.slot.id,
                    weekdays: row.weekdays,
                    quantities: Object.fromEntries(row.lines.filter((line) => line.available).map((line) => [line.productId, line.quantity])),
                    active: row.active,
                  })}
                >
                  <Pencil /> {fr.common.edit}
                </Button>
                <Button
                  variant="ghost" size="touch" className="rounded-full text-destructive"
                  onClick={() => { if (window.confirm(t.deleteConfirm)) remove.mutate(row.id, { onSuccess: () => toast.success(t.deleted), onError: (error) => toast.error(error.message) }); }}
                >
                  <Trash2 /> {fr.common.delete}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">{t.generationNote}</p>

      {catalog.data ? (
        <RecurringEditor
          draft={draft}
          catalog={catalog.data}
          saving={save.isPending}
          onClose={() => setDraft(null)}
          onSave={(value) => {
            const lines = Object.entries(value.quantities).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
            save.mutate(
              { id: value.id, input: { label: value.label.trim() || null, slotId: value.slotId!, weekdays: value.weekdays, lines, active: value.active } },
              { onSuccess: () => { toast.success(t.saved); setDraft(null); }, onError: (error) => toast.error(error.message) }
            );
          }}
        />
      ) : null}
    </div>
  );
}

interface RecurringEditorProps {
  draft: Draft | null;
  catalog: PortalCatalog;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: Draft) => void;
}

function RecurringEditor({ draft, catalog, saving, onClose, onSave }: RecurringEditorProps) {
  const [value, setValue] = useState<Draft | null>(draft);
  const [picker, setPicker] = useState("");
  useEffect(() => setValue(draft), [draft]);

  const products = useMemo(() => new Map(catalog.categories.flatMap((category) => category.products.map((product) => [product.id, product] as const))), [catalog]);
  if (!value) return <Dialog open={false} />;

  const lines = Object.entries(value.quantities).filter(([id]) => products.has(id));
  const subtotal = lines.reduce((sum, [id, quantity]) => sum + quantity * products.get(id)!.unitPriceCents, 0);
  const valid = Boolean(value.slotId) && value.weekdays.length > 0 && lines.some(([, quantity]) => quantity > 0);

  const toggleDay = (day: number) =>
    setValue({ ...value, weekdays: value.weekdays.includes(day) ? value.weekdays.filter((item) => item !== day) : [...value.weekdays, day].sort() });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto overflow-x-hidden sm:max-w-lg [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="pr-8">{value.id ? t.edit : t.create}</DialogTitle>
          <DialogDescription>{t.generationNote}</DialogDescription>
        </DialogHeader>
        <FormField label={t.label}>
          <Input value={value.label} onChange={(event) => setValue({ ...value, label: event.target.value })} maxLength={80} />
        </FormField>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold">{t.weekdays}</legend>
          <div className="flex flex-wrap gap-2">
            {t.weekdayShort.map((short, index) => {
              const day = index + 1;
              const on = value.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  aria-label={t.weekdayLong[index]}
                  onClick={() => toggleDay(day)}
                  className={cn(
                    "min-h-11 min-w-11 rounded-full border px-3 text-sm font-medium",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                  )}
                >
                  {short}
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="min-w-0">
          <legend className="mb-2 text-sm font-semibold">{fr.order.slot}</legend>
          {catalog.slots.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="recurring-no-slot">{fr.order.noSlot}</p> : null}
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {catalog.slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                role="radio"
                aria-checked={value.slotId === slot.id}
                onClick={() => setValue({ ...value, slotId: slot.id })}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-medium",
                  value.slotId === slot.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>
        </fieldset>
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t.products}</h3>
          {lines.length === 0 ? <p className="text-sm text-muted-foreground">{fr.order.cartEmptyHint}</p> : null}
          <ul className="divide-y rounded-xl border px-3">
            {lines.map(([id, quantity]) => {
              const product = products.get(id)!;
              return (
                <li key={id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatCents(product.unitPriceCents)} · {product.unit}</p>
                  </div>
                  <QuantityStepper
                    productName={product.name}
                    value={quantity}
                    onChange={(next) => {
                      const quantities = { ...value.quantities };
                      if (next === 0) delete quantities[id];
                      else quantities[id] = next;
                      setValue({ ...value, quantities });
                    }}
                  />
                </li>
              );
            })}
          </ul>
          <Select
            value={picker}
            onValueChange={(id) => {
              setPicker("");
              if (!value.quantities[id]) setValue({ ...value, quantities: { ...value.quantities, [id]: 1 } });
            }}
          >
            <SelectTrigger aria-label={t.addProduct}>
              <SelectValue placeholder={t.addProduct} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {catalog.categories.map((category) => (
                <SelectGroup key={category.id}>
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{category.name}</p>
                  {category.products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <p className="text-right text-sm tabular-nums">{fr.order.subtotal} : {formatCents(subtotal)}</p>
        </section>
        <div className="flex items-center gap-3">
          <Switch id="recurring-active" checked={value.active} onCheckedChange={(active) => setValue({ ...value, active })} />
          <Label htmlFor="recurring-active">{value.active ? t.active : t.suspended}</Label>
        </div>
        {!valid && catalog.slots.length > 0 ? <p className="text-sm text-muted-foreground" data-testid="recurring-incomplete">{t.incomplete}</p> : null}
        <DialogFooter className="gap-2">
          <Button variant="outline" size="touch" onClick={onClose}>{fr.common.cancel}</Button>
          <Button variant="brand" size="touch" loading={saving} disabled={!valid} onClick={() => onSave(value)}>{fr.common.save}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
