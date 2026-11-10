"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { normalizeAllergens, type AllergenCode } from "@/domains/catalog/allergens";
import { AllergensField } from "@/features/catalog/allergens-field";
import type { CategoryRow, ProductRow } from "@/features/catalog/api";
import { useProductPhoto, useSaveProduct } from "@/features/catalog/hooks";
import { MerchantPricesSection } from "@/features/catalog/merchant-prices-section";
import { ProductThumb } from "@/features/catalog/product-thumb";
import { useCompanySettings } from "@/features/settings/hooks";
import { fr } from "@/lib/i18n/fr";
import { basisPointsToInput, centsToInput } from "@/lib/format/money";
import { parseEurosToCents, parsePercentToBasisPoints } from "@/lib/validations/catalog";

const t = fr.catalog;

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Produit modifié ; `null` pour une création. */
  product: ProductRow | null;
  categories: CategoryRow[];
  defaultCategoryId: string | null;
  /** Appelé après création : la fiche reste ouverte sur le nouveau produit (photo, prix). */
  onCreated: (product: ProductRow) => void;
}

interface FormState {
  name: string;
  description: string;
  categoryId: string;
  unit: string;
  basePrice: string;
  vatRate: string;
  active: boolean;
  /** Lot 1, demande 3 : null = non renseignés ; [] = aucun allergène. */
  allergens: AllergenCode[] | null;
}

function initialState(product: ProductRow | null, defaultCategoryId: string | null): FormState {
  return {
    name: product?.name ?? "",
    description: product?.description ?? "",
    categoryId: product?.categoryId ?? defaultCategoryId ?? "",
    unit: product?.unit ?? "pièce",
    basePrice: product ? centsToInput(product.basePriceCents) : "",
    vatRate: basisPointsToInput(product?.vatRateBasisPoints ?? 550),
    active: product?.active ?? true,
    allergens: product?.allergens ? normalizeAllergens(product.allergens) : null,
  };
}

/** ADM-02 : fiche produit (nom, photo, unité libre, prix de base, TVA, actif, catégorie) et ADM-03. */
export function ProductDialog({ open, onOpenChange, product, categories, defaultCategoryId, onCreated }: ProductDialogProps) {
  const companySettings = useCompanySettings(true);
  const [form, setForm] = useState<FormState>(() => initialState(product, defaultCategoryId));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const save = useSaveProduct();
  const photo = useProductPhoto();
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(product, defaultCategoryId));
      setErrors({});
    }
    // Réinitialiser seulement à l'ouverture ou au changement de produit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const basePriceCents = parseEurosToCents(form.basePrice);
    const vatRateBasisPoints = parsePercentToBasisPoints(form.vatRate);
    const nextErrors: typeof errors = {};
    if (!form.name.trim()) nextErrors.name = "Nom : obligatoire.";
    if (!form.categoryId) nextErrors.categoryId = "Choisissez une catégorie.";
    if (!form.unit.trim()) nextErrors.unit = "Unité : obligatoire.";
    if (basePriceCents === null) nextErrors.basePrice = "Saisissez un prix, par exemple 1,10.";
    if (vatRateBasisPoints === null) nextErrors.vatRate = "Saisissez un taux, par exemple 5,5.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    save.mutate(
      {
        id: product?.id ?? null,
        input: {
          name: form.name.trim(),
          description: form.description.trim() || null,
          categoryId: form.categoryId,
          unit: form.unit.trim(),
          basePriceCents: basePriceCents!,
          vatRateBasisPoints: vatRateBasisPoints!,
          active: form.active,
          allergens: form.allergens,
        },
      },
      {
        onSuccess: (saved) => {
          toast.success(t.productSaved);
          if (!product) onCreated(saved);
          else onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  const onPhotoSelected = (file: File | undefined) => {
    if (!file || !product) return;
    photo.upload.mutate(
      { id: product.id, file },
      { onSuccess: () => toast.success(t.photoSaved), onError: (error) => toast.error(error.message) }
    );
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? t.editProduct : t.newProduct}</DialogTitle>
          <DialogDescription>{product ? product.name : t.saveProductFirst}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <FormField label={t.productName} error={errors.name} required>
            <Input value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={120} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t.category} error={errors.categoryId} required>
              <Select value={form.categoryId} onValueChange={(value) => set("categoryId", value)}>
                <SelectTrigger aria-label={t.category}>
                  <SelectValue placeholder={t.category} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                      {!category.active ? ` (${t.categoryInactive.toLowerCase()})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t.unit} hint={t.unitHint} error={errors.unit} required>
              <Input value={form.unit} onChange={(event) => set("unit", event.target.value)} maxLength={40} list="company-units" />
            </FormField>
            {/* PLA-04 : unités proposées dans les paramètres de l'entreprise ; la saisie reste libre. */}
            <datalist id="company-units">
              {(companySettings.data?.units ?? []).map((unit) => <option key={unit} value={unit} />)}
            </datalist>
            <FormField label={t.basePrice} error={errors.basePrice} required>
              <Input inputMode="decimal" value={form.basePrice} onChange={(event) => set("basePrice", event.target.value)} placeholder="1,10" />
            </FormField>
            <FormField label={t.vatRate} error={errors.vatRate} required>
              <Input inputMode="decimal" value={form.vatRate} onChange={(event) => set("vatRate", event.target.value)} placeholder="5,5" />
            </FormField>
          </div>
          <FormField label={t.productDescription}>
            <Input value={form.description} onChange={(event) => set("description", event.target.value)} maxLength={500} />
          </FormField>
          <AllergensField value={form.allergens} onChange={(value) => set("allergens", value)} />
          <div className="flex items-center gap-3">
            <Switch id="product-active" checked={form.active} onCheckedChange={(value) => set("active", value)} />
            <Label htmlFor="product-active">{t.productActive}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{fr.common.cancel}</Button>
            <Button type="submit" variant="brand" loading={save.isPending}>{fr.common.save}</Button>
          </DialogFooter>
        </form>

        {product ? (
          <>
            <Separator />
            <section className="space-y-3" aria-labelledby="product-photo-title">
              <h3 id="product-photo-title" className="text-sm font-semibold">{t.photo}</h3>
              <div className="flex items-center gap-4">
                <ProductThumb productId={product.id} photoVersion={product.photoVersion} className="h-20 w-20" />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    // Le bouton visible ouvre ce sélecteur : un seul contrôle pour le clavier et les lecteurs d'écran.
                    aria-hidden
                    tabIndex={-1}
                    data-testid="product-photo-input"
                    onChange={(event) => onPhotoSelected(event.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" size="sm" loading={photo.upload.isPending} onClick={() => fileInput.current?.click()}>
                    <ImagePlus /> {product.hasPhoto ? t.photoReplace : t.photoAdd}
                  </Button>
                  {product.hasPhoto ? (
                    <Button
                      type="button" variant="ghost" size="sm" loading={photo.remove.isPending}
                      onClick={() => photo.remove.mutate(product.id, { onSuccess: () => toast.success(t.photoRemoved), onError: (error) => toast.error(error.message) })}
                    >
                      <Trash2 /> {t.photoRemove}
                    </Button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t.photoHint}</p>
            </section>
            <Separator />
            <MerchantPricesSection product={product} />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
