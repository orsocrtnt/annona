"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Lock, Printer, Tag } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { DeliveryDayPicker, parisDateKey } from "@/components/shared/delivery-day-picker";
import type { PreparationLine, PreparationSheet, ProductionDay } from "@/domains/production/production.types";
import { useProductionDay, useSetPrepared } from "@/features/production/hooks";
import { PrintArea, type PrintKind } from "@/features/production/print-area";
import { ShortageDialog } from "@/features/production/shortage-dialog";
import { deadlineLabel, longDeliveryDateLabel } from "@/lib/format/delivery-date";
import { fr } from "@/lib/i18n/fr";
import { cn } from "@/lib/utils";

const t = fr.production;
type View = "totals" | "sheets" | "rounds";
const VIEWS: View[] = ["totals", "sheets", "rounds"];

/** BOU-1 — espace boulanger pensé tablette : gros boutons, une date, trois vues. */
export function ProductionContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const date = params.get("date") ?? parisDateKey(1);
  const view = (VIEWS.includes(params.get("view") as View) ? params.get("view") : "totals") as View;
  const day = useProductionDay(date);
  const [printKind, setPrintKind] = useState<PrintKind>("sheets");
  const [packages, setPackages] = useState<Record<string, number>>({});
  const [shortageLine, setShortageLine] = useState<PreparationLine | null>(null);

  const update = useCallback(
    (changes: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) next.set(key, value);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const print = (kind: PrintKind) => {
    setPrintKind(kind);
    // Laisse React rendre la bonne zone d'impression avant d'ouvrir la boîte d'impression.
    window.setTimeout(() => window.print(), 50);
  };

  if (day.isLoading && !day.data) return <PageSkeleton />;
  const data = day.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground">{longDeliveryDateLabel(date)}</p>
        </div>
        {data?.closed && data.sheets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="lg" onClick={() => print("sheets")}>
              <Printer /> {t.printSheets}
            </Button>
            <Button variant="outline" size="lg" onClick={() => print("labels")}>
              <Tag /> {t.printLabels}
            </Button>
          </div>
        ) : null}
      </div>

      <DeliveryDayPicker
        large
        value={date}
        label={t.date}
        onChange={(value) => update({ date: value })}
        shortcuts={[
          { days: 0, label: fr.adminOrders.today },
          { days: 1, label: fr.adminOrders.tomorrow },
          { days: 2, label: fr.adminOrders.afterTomorrow },
        ]}
      />

      {day.error ? (
        <Alert variant="destructive">
          <AlertDescription>{day.error instanceof Error ? day.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          {data.closed ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="production-state">
              <Lock className="h-4 w-4" aria-hidden /> {t.closedSince(deadlineLabel(data.cutoffAt))} {t.orderCount(data.orderCount)} · {t.itemCount(data.itemCount)}
            </p>
          ) : (
            <Alert className="border-warning/40 bg-warning-subtle" data-testid="production-state">
              <AlertTitle>{t.open(deadlineLabel(data.cutoffAt))}</AlertTitle>
              <AlertDescription>{t.provisionalHint}</AlertDescription>
            </Alert>
          )}

          {data.closed ? (
            <div role="tablist" aria-label={t.title} className="inline-flex flex-wrap gap-1 rounded-2xl border bg-card p-1">
              {VIEWS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={view === key}
                  onClick={() => update({ view: key })}
                  className={cn(
                    "min-h-12 rounded-xl px-5 text-base font-medium transition-colors",
                    view === key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  )}
                >
                  {t.tabs[key]}
                </button>
              ))}
            </div>
          ) : null}

          {!data.closed || view === "totals" ? <Totals day={data} /> : null}
          {data.closed && view === "sheets" ? (
            <Sheets day={data} packages={packages} onPackages={(orderId, value) => setPackages((all) => ({ ...all, [orderId]: value }))} onShortage={setShortageLine} />
          ) : null}
          {data.closed && view === "rounds" ? <Rounds day={data} /> : null}

          <PrintArea day={data} kind={printKind} packages={packages} />
          <ShortageDialog date={date} line={shortageLine} onClose={() => setShortageLine(null)} />
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOU-01 : total à produire
// ---------------------------------------------------------------------------

