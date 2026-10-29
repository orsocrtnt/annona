"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SubscriptionView } from "@/domains/billing/subscription-view.types";
import { SAAS_FEATURE_LABELS } from "@/domains/saas/saas-access";
import { cn } from "@/lib/utils";
import { compatiblePlanSelections, subscriptionApi, type BillingInterval, type BillingPlanCode, type BillingSelection, type ChangePreview } from "./subscription-api";

export const money = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
export const formatMoney = (cents: number) => money.format(cents / 100);
export const per = (interval: BillingInterval) => (interval === "ANNUAL" ? "an" : "mois");
const RESOURCES = { drivers: "comptes livreurs", admins: "comptes administrateurs", dispatchers: "comptes dispatchers" } as const;

export function Recap({ preview, endsAtLabel }: { preview: ChangePreview; endsAtLabel: string }) {
  const { blockers, lostFeatures, orderOverage } = preview.assessment;
  return <div className="space-y-3 text-sm" data-subscription-change-recap="true">
    {blockers.length > 0 && <div role="alert" className="space-y-1 rounded-lg bg-destructive/10 p-3 text-destructive">
      <p className="font-medium">Changement impossible pour l’instant</p>
      <ul className="list-disc pl-5">
        {blockers.map((blocker) => <li key={blocker.resource}>Désactivez d’abord {blocker.excess} {RESOURCES[blocker.resource]} : cette formule en autorise {blocker.limit}, vous en avez {blocker.current}.</li>)}
      </ul>
    </div>}
    <p>{preview.timing === "immediate"
      ? <>À payer aujourd’hui : <strong>{formatMoney(preview.totalCents)} TTC</strong>, au prorata jusqu’au {endsAtLabel}. Le changement s’applique dès le paiement.</>
      : <>Rien à payer aujourd’hui. Le changement s’applique au renouvellement, le {endsAtLabel}.</>}</p>
    <p className="text-muted-foreground">Ensuite : {formatMoney(preview.quote.totalTtcCents)} TTC par {per(preview.quote.billingInterval)}.</p>
    {lostFeatures.length > 0 && <p className="text-muted-foreground">Fonctions retirées : {lostFeatures.map((feature) => SAAS_FEATURE_LABELS[feature as keyof typeof SAAS_FEATURE_LABELS] ?? feature).join(", ")}.</p>}
    {orderOverage && <p className="text-muted-foreground">Ce mois-ci, {orderOverage.current} commandes pour {orderOverage.included} incluses : les commandes au-delà seront facturées.</p>}
  </div>;
}

export function SubscriptionChange({ subscription, endsAtLabel }: { subscription: SubscriptionView; endsAtLabel: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [interval, setBillingInterval] = useState<BillingInterval>(subscription.billingInterval ?? "MONTHLY");
  const [planCode, setPlanCode] = useState<BillingPlanCode | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const catalog = useQuery({ queryKey: ["company", "subscription", "plans"], queryFn: subscriptionApi.plans, enabled: open, retry: false });
  const current = catalog.data?.current ?? null;
  const selection: BillingSelection | null = planCode && current ? {
    planCode,
    billingInterval: interval,
    selections: compatiblePlanSelections(planCode, current.selections, catalog.data?.options ?? []),
  } : null;
  const isCurrent = (code: BillingPlanCode) => current?.planCode === code && current.billingInterval === interval;
  const preview = useQuery({
    queryKey: ["company", "subscription", "preview", planCode, interval],
    queryFn: () => subscriptionApi.preview(selection!),
    enabled: open && Boolean(selection) && !isCurrent(planCode!),
    retry: false,
    staleTime: 0,
  });
  const change = useMutation({
    mutationFn: () => subscriptionApi.change(selection!, key, preview.data!),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["company", "subscription"] });
    },
    // Montant ou prorata modifié entre l'aperçu et la confirmation : nouvel aperçu, nouvelle confirmation.
    onError: () => { void preview.refetch(); },
  });
  const choose = (next: { planCode?: BillingPlanCode; interval?: BillingInterval }) => {
    if (next.planCode !== undefined) setPlanCode(next.planCode);
    if (next.interval !== undefined) setBillingInterval(next.interval);
    setKey(crypto.randomUUID());
    change.reset();
  };

  if (!subscription.canChange) return null;
  const blocked = (preview.data?.assessment.blockers.length ?? 0) > 0;

  return <Card data-subscription-change="available">
    <CardHeader>
      <CardTitle>Changer de formule</CardTitle>
      <CardDescription>Une formule supérieure s’applique dès le paiement du prorata. Une formule inférieure ou le passage au mensuel s’appliquent au renouvellement.</CardDescription>
    </CardHeader>
    <CardContent>
      <Dialog open={open} onOpenChange={(next) => {
        if (change.isPending) return;
        setOpen(next);
        if (!next) { setPlanCode(null); setBillingInterval(subscription.billingInterval ?? "MONTHLY"); setKey(crypto.randomUUID()); change.reset(); }
      }}>
        <DialogTrigger asChild><Button variant="outline">Changer de formule</Button></DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Changer de formule</DialogTitle>
            <DialogDescription>Formule actuelle : {subscription.formula.name}. Les options compatibles sont conservées.</DialogDescription>
          </DialogHeader>
          {catalog.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{catalog.error.message}</p>}
          {catalog.data && <div className="space-y-4">
            <div role="radiogroup" aria-label="Périodicité" className="inline-flex rounded-lg border p-1">
              {(["MONTHLY", "ANNUAL"] as const).map((value) => <button key={value} type="button" role="radio" aria-checked={interval === value}
                className={cn("rounded-md px-3 py-1.5 text-sm max-md:min-h-11", interval === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                onClick={() => choose({ interval: value })}>{value === "MONTHLY" ? "Mensuel" : "Annuel"}</button>)}
            </div>
            <div role="radiogroup" aria-label="Formule" className="grid gap-2">
              {catalog.data.plans.map((plan) => {
                const currentPlan = isCurrent(plan.code);
                return <button key={plan.code} type="button" role="radio" aria-checked={planCode === plan.code} disabled={currentPlan}
                  className={cn("flex items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60", planCode === plan.code ? "border-primary bg-primary/5" : "hover:bg-muted/50")}
                  onClick={() => choose({ planCode: plan.code })}>
                  <span className="font-medium">{plan.name}{currentPlan && <span className="ml-2 text-xs font-normal text-muted-foreground">Formule actuelle</span>}</span>
                  <span className="text-muted-foreground">{formatMoney(interval === "ANNUAL" ? plan.annualPriceCents : plan.monthlyPriceCents)} HT / {per(interval)}</span>
                </button>;
              })}
            </div>
            {preview.isFetching && <p className="text-sm text-muted-foreground">Calcul du montant…</p>}
            {preview.isError && !preview.isFetching && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{preview.error.message}</p>}
            {preview.data && !preview.isFetching && <Recap preview={preview.data} endsAtLabel={endsAtLabel} />}
            {change.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{change.error.message}</p>}
          </div>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={change.isPending}>Annuler</Button></DialogClose>
            <Button loading={change.isPending} disabled={!preview.data || preview.isFetching || blocked} onClick={() => change.mutate()}>
              {preview.data?.timing === "immediate" ? `Payer ${formatMoney(preview.data.totalCents)} et changer` : "Programmer le changement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
