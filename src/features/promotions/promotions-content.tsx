"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PromotionState } from "@/domains/catalog/promotion";
import type { PromotionRow } from "@/features/promotions/api";
import { usePromotions, useStopPromotion } from "@/features/promotions/hooks";
import { PromotionDialog } from "@/features/promotions/promotion-dialog";
import { shortDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

const t = fr.promotions;

const STATE_VARIANT: Record<PromotionState, "success" | "secondary" | "warning" | "error"> = {
  ACTIVE: "success",
  ENDED: "secondary",
  STOPPED: "secondary",
  SOLD_OUT: "warning",
};

/** Lot 1, demande 2 : promotions en cours et terminées ; créer, arrêter (administrateur). */
export function PromotionsContent() {
  const promotions = usePromotions();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { current, finished } = useMemo(() => {
    const rows = promotions.data ?? [];
    return { current: rows.filter((row) => row.state === "ACTIVE"), finished: rows.filter((row) => row.state !== "ACTIVE") };
  }, [promotions.data]);

  if (isInitialQueryLoading(promotions.isLoading, promotions.data)) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
        </div>
        <Button variant="brand" onClick={() => setDialogOpen(true)} data-testid="promotion-new">
          <Plus /> {t.newPromotion}
        </Button>
      </div>

      {promotions.error ? (
        <Alert variant="destructive">
          <AlertDescription>{promotions.error instanceof Error ? promotions.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      <PromotionTable title={t.current} rows={current} empty={t.noCurrent} testId="promotions-current" />
      <PromotionTable title={t.finished} rows={finished} empty={t.noFinished} testId="promotions-finished" />

      <PromotionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function PromotionTable({ title, rows, empty, testId }: { title: string; rows: PromotionRow[]; empty: string; testId: string }) {
  return (
    <Card className="min-w-0" data-testid={testId}>
      <CardHeader>
        <CardTitle className="text-base">
          {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.columns.product}</TableHead>
                <TableHead>{t.columns.price}</TableHead>
                <TableHead className="max-md:hidden">{t.columns.end}</TableHead>
                <TableHead className="max-lg:hidden">{t.columns.quantity}</TableHead>
                <TableHead className="max-lg:hidden">{t.columns.audience}</TableHead>
                <TableHead className="max-md:hidden">{t.columns.state}</TableHead>
                <TableHead className="w-0"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} data-testid={`promotion-row-${row.productName}`}>
                  <TableCell className="font-medium">
                    {row.productName}
                    {/* Téléphone : l'état passe sous le nom, pour que « Arrêter » reste visible sans défiler. */}
                    <Badge variant={STATE_VARIANT[row.state]} className="mt-1 flex w-fit md:hidden">{t.states[row.state]}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums md:whitespace-nowrap">
                    <span className="font-medium">{formatCents(row.promoUnitPriceCents)}</span>
                    {row.discountPercent ? <span className="ml-1 whitespace-nowrap text-muted-foreground">({t.percentOff(row.discountPercent)})</span> : null}
                    <s className="ml-1 whitespace-nowrap text-muted-foreground">{formatCents(row.basePriceCents)}</s>
                  </TableCell>
                  <TableCell className="whitespace-nowrap max-md:hidden">{shortDeliveryDateLabel(row.endsOn)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums max-lg:hidden">{t.used(row.usedQuantity, row.quantityLimit)}</TableCell>
                  <TableCell className="max-lg:hidden">
                    {row.allMerchants ? t.allMerchants : <span title={row.merchants.map((merchant) => merchant.name).join(", ")}>{row.merchants.map((merchant) => merchant.name).join(", ")}</span>}
                  </TableCell>
                  <TableCell className="max-md:hidden"><Badge variant={STATE_VARIANT[row.state]}>{t.states[row.state]}</Badge></TableCell>
                  <TableCell className="text-right">{row.state === "ACTIVE" ? <StopButton row={row} /> : null}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/** Arrêt en deux temps (pas de fenêtre du navigateur) : « Arrêter », puis « Confirmer l'arrêt ». */
function StopButton({ row }: { row: PromotionRow }) {
  const stop = useStopPromotion();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(true)} data-testid="promotion-stop">
        {t.stop}
      </Button>
    );
  }
  return (
    <div className="flex items-center justify-end gap-1" title={t.stopConfirm(row.productName)}>
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(false)}>{fr.common.cancel}</Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        loading={stop.isPending}
        data-testid="promotion-stop-confirm"
        onClick={() =>
          stop.mutate(row.id, {
            onSuccess: () => toast.success(t.stopped),
            onError: (error) => { toast.error(error.message); setConfirming(false); },
          })
        }
      >
        {t.stopConfirmButton}
      </Button>
    </div>
  );
}
