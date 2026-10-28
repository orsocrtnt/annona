"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubscriptionView } from "@/domains/billing/subscription-view.types";
import { subscriptionApi } from "./subscription-api";

export function SubscriptionPaymentMethod({ subscription }: { subscription: SubscriptionView }) {
  // Le lien est à usage court : il est demandé au clic et jamais conservé côté navigateur.
  const portal = useMutation({
    mutationFn: subscriptionApi.paymentPortal,
    onSuccess: ({ url }) => window.location.assign(url),
  });

  if (!subscription.canManagePaymentMethod) return null;

  return <Card data-subscription-payment-method="available">
    <CardHeader>
      <CardTitle>Moyen de paiement et factures</CardTitle>
      <CardDescription>Changez de carte ou réglez une facture en attente sur la page sécurisée de Stripe, puis revenez ici.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      {portal.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{portal.error.message}</p>}
      <Button variant="outline" loading={portal.isPending || portal.isSuccess} onClick={() => portal.mutate()}>Gérer le moyen de paiement</Button>
    </CardContent>
  </Card>;
}
