"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SubscriptionView } from "@/domains/billing/subscription-view.types";
import { subscriptionApi } from "./subscription-api";

export function SubscriptionCancel({ subscription, endsAtLabel }: { subscription: SubscriptionView; endsAtLabel: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const cancel = useMutation({
    mutationFn: () => subscriptionApi.cancel(key),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["company", "subscription"] });
    },
  });

  if (subscription.cancelAtPeriodEnd) {
    return <Card data-subscription-cancel="scheduled">
      <CardHeader>
        <CardTitle>Résiliation programmée</CardTitle>
        <CardDescription>
          Votre abonnement reste actif jusqu’au {endsAtLabel}. Aucun prélèvement ne suivra. Vos données et votre historique sont conservés.
        </CardDescription>
      </CardHeader>
    </Card>;
  }
  if (!subscription.canCancel) return null;

  return <Card data-subscription-cancel="available">
    <CardHeader>
      <CardTitle>Résilier l’abonnement</CardTitle>
      <CardDescription>La résiliation prend effet à la fin de la période payée, le {endsAtLabel}.</CardDescription>
    </CardHeader>
    <CardContent>
      <Dialog open={open} onOpenChange={(next) => {
        if (cancel.isPending) return;
        setOpen(next);
        // Une nouvelle confirmation, après une fermeture, est une nouvelle demande.
        if (!next && !cancel.isError) setKey(crypto.randomUUID());
        if (!next) cancel.reset();
      }}>
        <DialogTrigger asChild><Button variant="outline">Résilier à l’échéance</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Résilier votre abonnement ?</DialogTitle>
            <DialogDescription>
              Votre formule {subscription.formula.name} reste active jusqu’au {endsAtLabel}. Aucun nouveau prélèvement n’aura lieu. La période en cours n’est pas remboursée.
            </DialogDescription>
          </DialogHeader>
          {cancel.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{cancel.error.message}</p>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={cancel.isPending}>Garder mon abonnement</Button></DialogClose>
            <Button variant="destructive" loading={cancel.isPending} onClick={() => cancel.mutate()}>Confirmer la résiliation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
