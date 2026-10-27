"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, type Control, type FieldErrors, type FieldValues, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/loader";
import {
  createRecurringOrderSchema,
  type CreateRecurringOrderFormInput,
  type CreateRecurringOrderInput,
} from "@/lib/validations/order";
import { DELIVERY_CATEGORY_DESCRIPTIONS, DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { RECURRENCE_UNIT_LABELS } from "@/lib/constants/recurrence";
import { usePortalAddresses } from "./hooks";
import { usePortalDeliveryOptions } from "./delivery-options-hooks";
import type { DeliveryCategory, RecurrenceUnit } from "@prisma/client";
import { Plus, Trash2, Package, Bike } from "lucide-react";
import { cn } from "@/lib/utils";
import { PickupStopItemsFields } from "./pickup-stop-items-fields";
import { AddressFieldsGroup } from "@/components/addresses/address-fields-group";

const CATEGORY_ICONS: Partial<Record<DeliveryCategory, typeof Package>> = {
  STANDARD: Package,
  COURIER: Bike,
};

const UNITS: RecurrenceUnit[] = ["DAYS", "WEEKS", "MONTHS"];

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface CreateRecurringOrderFormProps {
  onSubmit: (data: CreateRecurringOrderInput) => Promise<void>;
  loading?: boolean;
}

export function CreateRecurringOrderForm({
  onSubmit,
  loading,
}: CreateRecurringOrderFormProps) {
  const { data: addresses } = usePortalAddresses();
  const { data: deliveryOptions, isLoading: loadingOptions } = usePortalDeliveryOptions();
  const enabledCategories = (deliveryOptions?.enabled ?? []).filter(
    (c): c is "STANDARD" | "COURIER" => c !== "SPECIAL_MISSION"
  );
  const [activePickupIndex, setActivePickupIndex] = useState(0);

  const form = useForm<CreateRecurringOrderFormInput>({
    resolver: zodResolver(createRecurringOrderSchema),
    defaultValues: {
      label: "",
      deliveryCategory: "STANDARD",
      intervalValue: 1,
      intervalUnit: "WEEKS",
      startAt: todayIso(),
      endAt: "",
      items: [{ name: "", quantity: 1, estimatedPrice: undefined }],
      pickupStops: [
        {
          label: "Collecte 1",
          address: "",
          city: "",
          postalCode: "",
          instructions: "",
          items: [{ name: "", quantity: 1, estimatedPrice: undefined }],
        },
      ],
      pickupAddress: "",
      pickupCity: "",
      pickupPostalCode: "",
      pickupInstructions: "",
      shippingAddress: "",
      shippingCity: "",
      shippingPostalCode: "",
      deliveryInstructions: "",
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const {
    fields: pickupStopFields,
    append: appendPickupStop,
    remove: removePickupStop,
  } = useFieldArray({ control: form.control, name: "pickupStops" });

  const deliveryCategory = form.watch("deliveryCategory");
  const isCourier = deliveryCategory === "COURIER";

  useEffect(() => {
    if (enabledCategories.length === 0) return;
    if (!enabledCategories.includes(deliveryCategory as "STANDARD" | "COURIER")) {
      form.setValue("deliveryCategory", enabledCategories[0]!);
    }
  }, [enabledCategories, deliveryCategory, form]);

  useEffect(() => {
    if (activePickupIndex >= pickupStopFields.length) {
      setActivePickupIndex(Math.max(0, pickupStopFields.length - 1));
    }
  }, [activePickupIndex, pickupStopFields.length]);

  const applyAddress = (addressId: string, target: "shipping" | "pickupStop") => {
    const addr = addresses?.find((a) => a.id === addressId);
    if (!addr) return;
    if (target === "pickupStop") {
      form.setValue(`pickupStops.${activePickupIndex}.address`, addr.address);
      form.setValue(`pickupStops.${activePickupIndex}.city`, addr.city ?? "");
      form.setValue(`pickupStops.${activePickupIndex}.postalCode`, addr.postalCode ?? "");
      return;
    }
    form.setValue("shippingAddress", addr.address);
    form.setValue("shippingCity", addr.city ?? "");
    form.setValue("shippingPostalCode", addr.postalCode ?? "");
  };

  const handleSubmit = async (data: CreateRecurringOrderFormInput) => {
    const parsed = createRecurringOrderSchema.parse({
      ...data,
      endAt: data.endAt || undefined,
      items: isCourier ? [] : data.items,
    });
    await onSubmit(parsed);
  };

  if (loadingOptions) return <PageLoader />;

  if (enabledCategories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun type de livraison disponible. Contactez votre entreprise.
      </p>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
      <FormField label="Libellé" error={form.formState.errors.label?.message} required>
        <Input placeholder="Livraison hebdo bureau" {...form.register("label")} />
      </FormField>

      {enabledCategories.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-medium">Type de livraison</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {enabledCategories.map((type) => {
              const selected = deliveryCategory === type;
              const Icon = CATEGORY_ICONS[type] ?? Package;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => form.setValue("deliveryCategory", type)}
                  className={`rounded-xl border p-4 text-left transition-colors ${
                    selected
                      ? "border-brand bg-brand-subtle/40"
                      : "border-border hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${selected ? "text-brand" : "text-muted-foreground"}`} />
                    <span className="font-medium">{DELIVERY_CATEGORY_LABELS[type]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {DELIVERY_CATEGORY_DESCRIPTIONS[type]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="font-medium">Récurrence</h3>
        <div className="flex flex-wrap items-end gap-3">
          <span className="pb-2 text-sm text-muted-foreground">Tous les</span>
          <FormField label="Intervalle" error={form.formState.errors.intervalValue?.message} className="w-20">
            <Input type="number" min={1} {...form.register("intervalValue")} />
          </FormField>
          <FormField label="Unité" className="min-w-[140px] max-md:w-full max-md:min-w-0">
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              {...form.register("intervalUnit")}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {RECURRENCE_UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Début de la récurrence" error={form.formState.errors.startAt?.message} required>
            <Input type="date" {...form.register("startAt")} />
          </FormField>
          <FormField label="Fin de la récurrence (optionnel)" error={form.formState.errors.endAt?.message}>
            <Input type="date" {...form.register("endAt")} />
          </FormField>
        </div>
        <p className="text-xs text-muted-foreground">
          Si la date de début est aujourd&apos;hui ou passée, la première commande est créée immédiatement.
          Sinon, elle sera générée à la date de début.
        </p>
      </div>

      {!isCourier && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Articles à livrer</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: "", quantity: 1, estimatedPrice: undefined })}
            >
              <Plus className="mr-1 h-4 w-4" /> Article
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-wrap items-end gap-3 max-md:flex-col max-md:items-stretch">
              <FormField label="Article" className="min-w-[140px] flex-1 max-md:min-w-0 max-md:w-full">
                <Input placeholder="Colis, palette..." {...form.register(`items.${index}.name`)} />
              </FormField>
              <FormField label="Qté" className="w-20 shrink-0">
                <Input type="number" min={1} {...form.register(`items.${index}.quantity`)} />
              </FormField>
              <FormField label="Prix estimé (optionnel)" className="w-44 shrink-0 max-md:w-full">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="€"
                  {...form.register(`items.${index}.estimatedPrice`)}
                />
              </FormField>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mb-0.5 shrink-0"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {form.formState.errors.items?.message && (
            <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>
          )}
        </div>
      )}

      {isCourier && (
        <div className="space-y-4 rounded-xl border border-brand/20 bg-brand-subtle/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">Adresses de collecte</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const nextIndex = pickupStopFields.length;
                appendPickupStop({
                  label: `Collecte ${nextIndex + 1}`,
                  address: "",
                  city: "",
                  postalCode: "",
                  instructions: "",
                  items: [{ name: "", quantity: 1, estimatedPrice: undefined }],
                });
                setActivePickupIndex(nextIndex);
              }}
            >
              <Plus className="mr-1 h-4 w-4" />
              Ajouter une collecte
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 border-b pb-3">
            {pickupStopFields.map((field, index) => (
              <button
                key={field.id}
                type="button"
                onClick={() => setActivePickupIndex(index)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  activePickupIndex === index
                    ? "border-brand bg-brand-subtle/40 font-medium"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {form.watch(`pickupStops.${index}.label`) || `Collecte ${index + 1}`}
              </button>
            ))}
          </div>

          {pickupStopFields[activePickupIndex] && (
            <div key={pickupStopFields[activePickupIndex].id} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <FormField
                  label="Libellé"
                  className="flex-1"
                  error={form.formState.errors.pickupStops?.[activePickupIndex]?.label?.message}
                >
                  <Input
                    placeholder="Magasin, domicile..."
                    {...form.register(`pickupStops.${activePickupIndex}.label`)}
                  />
                </FormField>
                {pickupStopFields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 shrink-0"
                    onClick={() => {
                      removePickupStop(activePickupIndex);
                      setActivePickupIndex(Math.max(0, activePickupIndex - 1));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {addresses && addresses.length > 0 && (
                <FormField label="Adresse enregistrée" htmlFor="recurring-pickup-saved-address">
                  <Select
                    key={`pickup-address-${pickupStopFields[activePickupIndex].id}`}
                    onValueChange={(id) => applyAddress(id, "pickupStop")}
                  >
                    <SelectTrigger id="recurring-pickup-saved-address">
                      <SelectValue placeholder="Choisir une adresse..." />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          {addr.label} — {addr.address}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}

              <AddressFieldsGroup
                key={`pickup-address-${pickupStopFields[activePickupIndex].id}`}
                addressLabel="Adresse de collecte"
                addressPlaceholder="Où récupérer l'élément…"
                required
                values={{
                  address: form.watch(`pickupStops.${activePickupIndex}.address`) ?? "",
                  city: form.watch(`pickupStops.${activePickupIndex}.city`) ?? "",
                  postalCode: form.watch(`pickupStops.${activePickupIndex}.postalCode`) ?? "",
                }}
                onChange={(next) => {
                  form.setValue(`pickupStops.${activePickupIndex}.address`, next.address, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  form.setValue(`pickupStops.${activePickupIndex}.city`, next.city, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                  form.setValue(`pickupStops.${activePickupIndex}.postalCode`, next.postalCode, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
                addressError={form.formState.errors.pickupStops?.[activePickupIndex]?.address?.message}
                cityError={form.formState.errors.pickupStops?.[activePickupIndex]?.city?.message}
                postalCodeError={
                  form.formState.errors.pickupStops?.[activePickupIndex]?.postalCode?.message
                }
                instructions={
                  <FormField label="Instructions de collecte">
                    <Input
                      placeholder="Digicode, contact sur place..."
                      {...form.register(`pickupStops.${activePickupIndex}.instructions`)}
                    />
                  </FormField>
                }
              />

              <PickupStopItemsFields
                key={`pickup-items-${pickupStopFields[activePickupIndex].id}`}
                pickupIndex={activePickupIndex}
                control={form.control as unknown as Control<FieldValues>}
                register={form.register as unknown as UseFormRegister<FieldValues>}
                errors={form.formState.errors.pickupStops as unknown as FieldErrors<FieldValues>}
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-medium">Adresse de livraison</h3>
        {addresses && addresses.length > 0 && (
          <FormField label="Adresse enregistrée" htmlFor="recurring-shipping-saved-address">
            <Select onValueChange={(id) => applyAddress(id, "shipping")}>
              <SelectTrigger id="recurring-shipping-saved-address">
                <SelectValue placeholder="Choisir une adresse..." />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((addr) => (
                  <SelectItem key={addr.id} value={addr.id}>
                    {addr.label} — {addr.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
        <AddressFieldsGroup
          addressLabel="Adresse de livraison"
          addressPlaceholder="Où livrer l'élément…"
          required
          values={{
            address: form.watch("shippingAddress") ?? "",
            city: form.watch("shippingCity") ?? "",
            postalCode: form.watch("shippingPostalCode") ?? "",
          }}
          onChange={(next) => {
            form.setValue("shippingAddress", next.address, {
              shouldValidate: true,
              shouldDirty: true,
            });
            form.setValue("shippingCity", next.city, {
              shouldValidate: true,
              shouldDirty: true,
            });
            form.setValue("shippingPostalCode", next.postalCode, {
              shouldValidate: true,
              shouldDirty: true,
            });
          }}
          addressError={form.formState.errors.shippingAddress?.message}
          cityError={form.formState.errors.shippingCity?.message}
          postalCodeError={form.formState.errors.shippingPostalCode?.message}
        />
        <FormField label="Instructions de livraison">
          <Input placeholder="Digicode, étage..." {...form.register("deliveryInstructions")} />
        </FormField>
        <FormField label="Notes">
          <Input {...form.register("notes")} />
        </FormField>
      </div>

      <Button type="submit" variant="brand" loading={loading}>
        Créer la récurrence
      </Button>
    </form>
  );
}
