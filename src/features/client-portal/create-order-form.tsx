"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, type Control, type FieldErrors, type FieldValues, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  createClientOrderSchema,
  type CreateClientOrderInput,
  type CreateClientOrderFormInput,
} from "@/lib/validations/order";
import { DELIVERY_CATEGORY_LABELS, PORTAL_CATEGORY_DESCRIPTIONS } from "@/lib/constants/delivery";
import { usePortalAddresses } from "./hooks";
import { usePortalDeliveryOptions } from "./delivery-options-hooks";
import { PageLoader } from "@/components/ui/loader";
import type { DeliveryCategory } from "@prisma/client";
import { Plus, Trash2, Package, Bike, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { PickupStopItemsFields } from "./pickup-stop-items-fields";
import { CourierEstimateBanner } from "./courier-estimate-banner";
import { toast } from "sonner";
import { AddressFieldsGroup } from "@/components/addresses/address-fields-group";
import {
  findFirstPickupStopErrorIndex,
  getFirstFormErrorMessage,
  pickupStopHasError,
  stopHasError,
} from "./form-errors";

const CATEGORY_ICONS: Record<DeliveryCategory, typeof Package> = {
  STANDARD: Package,
  COURIER: Bike,
  SPECIAL_MISSION: Sparkles,
};

interface CreateOrderFormProps {
  onSubmit: (data: CreateClientOrderInput | CreateClientOrderFormInput) => Promise<void>;
  loading?: boolean;
  submitLabel?: string;
  initialValues?: Partial<CreateClientOrderFormInput>;
}

const DEFAULT_FORM_VALUES: CreateClientOrderFormInput = {
  deliveryCategory: "STANDARD",
  items: [{ name: "", quantity: 1, estimatedPrice: undefined }],
  missionDescription: "",
  stops: [],
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
  requestedDeliveryDate: "",
  notes: "",
  saveAddress: false,
  addressLabel: "",
};

export function CreateOrderForm({
  onSubmit,
  loading,
  submitLabel,
  initialValues,
}: CreateOrderFormProps) {
  const { data: addresses } = usePortalAddresses();
  const { data: deliveryOptions, isLoading: loadingOptions } = usePortalDeliveryOptions();
  const enabledCategories = useMemo(
    () => deliveryOptions?.enabled ?? [],
    [deliveryOptions?.enabled]
  );
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [activePickupIndex, setActivePickupIndex] = useState(0);
  // Date du jour dans le fuseau du navigateur, calculée après montage :
  // la date UTC du rendu serveur différait du client et autorisait la veille en France après minuit.
  const [minDeliveryDate, setMinDeliveryDate] = useState<string>();
  useEffect(() => {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    setMinDeliveryDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  }, []);

  const form = useForm<CreateClientOrderFormInput>({
    resolver: zodResolver(createClientOrderSchema),
    defaultValues: {
      ...DEFAULT_FORM_VALUES,
      ...initialValues,
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const { fields: stopFields, append: appendStop, remove: removeStop } = useFieldArray({
    control: form.control,
    name: "stops",
  });

  const { fields: pickupStopFields, append: appendPickupStop, remove: removePickupStop } =
    useFieldArray({
      control: form.control,
      name: "pickupStops",
    });

  const deliveryCategory = form.watch("deliveryCategory");
  const isCourier = deliveryCategory === "COURIER";
  const isSpecialMission = deliveryCategory === "SPECIAL_MISSION";
  const { errors, isSubmitted } = form.formState;

  useEffect(() => {
    if (!initialValues) return;
    form.reset({
      ...DEFAULT_FORM_VALUES,
      ...initialValues,
    });
    setActivePickupIndex(0);
    setActiveStopIndex(0);
  }, [initialValues, form]);

  useEffect(() => {
    if (!isCourier) return;
    itemFields.forEach((_, index) => {
      form.setValue(`items.${index}.estimatedPrice`, undefined);
    });
  }, [isCourier, itemFields, form]);

  useEffect(() => {
    if (enabledCategories.length === 0) return;
    if (!enabledCategories.includes(deliveryCategory as DeliveryCategory)) {
      form.setValue("deliveryCategory", enabledCategories[0]);
    }
  }, [enabledCategories, deliveryCategory, form]);

  useEffect(() => {
    if (activePickupIndex >= pickupStopFields.length) {
      setActivePickupIndex(Math.max(0, pickupStopFields.length - 1));
    }
  }, [activePickupIndex, pickupStopFields.length]);

  useEffect(() => {
    if (activeStopIndex >= stopFields.length) {
      setActiveStopIndex(Math.max(0, stopFields.length - 1));
    }
  }, [activeStopIndex, stopFields.length]);

  useEffect(() => {
    if (!isSpecialMission || stopFields.length > 0) return;
    appendStop({
      label: "Adresse 1",
      address: "",
      city: "",
      postalCode: "",
      instructions: "",
    });
  }, [isSpecialMission, stopFields.length, appendStop]);

  const applyAddress = (addressId: string, target: "shipping" | "pickup" | "stop" | "pickupStop") => {
    const addr = addresses?.find((a) => a.id === addressId);
    if (!addr) return;
    if (target === "stop") {
      form.setValue(`stops.${activeStopIndex}.address`, addr.address);
      form.setValue(`stops.${activeStopIndex}.city`, addr.city ?? "");
      form.setValue(`stops.${activeStopIndex}.postalCode`, addr.postalCode ?? "");
      return;
    }
    if (target === "pickupStop") {
      form.setValue(`pickupStops.${activePickupIndex}.address`, addr.address);
      form.setValue(`pickupStops.${activePickupIndex}.city`, addr.city ?? "");
      form.setValue(`pickupStops.${activePickupIndex}.postalCode`, addr.postalCode ?? "");
      return;
    }
    const prefix = target === "pickup" ? "pickup" : "shipping";
    form.setValue(`${prefix}Address`, addr.address);
    form.setValue(`${prefix}City`, addr.city ?? "");
    form.setValue(`${prefix}PostalCode`, addr.postalCode ?? "");
  };

  const resolvedSubmitLabel =
    submitLabel ??
    (isSpecialMission ? "Demander un devis" : "Créer la commande");

  if (loadingOptions) return <PageLoader />;

  if (enabledCategories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucun type de livraison n&apos;est disponible pour le moment. Contactez votre entreprise.
      </p>
    );
  }

  const onInvalid = (fieldErrors: FieldErrors<CreateClientOrderFormInput>) => {
    const summary = getFirstFormErrorMessage(fieldErrors);
    if (summary.pickupIndex !== undefined) {
      setActivePickupIndex(summary.pickupIndex);
    }
    if (summary.stopIndex !== undefined) {
      setActiveStopIndex(summary.stopIndex);
    }
    toast.error(summary.title, { description: summary.description });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      {enabledCategories.length > 1 && (
        <div className="space-y-3">
          <h3 className="font-medium">Type de demande</h3>
          <div role="group" aria-label="Type de demande" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enabledCategories.map((type) => {
              const selected = deliveryCategory === type;
              const Icon = CATEGORY_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => form.setValue("deliveryCategory", type)}
                  className={cn(
                    "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-brand bg-brand-subtle/40"
                      : "border-border hover:border-brand/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", selected ? "text-brand" : "text-muted-foreground")} />
                    <span className="font-medium">{DELIVERY_CATEGORY_LABELS[type]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {PORTAL_CATEGORY_DESCRIPTIONS[type]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isSpecialMission ? (
        <>
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Fonction expérimentale hors offre pilote. TutelLiv centralise la description et les
            adresses ; le devis chiffré et son acceptation restent traités directement avec
            l&apos;entreprise.
          </p>
          <FormField
            label="Décrivez votre mission"
            error={errors.missionDescription?.message}
            required
          >
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Ex. Déménagement d'un studio du 3e étage sans ascenseur, assistance à une personne âgée pour des courses..."
              {...form.register("missionDescription")}
            />
          </FormField>

          <div className="space-y-4 rounded-xl border border-brand/20 bg-brand-subtle/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">Adresses concernées</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  appendStop({
                    label: `Adresse ${stopFields.length + 1}`,
                    address: "",
                    city: "",
                    postalCode: "",
                    instructions: "",
                  });
                  setActiveStopIndex(stopFields.length);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Ajouter une adresse
              </Button>
            </div>

            <div role="group" aria-label="Adresses de la mission" className="flex flex-wrap gap-2 border-b pb-3">
              {stopFields.map((field, index) => {
                const hasError = isSubmitted && stopHasError(errors, index);
                return (
                <button
                  key={field.id}
                  type="button"
                  aria-pressed={activeStopIndex === index}
                  aria-label={`${form.watch(`stops.${index}.label`) || `Adresse ${index + 1}`}${hasError ? " — incomplète" : ""}`}
                  onClick={() => setActiveStopIndex(index)}
                  className={cn(
                    "min-h-10 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    hasError && "border-destructive bg-destructive/5 text-destructive",
                    activeStopIndex === index && !hasError
                      ? "border-brand bg-brand-subtle/40 font-medium"
                      : !hasError && "border-border text-muted-foreground hover:text-foreground",
                    activeStopIndex === index && hasError && "font-medium"
                  )}
                >
                  {form.watch(`stops.${index}.label`) || `Adresse ${index + 1}`}
                  {hasError ? " •" : ""}
                </button>
              );
              })}
            </div>

            {stopFields[activeStopIndex] && (
              <div key={stopFields[activeStopIndex].id} className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <FormField
                    label="Libellé"
                    className="flex-1"
                    error={errors.stops?.[activeStopIndex]?.label?.message}
                  >
                    <Input
                      placeholder="Départ, arrivée, étape..."
                      {...form.register(`stops.${activeStopIndex}.label`)}
                    />
                  </FormField>
                  {stopFields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer l'adresse ${activeStopIndex + 1}`}
                      className="mt-6 shrink-0"
                      onClick={() => {
                        removeStop(activeStopIndex);
                        setActiveStopIndex(Math.max(0, activeStopIndex - 1));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {addresses && addresses.length > 0 && (
                  <FormField label="Adresse enregistrée" htmlFor="order-stop-saved-address">
                    <Select onValueChange={(id) => applyAddress(id, "stop")}>
                      <SelectTrigger id="order-stop-saved-address">
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
                  key={`stop-address-${stopFields[activeStopIndex].id}`}
                  addressLabel="Adresse"
                  addressPlaceholder="Numéro et rue…"
                  required
                  values={{
                    address: form.watch(`stops.${activeStopIndex}.address`) ?? "",
                    city: form.watch(`stops.${activeStopIndex}.city`) ?? "",
                    postalCode: form.watch(`stops.${activeStopIndex}.postalCode`) ?? "",
                  }}
                  onChange={(next) => {
                    form.setValue(`stops.${activeStopIndex}.address`, next.address, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    form.setValue(`stops.${activeStopIndex}.city`, next.city, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    form.setValue(`stops.${activeStopIndex}.postalCode`, next.postalCode, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }}
                  addressError={errors.stops?.[activeStopIndex]?.address?.message}
                  cityError={errors.stops?.[activeStopIndex]?.city?.message}
                  postalCodeError={errors.stops?.[activeStopIndex]?.postalCode?.message}
                  instructions={
                    <FormField label="Instructions">
                      <Input
                        placeholder="Étage, digicode, contact sur place..."
                        {...form.register(`stops.${activeStopIndex}.instructions`)}
                      />
                    </FormField>
                  }
                />
              </div>
            )}
          </div>

          <FormField label="Date souhaitée (optionnel)">
            <Input
              type="date"
              min={minDeliveryDate}
              {...form.register("requestedDeliveryDate")}
            />
          </FormField>
          <FormField label="Notes complémentaires">
            <Input {...form.register("notes")} />
          </FormField>
        </>
      ) : (
        <>
          <div className="space-y-3">
            {!isCourier && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Articles</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendItem({ name: "", quantity: 1, estimatedPrice: undefined })}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Ajouter
                  </Button>
                </div>
                {itemFields.map((field, index) => (
                  <div key={field.id} className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4 max-md:flex-col max-md:items-stretch">
                    <FormField
                      label="Nom"
                      error={errors.items?.[index]?.name?.message ?? (isSubmitted && index === 0 ? errors.items?.message : undefined)}
                      className="min-w-[140px] flex-1 max-md:min-w-0 max-md:w-full"
                    >
                      <Input placeholder="Colis, palette..." {...form.register(`items.${index}.name`)} />
                    </FormField>
                    <FormField
                      label="Qté"
                      error={errors.items?.[index]?.quantity?.message}
                      className="w-20 shrink-0"
                    >
                      <Input type="number" min={1} {...form.register(`items.${index}.quantity`)} />
                    </FormField>
                    <FormField
                      label="Prix estimé (optionnel)"
                      error={errors.items?.[index]?.estimatedPrice?.message}
                      className="w-44 shrink-0 max-md:w-full"
                    >
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="€"
                        {...form.register(`items.${index}.estimatedPrice`)}
                      />
                    </FormField>
                    {itemFields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer l'article ${index + 1}`}
                        className="mb-0.5 shrink-0"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {isSubmitted && errors.items?.message && (
                  <p role="alert" className="text-sm text-destructive">{errors.items.message}</p>
                )}
              </>
            )}
          </div>

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

              {isSubmitted && findFirstPickupStopErrorIndex(errors) !== null && (
                <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  Une ou plusieurs collectes sont incomplètes. Les onglets en rouge indiquent où
                  corriger.
                </p>
              )}

              <div role="group" aria-label="Collectes de la course" className="flex flex-wrap gap-2 border-b pb-3">
                {pickupStopFields.map((field, index) => {
                  const hasError = isSubmitted && pickupStopHasError(errors, index);
                  return (
                  <button
                    key={field.id}
                    type="button"
                    aria-pressed={activePickupIndex === index}
                    aria-label={`${form.watch(`pickupStops.${index}.label`) || `Collecte ${index + 1}`}${hasError ? " — incomplète" : ""}`}
                    onClick={() => setActivePickupIndex(index)}
                    className={cn(
                      "min-h-10 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      hasError && "border-destructive bg-destructive/5 text-destructive",
                      activePickupIndex === index && !hasError
                        ? "border-brand bg-brand-subtle/40 font-medium"
                        : !hasError && "border-border text-muted-foreground hover:text-foreground",
                      activePickupIndex === index && hasError && "font-medium"
                    )}
                  >
                    {form.watch(`pickupStops.${index}.label`) || `Collecte ${index + 1}`}
                    {hasError ? " •" : ""}
                  </button>
                );
                })}
              </div>

              {pickupStopFields[activePickupIndex] && (
                <div key={pickupStopFields[activePickupIndex].id} className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <FormField
                      label="Libellé"
                      className="flex-1"
                      error={
                        errors.pickupStops?.[activePickupIndex]?.label?.message
                      }
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
                      aria-label={`Supprimer la collecte ${activePickupIndex + 1}`}
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
                    <FormField label="Adresse enregistrée" htmlFor="order-pickup-saved-address">
                      <Select
                        key={`pickup-address-${pickupStopFields[activePickupIndex].id}`}
                        onValueChange={(id) => applyAddress(id, "pickupStop")}
                      >
                        <SelectTrigger id="order-pickup-saved-address">
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
                    addressError={errors.pickupStops?.[activePickupIndex]?.address?.message}
                    cityError={errors.pickupStops?.[activePickupIndex]?.city?.message}
                    postalCodeError={errors.pickupStops?.[activePickupIndex]?.postalCode?.message}
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
                    errors={errors.pickupStops as unknown as FieldErrors<FieldValues>}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-medium">{isCourier ? "Adresse de livraison" : "Livraison"}</h3>
            {addresses && addresses.length > 0 && (
              <FormField label="Adresse enregistrée" htmlFor="order-shipping-saved-address">
                <Select onValueChange={(id) => applyAddress(id, "shipping")}>
                  <SelectTrigger id="order-shipping-saved-address">
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
              addressLabel={isCourier ? "Adresse de livraison" : "Adresse"}
              addressPlaceholder={isCourier ? "Où livrer l'élément…" : "Numéro et rue…"}
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
              addressError={errors.shippingAddress?.message}
              cityError={errors.shippingCity?.message}
              postalCodeError={errors.shippingPostalCode?.message}
            />
            <FormField label="Instructions de livraison">
              <Input placeholder="Digicode, étage..." {...form.register("deliveryInstructions")} />
            </FormField>
            <FormField
              label="Date de livraison souhaitée"
              error={errors.requestedDeliveryDate?.message}
              required
            >
              <Input
                type="date"
                min={minDeliveryDate}
                {...form.register("requestedDeliveryDate")}
              />
            </FormField>
            <FormField label="Notes">
              <Input {...form.register("notes")} />
            </FormField>
            {!isCourier && (
              <>
                <label className="flex min-h-8 items-center gap-2 text-sm">
                  <input className="h-5 w-5" type="checkbox" {...form.register("saveAddress")} />
                  Enregistrer cette adresse
                </label>
                {form.watch("saveAddress") && (
                  <FormField label="Libellé de l'adresse">
                    <Input placeholder="Bureau, domicile..." {...form.register("addressLabel")} />
                  </FormField>
                )}
              </>
            )}
          </div>
        </>
      )}

      {isCourier && (
        <CourierEstimateBanner
          pickupAddress={form.watch("pickupStops.0.address")}
          pickupCity={form.watch("pickupStops.0.city")}
          pickupPostalCode={form.watch("pickupStops.0.postalCode")}
          shippingAddress={form.watch("shippingAddress")}
          shippingCity={form.watch("shippingCity")}
          shippingPostalCode={form.watch("shippingPostalCode")}
          requestedDeliveryDate={form.watch("requestedDeliveryDate")}
        />
      )}

      <Button type="submit" variant="brand" loading={loading}>
        {resolvedSubmitLabel}
      </Button>
    </form>
  );
}
