"use client";

import { useState } from "react";
import { AddressFieldsGroup } from "@/components/addresses/address-fields-group";
import { PositionPickerMap } from "@/components/addresses/position-picker-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MerchantDetail } from "@/features/merchants/api";
import { useZones } from "@/features/settings/hooks";
import { fr } from "@/lib/i18n/fr";
import { BILLING_PERIODS, PAYMENT_METHODS, type CreateMerchantInput } from "@/lib/validations/company-admin";

const t = fr.merchants;

type Values = {
  name: string;
  tradeName: string;
  siren: string;
  vatNumber: string;
  address: string;
  postalCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  accessInstructions: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  billingEmail: string;
  billingAddress: string;
  billingPostalCode: string;
  billingCity: string;
  billingPeriod: (typeof BILLING_PERIODS)[number];
  paymentMethod: (typeof PAYMENT_METHODS)[number] | "";
  zoneId: string;
};

function initialValues(merchant: MerchantDetail | null): Values {
  return {
    name: merchant?.name ?? "",
    tradeName: merchant?.tradeName ?? "",
    siren: merchant?.siren ?? "",
    vatNumber: merchant?.vatNumber ?? "",
    address: merchant?.address ?? "",
    postalCode: merchant?.postalCode ?? "",
    city: merchant?.city ?? "",
    latitude: merchant?.latitude ?? null,
    longitude: merchant?.longitude ?? null,
    accessInstructions: merchant?.accessInstructions ?? "",
    contactName: merchant?.contactName ?? "",
    contactPhone: merchant?.contactPhone ?? "",
    contactEmail: merchant?.contactEmail ?? "",
    billingEmail: merchant?.billingEmail ?? "",
    billingAddress: merchant?.billingAddress ?? "",
    billingPostalCode: merchant?.billingPostalCode ?? "",
    billingCity: merchant?.billingCity ?? "",
    billingPeriod: merchant?.billingPeriod ?? "MONTHLY",
    paymentMethod: merchant?.paymentMethod ?? "",
    zoneId: merchant?.zoneId ?? "",
  };
}

/** Saisie envoyée à l'API (champs vides → null). */
export function toMerchantInput(values: Values): CreateMerchantInput {
  const orNull = (value: string) => (value.trim() ? value.trim() : null);
  return {
    name: values.name.trim(),
    tradeName: orNull(values.tradeName),
    siren: orNull(values.siren),
    vatNumber: orNull(values.vatNumber),
    address: values.address.trim(),
    postalCode: orNull(values.postalCode),
    city: orNull(values.city),
    latitude: values.latitude,
    longitude: values.longitude,
    accessInstructions: orNull(values.accessInstructions),
    contactName: orNull(values.contactName),
    contactPhone: orNull(values.contactPhone),
    contactEmail: orNull(values.contactEmail),
    billingEmail: orNull(values.billingEmail),
    billingAddress: orNull(values.billingAddress),
    billingPostalCode: orNull(values.billingPostalCode),
    billingCity: orNull(values.billingCity),
    billingPeriod: values.billingPeriod,
    paymentMethod: values.paymentMethod || null,
    zoneId: values.zoneId || null,
  };
}

interface MerchantFormProps {
  merchant: MerchantDetail | null;
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: CreateMerchantInput) => void;
}

/** ADM-1 : fiche client (création et modification), adresse géocodée et position modifiable. */
export function MerchantForm({ merchant, submitLabel, pending, onSubmit }: MerchantFormProps) {
  const [values, setValues] = useState<Values>(() => initialValues(merchant));
  const zones = useZones();
  const [addressTouched, setAddressTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const position = values.latitude !== null && values.longitude !== null ? { latitude: values.latitude, longitude: values.longitude } : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!values.name.trim()) return setError(`${t.name} : obligatoire.`);
    if (!values.address.trim()) return setError(`${t.address} : obligatoire.`);
    if (values.siren.trim() && !/^\d{9}$/.test(values.siren.trim())) return setError(`${t.siren} : 9 chiffres.`);
    setError(null);
    onSubmit(toMerchantInput(values));
  };

  const text = (key: keyof Values, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <FormField label={label}>
      <Input value={String(values[key] ?? "")} onChange={(event) => set(key, event.target.value as never)} {...props} />
    </FormField>
  );

  return (
    <form onSubmit={submit} className="space-y-6" data-testid="merchant-form">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.identity}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {text("name", t.name, { required: true, autoComplete: "organization" })}
          {text("tradeName", t.tradeName)}
          {text("siren", t.siren, { inputMode: "numeric", maxLength: 9 })}
          {text("vatNumber", t.vatNumber)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.delivery}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddressFieldsGroup
            addressLabel={t.address}
            required
            hidePreview
            values={{ address: values.address, city: values.city, postalCode: values.postalCode }}
            onChange={(next) => {
              setAddressTouched(true);
              setValues((current) => ({ ...current, ...next }));
            }}
            onCoordinates={(coords, precise) => {
              // Une position déjà réglée n'est remplacée que par une adresse choisie ou modifiée.
              if (precise || addressTouched || !position) setValues((current) => ({ ...current, ...coords }));
            }}
          />
          {position ? (
            <PositionPickerMap
              position={position}
              onChange={(next) => setValues((current) => ({ ...current, ...next }))}
              label={t.position}
              hint={t.positionHint}
            />
          ) : (
            <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground" data-testid="position-missing">{t.positionMissing}</p>
          )}
          {/* Lot 1, demande 1 : tournée du client ; il choisit ensuite seulement « Matin » ou « Soir ». */}
          <FormField label={t.zone} hint={t.zoneHint}>
            <Select value={values.zoneId || "NONE"} onValueChange={(value) => set("zoneId", value === "NONE" ? "" : value)}>
              <SelectTrigger aria-label={t.zone} data-testid="merchant-zone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t.noZone}</SelectItem>
                {(zones.data ?? []).map((zone) => (
                  <SelectItem key={zone.id} value={zone.id}>{zone.active ? zone.name : `${zone.name} (${fr.companySettings.zoneInactive.toLowerCase()})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t.accessInstructions} hint={t.accessHint}>
            <textarea
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={values.accessInstructions}
              maxLength={500}
              onChange={(event) => set("accessInstructions", event.target.value)}
            />
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.contact}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {text("contactName", t.contactName, { autoComplete: "name" })}
          {text("contactPhone", t.contactPhone, { type: "tel", autoComplete: "tel" })}
          {text("contactEmail", t.contactEmail, { type: "email", autoComplete: "email" })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.billing}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label={t.billingPeriod}>
            <Select value={values.billingPeriod} onValueChange={(value) => set("billingPeriod", value as Values["billingPeriod"])}>
              <SelectTrigger aria-label={t.billingPeriod}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_PERIODS.map((period) => (
                  <SelectItem key={period} value={period}>{t.periods[period]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t.paymentMethod}>
            <Select value={values.paymentMethod || "NONE"} onValueChange={(value) => set("paymentMethod", value === "NONE" ? "" : (value as Values["paymentMethod"]))}>
              <SelectTrigger aria-label={t.paymentMethod}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">{t.none}</SelectItem>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>{t.methods[method]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          {text("billingEmail", t.billingEmail, { type: "email" })}
          {text("billingAddress", t.billingAddress)}
          {text("billingPostalCode", t.billingPostalCode, { inputMode: "numeric" })}
          {text("billingCity", t.billingCity)}
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" variant="brand" loading={pending} data-testid="merchant-submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
