"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMerchantProfile } from "@/features/ordering/hooks";
import { BILLING_PERIOD_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants/order-status";
import { fr } from "@/lib/i18n/fr";
import type { BillingPeriod, PaymentMethod } from "@prisma/client";

const t = fr.profile;

function line(...parts: Array<string | null | undefined>) {
  return parts.filter(Boolean).join(" ") || null;
}

/** CLI-02 : raison sociale, adresse de livraison, contact et informations de facturation. */
export function MerchantProfileCard() {
  const profile = useMerchantProfile();
  if (profile.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (!profile.data) return null;
  const merchant = profile.data;
  const delivery = line(merchant.address, line(merchant.postalCode, merchant.city));
  const billing = merchant.billingAddress ? line(merchant.billingAddress, line(merchant.billingPostalCode, merchant.billingCity)) : t.sameAsDelivery;
  const rows: Array<[string, string | null]> = [
    [t.legalName, merchant.name],
    [t.tradeName, merchant.tradeName],
    [t.deliveryAddress, delivery],
    [t.accessInstructions, merchant.accessInstructions],
    [t.contact, line(merchant.contactName, merchant.contactPhone ? `· ${merchant.contactPhone}` : null, merchant.contactEmail ? `· ${merchant.contactEmail}` : null)],
    [t.billingAddress, billing],
    [t.billingEmail, merchant.billingEmail],
    [t.billingPeriod, BILLING_PERIOD_LABELS[merchant.billingPeriod as BillingPeriod] ?? merchant.billingPeriod],
    [t.paymentMethod, merchant.paymentMethod ? PAYMENT_METHOD_LABELS[merchant.paymentMethod as PaymentMethod] : null],
    ["SIREN", merchant.siren],
    ["TVA intracommunautaire", merchant.vatNumber],
  ];
  return (
    <Card data-testid="merchant-profile">
      <CardHeader>
        <CardTitle className="text-base">{t.business}</CardTitle>
        <CardDescription>{t.businessHint}</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="break-words">{value || <span className="text-muted-foreground">{t.notProvided}</span>}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
