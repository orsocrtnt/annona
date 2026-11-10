"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { promotionPriceCents } from "@/domains/catalog/promotion";
import { useMerchantChoices, useProducts } from "@/features/catalog/hooks";
import { useCreatePromotion } from "@/features/promotions/hooks";
import { nameMatches } from "@/lib/format/search";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";
import { createPromotionSchema, parseEurosToCents } from "@/lib/validations/catalog";

const t = fr.promotions;

type Kind = "PERCENT" | "PRICE";
type Audience = "ALL" | "SOME";

interface FormState {
  productId: string;
  kind: Kind;
  percent: string;
  price: string;
  endsOn: string;
  quantityLimit: string;
  audience: Audience;
  merchantIds: string[];
}

const EMPTY: FormState = { productId: "", kind: "PERCENT", percent: "", price: "", endsOn: "", quantityLimit: "", audience: "ALL", merchantIds: [] };

/** Date du jour du navigateur, « AAAA-MM-JJ » (borne du sélecteur ; le serveur revérifie). */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Choix en deux boutons (type de promotion, clients visés). */
function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={cn("min-h-9 rounded-md px-3 text-sm", value === option.value ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Lot 1, demande 2 : création d'une promotion par l'administrateur. */
export function PromotionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const products = useProducts();
  const merchants = useMerchantChoices(open);
  const create = useCreatePromotion();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [merchantQuery, setMerchantQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setMerchantQuery("");
      setError(null);
    }
  }, [open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const product = products.data?.find((row) => row.id === form.productId) ?? null;
  const preview = useMemo(() => {
    if (!product) return null;
    const percent = Number(form.percent);
    const price = parseEurosToCents(form.price);
    if (form.kind === "PERCENT" && Number.isInteger(percent) && percent >= 1 && percent <= 99) {
      return promotionPriceCents({ promoPriceCents: null, discountPercent: percent }, product.basePriceCents);
    }
    return form.kind === "PRICE" ? price : null;
  }, [product, form.kind, form.percent, form.price]);

  const visibleMerchants = useMemo(() => {
    return (merchants.data ?? []).filter(
      (merchant) => merchant.active && (nameMatches(merchant.name, merchantQuery) || nameMatches(merchant.legalName, merchantQuery))
    );
  }, [merchants.data, merchantQuery]);

  const toggleMerchant = (id: string) =>
    set("merchantIds", form.merchantIds.includes(id) ? form.merchantIds.filter((value) => value !== id) : [...form.merchantIds, id]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = form.quantityLimit.trim() ? Number(form.quantityLimit.trim()) : null;
    const price = parseEurosToCents(form.price);
    if (form.kind === "PRICE" && form.price.trim() && price === null) return setError("Saisissez un prix, par exemple 0,80.");
    const parsed = createPromotionSchema.safeParse({
      productId: form.productId,
      promoPriceCents: form.kind === "PRICE" ? price : null,
      discountPercent: form.kind === "PERCENT" ? (form.percent.trim() ? Number(form.percent.trim().replace(",", ".")) : null) : null,
      endsOn: form.endsOn,
      quantityLimit: quantity,
      allMerchants: form.audience === "ALL",
      merchantIds: form.audience === "SOME" ? form.merchantIds : [],
    });
    if (!form.productId) return setError(t.chooseProduct);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Vérifiez la saisie.");
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: () => {
        toast.success(t.created);
        onOpenChange(false);
      },
      onError: (mutationError) => setError(mutationError.message),
    });
  };

  const choosable = (products.data ?? []).filter((row) => row.active && row.categoryActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl" data-testid="promotion-dialog">
        <DialogHeader>
          <DialogTitle>{t.newPromotion}</DialogTitle>
          <DialogDescription>{t.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField label={t.product} required>
            <Select value={form.productId} onValueChange={(value) => set("productId", value)}>
              <SelectTrigger aria-label={t.product} data-testid="promotion-product">
                <SelectValue placeholder={t.chooseProduct} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {choosable.map((row) => (
                  <SelectItem key={row.id} value={row.id}>{row.name} · {formatCents(row.basePriceCents)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t.kind}</p>
            <Choice
              label={t.kind}
              value={form.kind}
              onChange={(value) => set("kind", value)}
              options={[{ value: "PERCENT", label: t.kindPercent }, { value: "PRICE", label: t.kindPrice }]}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {form.kind === "PERCENT" ? (
              <FormField label={t.discount} required>
                <Input inputMode="numeric" value={form.percent} onChange={(event) => set("percent", event.target.value)} placeholder="30" data-testid="promotion-percent" />
              </FormField>
            ) : (
              <FormField label={t.promoPrice} required>
                <Input inputMode="decimal" value={form.price} onChange={(event) => set("price", event.target.value)} placeholder="0,80" data-testid="promotion-price" />
              </FormField>
            )}
            <FormField label={t.endsOn} required>
              <Input type="date" min={localToday()} value={form.endsOn} onChange={(event) => set("endsOn", event.target.value)} data-testid="promotion-ends-on" />
            </FormField>
          </div>
          {product && preview !== null ? (
            <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="promotion-preview">
              {t.priceLine(formatCents(preview), formatCents(product.basePriceCents))}
            </p>
          ) : null}

          <FormField label={t.quantityLimit} hint={t.quantityLimitHint}>
            <Input inputMode="numeric" value={form.quantityLimit} onChange={(event) => set("quantityLimit", event.target.value)} placeholder="50" data-testid="promotion-quantity" />
          </FormField>

          <div className="space-y-2">
            <p className="text-sm font-medium">{t.audience}</p>
            <Choice
              label={t.audience}
              value={form.audience}
              onChange={(value) => set("audience", value)}
              options={[{ value: "ALL", label: t.allMerchants }, { value: "SOME", label: t.someMerchants }]}
            />
            {form.audience === "SOME" ? (
              <div className="space-y-2 rounded-lg border p-3" data-testid="promotion-merchants">
                <Input value={merchantQuery} onChange={(event) => setMerchantQuery(event.target.value)} placeholder={t.searchMerchant} aria-label={t.searchMerchant} />
                <p className="text-xs text-muted-foreground" aria-live="polite">{t.merchantsChosen(form.merchantIds.length)}</p>
                <div className="max-h-48 overflow-y-auto">
                  {visibleMerchants.map((merchant) => (
                    <label key={merchant.id} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 rounded border-input"
                        checked={form.merchantIds.includes(merchant.id)}
                        onChange={() => toggleMerchant(merchant.id)}
                      />
                      {merchant.name}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{fr.common.cancel}</Button>
            <Button type="submit" variant="brand" loading={create.isPending} data-testid="promotion-submit">{t.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