function Totals({ day }: { day: ProductionDay }) {
  if (day.totals.length === 0) {
    return <div className="rounded-2xl border border-dashed p-10 text-center text-lg text-muted-foreground">{t.empty}</div>;
  }
  return (
    <section aria-label={t.totalsTitle} className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold">{t.totalsTitle}</h2>
        {day.provisional ? <Badge variant="warning">{t.provisional}</Badge> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {day.totals.map((category) => (
          <Card key={category.id} className={cn(day.provisional && "border-dashed")} data-testid={`total-category-${category.name}`}>
            <CardHeader className="flex flex-row items-baseline justify-between space-y-0 pb-2">
              <CardTitle className="text-lg">{category.name}</CardTitle>
              <span className="text-sm text-muted-foreground tabular-nums">{category.quantity}</span>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {category.products.map((product) => (
                  <li key={product.productId} className="flex items-center justify-between gap-3 py-2.5" data-testid={`total-${product.name}`}>
                    <span className="text-base">
                      {product.name} <span className="text-sm text-muted-foreground">· {product.unit}</span>
                    </span>
                    <span className={cn("text-2xl font-semibold tabular-nums", day.provisional && "text-muted-foreground")}>{product.quantity}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// BOU-02, BOU-05, BOU-06 : bons de préparation
// ---------------------------------------------------------------------------

function where(sheet: PreparationSheet) {
  return sheet.round ? `${sheet.round.name} · ${t.stop(sheet.stopSequence ?? 0, sheet.stopCount ?? 0)}` : t.noRound;
}

function Sheets({
  day,
  packages,
  onPackages,
  onShortage,
}: {
  day: ProductionDay;
  packages: Record<string, number>;
  onPackages: (orderId: string, value: number) => void;
  onShortage: (line: PreparationLine) => void;
}) {
  const setPrepared = useSetPrepared(day.date);
  if (day.sheets.length === 0) return <div className="rounded-2xl border border-dashed p-10 text-center text-lg text-muted-foreground">{t.empty}</div>;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {day.sheets.map((sheet) => (
        <Card key={sheet.orderId} className={cn(sheet.prepared && "border-success/50 bg-success-subtle/30")} data-testid={`sheet-${sheet.merchant.name}`}>
          <CardHeader className="space-y-1 pb-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-lg">{sheet.merchant.name}</CardTitle>
              {sheet.shortage ? <Badge variant="error">{t.shortage}</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {sheet.slotLabel} · {where(sheet)} · {sheet.reference}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y">
              {sheet.lines.map((line) => {
                const short = line.quantityDelivered !== null && line.quantityDelivered < line.quantityOrdered;
                return (
                  <li key={line.lineId} className="flex items-center gap-3 py-2" data-testid={`sheet-line-${line.name}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">{line.categoryName} · {line.unit}</p>
                    </div>
                    <span className={cn("text-xl font-semibold tabular-nums", short && "text-error")}>
                      {short ? t.deliveredOf(line.quantityDelivered!, line.quantityOrdered) : line.quantityOrdered}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-touch"
                      aria-label={t.reportShortage(line.name)}
                      disabled={sheet.status === "DELIVERED"}
                      onClick={() => onShortage(line)}
                    >
                      <AlertTriangle />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                {t.packages}
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  value={packages[sheet.orderId] ?? 1}
                  onChange={(event) => onPackages(sheet.orderId, Math.min(50, Math.max(1, Number(event.target.value) || 1)))}
                  aria-label={t.packagesOf(sheet.merchant.name)}
                  className="h-11 w-20 text-center text-base tabular-nums"
                />
              </label>
              <Button
                type="button"
                size="lg"
                variant={sheet.prepared ? "outline" : "brand"}
                className="ml-auto min-w-48"
                aria-pressed={sheet.prepared}
                disabled={sheet.status === "DELIVERED"}
                loading={setPrepared.isPending && setPrepared.variables?.orderId === sheet.orderId}
                onClick={() =>
                  setPrepared.mutate(
                    { orderId: sheet.orderId, prepared: !sheet.prepared },
                    {
                      onSuccess: () => toast.success(sheet.prepared ? t.unpreparedDone : t.preparedDone),
                      onError: (error) => toast.error(error.message),
                    }
                  )
                }
              >
                {sheet.prepared ? <><Check /> {t.prepared}</> : t.markPrepared}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BOU-03 : par tournée, dans l'ordre de chargement
// ---------------------------------------------------------------------------

function Rounds({ day }: { day: ProductionDay }) {
  const sheets = new Map(day.sheets.map((sheet) => [sheet.orderId, sheet]));
  return (
    <div className="space-y-4">
      <Alert>
        <AlertTitle>{t.loadingOrder}</AlertTitle>
        <AlertDescription>{t.loadingHint}</AlertDescription>
      </Alert>
      {day.rounds.length === 0 ? <div className="rounded-2xl border border-dashed p-10 text-center text-lg text-muted-foreground">{t.empty}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        {day.rounds.map((round) => (
          <Card key={round.id ?? "none"} data-testid={`loading-${round.name}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{round.name}</CardTitle>
              {round.slotLabel ? <p className="text-sm text-muted-foreground">{round.slotLabel}</p> : null}
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {round.orderIds.map((orderId, index) => {
                  const sheet = sheets.get(orderId)!;
                  return (
                    <li key={orderId} className="flex items-center gap-3 rounded-xl border p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold tabular-nums">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-medium">{sheet.merchant.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {sheet.round ? t.stop(sheet.stopSequence ?? 0, sheet.stopCount ?? 0) : t.noRound} · {t.itemCount(sheet.itemCount)}
                          {index === 0 && round.id ? ` · ${t.loadFirst}` : ""}
                          {index === round.orderIds.length - 1 && round.id && round.orderIds.length > 1 ? ` · ${t.loadLast}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {sheet.prepared ? <Badge variant="success">{t.prepared}</Badge> : null}
                        {sheet.shortage ? <Badge variant="error">{t.shortage}</Badge> : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
