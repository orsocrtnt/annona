"use client";

import { Fragment, useMemo, useState } from "react";
import { ShelfHeading } from "@/features/shops/shelf-heading";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MoonStar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { CloseSheet, CloseSheetLine } from "@/domains/shop/shop-stock.service";
import { StockRuleError, planClose, type ClosePlan } from "@/domains/shop/stock-rules";
import { parisToday, shopCall } from "@/features/shops/shop-client";

interface Draft {
  remaining: string;
  damaged: string;
  /** Vide : tout ce qui est en fin de vente est jeté. */
  discard: string;
}

function preview(date: string, line: CloseSheetLine, draft: Draft | undefined): ClosePlan | string | null {
  if (!draft || draft.remaining === "") return null;
  try {
    return planClose(date, line.lots, {
      remaining: Number(draft.remaining),
      damaged: Number(draft.damaged || 0),
      discardExpired: draft.discard === "" ? null : Number(draft.discard),
    });
  } catch (error) {
    return error instanceof StockRuleError ? error.message : "Saisie invalide.";
  }
}

/**
 * Lot 2, demande 7 — clôture du soir : pour chaque produit, le reste ; la tablette calcule les ventes (plus anciens
 * vendus en premier) et indique ce qui arrive à son dernier jour de vente ; la vendeuse ajoute les abîmés en
 * boutique et confirme les quantités jetées. Le reste est gardé pour le lendemain.
 */
export function SellerClosing() {
  const qc = useQueryClient();
  const date = parisToday();
  const sheet = useQuery({ queryKey: ["shop", "closing", date], queryFn: () => shopCall<CloseSheet>(`/api/shop/closing?date=${date}`) });
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const set = (productId: string, change: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [productId]: { remaining: "", damaged: "", discard: "", ...current[productId], ...change } }));
  const plans = useMemo(
    () => new Map((sheet.data?.lines ?? []).map((line) => [line.productId, preview(date, line, drafts[line.productId])])),
    [sheet.data, drafts, date]
  );
  const close = useMutation({
    mutationFn: (data: CloseSheet) =>
      shopCall<Array<{ name: string; sold: number; discardedExpired: number; discardedDamaged: number }>>("/api/shop/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entries: data.lines.map((line) => {
            const draft = drafts[line.productId]!;
            return {
              productId: line.productId,
              remaining: Number(draft.remaining),
              damaged: Number(draft.damaged || 0),
              discardExpired: draft.discard === "" ? null : Number(draft.discard),
            };
          }),
        }),
      }),
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["shop"] });
      const sold = result.reduce((sum, row) => sum + row.sold, 0);
      const thrown = result.reduce((sum, row) => sum + row.discardedExpired + row.discardedDamaged, 0);
      toast.success("Journée clôturée", { description: `${sold} produit(s) vendu(s), ${thrown} jeté(s).` });
    },
    onError: (failure: Error) => toast.error(failure.message),
  });
  if (sheet.isLoading && !sheet.data) return <PageSkeleton />;
  const data = sheet.data;
  const ready = data && data.lines.length > 0 && data.lines.every((line) => typeof plans.get(line.productId) === "object" && plans.get(line.productId) !== null);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
          <MoonStar className="h-7 w-7 text-brand" aria-hidden /> Clôture du soir
        </h1>
        <p className="mt-1 text-base text-muted-foreground">Comptez ce qui reste. Les ventes sont calculées ; les produits en fin de vente sont à jeter.</p>
      </div>
      {sheet.error ? <p role="alert" className="text-base text-error">{sheet.error.message}</p> : null}
      {data?.closed ? (
        <p className="flex items-center gap-2 text-base text-success"><CheckCircle2 className="h-5 w-5" aria-hidden /> Journée déjà clôturée.</p>
      ) : null}
      {data && data.lines.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-lg text-muted-foreground">Rien en stock aujourd&apos;hui.</p> : null}
      {data && data.lines.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <ul className="divide-y">
              {data.lines.map((line, index) => {
                const heading = <ShelfHeading lines={data.lines} index={index} />;
                const plan = plans.get(line.productId);
                const draft = drafts[line.productId];
                if (line.closed) {
                  return (
                    <Fragment key={line.productId}>
                    {heading}
                    <li className="flex flex-wrap items-center gap-2 py-3">
                      <p className="min-w-0 flex-1 text-lg font-medium">{line.name}</p>
                      <Badge variant="outline">Reste {line.closed.remaining}</Badge>
                      <Badge variant="success">Vendus {line.closed.sold}</Badge>
                      <Badge variant="error">Jetés {line.closed.discardedExpired + line.closed.discardedDamaged}</Badge>
                    </li>
                    </Fragment>
                  );
                }
                return (
                  <Fragment key={line.productId}>
                  {heading}
                  <li className="space-y-2 py-3" data-testid={`closing-${line.name}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-medium">{line.name}</p>
                        <p className="text-sm text-muted-foreground">
                          En stock aujourd&apos;hui : {line.lots.reduce((sum, lot) => sum + lot.quantity, 0)} {line.unit}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        Reste
                        <Input inputMode="numeric" className="h-12 w-20 text-right text-lg tabular-nums" value={draft?.remaining ?? ""} onChange={(event) => set(line.productId, { remaining: event.target.value.replace(/\D/g, "") })} aria-label={`Reste de ${line.name}`} />
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        dont abîmés
                        <Input inputMode="numeric" className="h-12 w-20 text-right text-lg tabular-nums" placeholder="0" value={draft?.damaged ?? ""} onChange={(event) => set(line.productId, { damaged: event.target.value.replace(/\D/g, "") })} aria-label={`${line.name} abîmés en point de vente`} />
                      </label>
                    </div>
                    {typeof plan === "string" ? <p role="alert" className="text-sm text-error">{plan}</p> : null}
                    {plan && typeof plan === "object" ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="success">Vendus : {plan.sold}</Badge>
                        {plan.discardedDamaged ? <Badge variant="error">Abîmés jetés : {plan.discardedDamaged}</Badge> : null}
                        {plan.expiring > 0 ? (
                          <span className="flex flex-wrap items-center gap-2 rounded-lg bg-warning-subtle px-2 py-1 text-warning">
                            <Trash2 className="h-4 w-4" aria-hidden /> {plan.expiring} à leur dernier jour de vente : jetés
                            <Input
                              inputMode="numeric"
                              className="h-9 w-16 text-right tabular-nums"
                              value={draft?.discard === "" || draft?.discard === undefined ? String(plan.expiring) : draft.discard}
                              onChange={(event) => set(line.productId, { discard: event.target.value.replace(/\D/g, "") })}
                              aria-label={`${line.name} en fin de vente jetés`}
                            />
                          </span>
                        ) : null}
                        <Badge variant="outline">Gardés pour demain : {plan.kept}</Badge>
                      </div>
                    ) : null}
                  </li>
                  </Fragment>
                );
              })}
            </ul>
            {data.closed ? null : (
              <Button type="button" size="lg" variant="brand" className="mt-4 w-full sm:w-auto" loading={close.isPending} disabled={!ready} onClick={() => close.mutate(data)}>
                Clôturer la journée
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
