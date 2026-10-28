"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SubscriptionView } from "@/domains/billing/subscription-view.types";
import { formatMoney, per, Recap } from "./subscription-change";
import { optionMaxQuantity, subscriptionApi, type BillingSelection } from "./subscription-api";

type Quantities = Record<string, number>;

function sameQuantities(a: Quantities, b: Quantities) {
  const codes = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...codes].every((code) => (a[code] ?? 0) === (b[code] ?? 0));
}

export function SubscriptionOptions({ subscription, endsAtLabel }: { subscription: SubscriptionView; endsAtLabel: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Quantities | null>(null);
  // L'aperçu interroge le fournisseur : on attend la fin des clics avant de le demander.
  const [settled, setSettled] = useState<Quantities | null>(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  const catalog = useQuery({ queryKey: ["company", "subscription", "plans"], queryFn: subscriptionApi.plans, enabled: open, retry: false });
  const current = catalog.data?.current ?? null;
  const plan = catalog.data?.plans.find((candidate) => candidate.code === current?.planCode) ?? null;
  const initial = useMemo<Quantities>(
    () => Object.fromEntries((current?.selections ?? []).map((selection) => [selection.code, selection.quantity])),
    [current]
  );
  const offered = useMemo(() => (plan ? (catalog.data?.options ?? [])
    .map((option) => ({ option, max: optionMaxQuantity(option, plan) }))
    .filter(({ option, max }) => max > 0 || (initial[option.code] ?? 0) > 0) : []), [catalog.data, plan, initial]);
  const chosen = quantities ?? initial;

  useEffect(() => {
    const timer = setTimeout(() => setSettled(quantities), 400);
    return () => clearTimeout(timer);
  }, [quantities]);

  const changed = settled !== null && !sameQuantities(settled, initial);
  const selection: BillingSelection | null = current && settled ? {
    planCode: current.planCode,
    billingInterval: current.billingInterval,
    selections: Object.entries(settled).filter(([, quantity]) => quantity > 0).map(([code, quantity]) => ({ code, quantity })),
  } : null;
  const preview = useQuery({
    queryKey: ["company", "subscription", "options-preview", selection],
    queryFn: () => subscriptionApi.preview(selection!),
    enabled: open && changed && Boolean(selection),
    retry: false,
    staleTime: 0,
  });
  const change = useMutation({
    mutationFn: () => subscriptionApi.change(selection!, key, preview.data!),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["company", "subscription"] });
    },
    onError: () => { void preview.refetch(); },
  });
  const update = (code: string, quantity: number) => {
    setQuantities({ ...chosen, [code]: quantity });
    setKey(crypto.randomUUID());
    change.reset();
  };

  if (!subscription.canChange) return null;
  const pending = quantities !== null && quantities !== settled;
  const blocked = (preview.data?.assessment.blockers.length ?? 0) > 0;
  const interval = current?.billingInterval ?? subscription.billingInterval ?? "MONTHLY";

  return <Card data-subscription-options="available">
    <CardHeader>
      <CardTitle>Options et comptes supplémentaires</CardTitle>
      <CardDescription>Un ajout s’applique dès le paiement du prorata. Un retrait s’applique au renouvellement.</CardDescription>
    </CardHeader>
    <CardContent>
      <Dialog open={open} onOpenChange={(next) => {
        if (change.isPending) return;
        setOpen(next);
        if (!next) { setQuantities(null); setSettled(null); setKey(crypto.randomUUID()); change.reset(); }
      }}>
        <DialogTrigger asChild><Button variant="outline">Modifier les options</Button></DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier les options</DialogTitle>
            <DialogDescription>Formule {subscription.formula.name}, prix HT par {per(interval)}.</DialogDescription>
          </DialogHeader>
          {catalog.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{catalog.error.message}</p>}
          {catalog.data && offered.length === 0 && <p className="text-sm text-muted-foreground">Aucune option supplémentaire n’est proposée pour cette formule.</p>}
          {catalog.data && offered.length > 0 && <div className="space-y-4">
            <ul className="divide-y rounded-lg border" aria-label="Options">
              {offered.map(({ option, max }) => {
                const quantity = chosen[option.code] ?? 0;
                const price = formatMoney(interval === "ANNUAL" ? option.annualPriceCents : option.monthlyPriceCents);
                return <li key={option.code} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block font-medium">{option.name}</span>
                    <span className="text-muted-foreground">{price} HT{option.kind === "OPTION" ? "" : " par compte"}</span>
                  </span>
                  {option.kind === "OPTION"
                    ? <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={quantity > 0} disabled={max === 0 && quantity === 0} aria-label={option.name} onChange={(event) => update(option.code, event.target.checked ? 1 : 0)} />
                    : <span className="flex shrink-0 items-center gap-2">
                      <Button type="button" size="icon" variant="outline" aria-label={`Retirer un compte : ${option.name}`} disabled={quantity === 0} onClick={() => update(option.code, quantity - 1)}><Minus className="size-4" /></Button>
                      <span className="w-6 text-center tabular-nums" aria-live="polite">{quantity}</span>
                      <Button type="button" size="icon" variant="outline" aria-label={`Ajouter un compte : ${option.name}`} disabled={quantity >= max} onClick={() => update(option.code, quantity + 1)}><Plus className="size-4" /></Button>
                    </span>}
                </li>;
              })}
            </ul>
            {(pending || preview.isFetching) && <p className="text-sm text-muted-foreground">Calcul du montant…</p>}
            {preview.isError && !preview.isFetching && !pending && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{preview.error.message}</p>}
            {preview.data && changed && !preview.isFetching && !pending && <Recap preview={preview.data} endsAtLabel={endsAtLabel} />}
            {change.isError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{change.error.message}</p>}
          </div>}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={change.isPending}>Annuler</Button></DialogClose>
            <Button loading={change.isPending} disabled={!changed || pending || !preview.data || preview.isFetching || blocked} onClick={() => change.mutate()}>
              {preview.data?.timing === "immediate" && changed ? `Payer ${formatMoney(preview.data.totalCents)} et appliquer` : "Programmer le changement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent>
  </Card>;
}
