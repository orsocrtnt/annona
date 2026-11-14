"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BillingPeriod } from "@prisma/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parisDateKey } from "@/components/shared/delivery-day-picker";
import { BILLING_PERIODS, periodContaining, periodLabel } from "@/domains/invoice/billing-period";
import type { AdminInvoiceList, GenerationResultView } from "@/domains/invoice/invoice.types";
import { useGenerateInvoices } from "@/features/invoices/hooks";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

const t = fr.invoices;
const ALL = "all";

/** ADM-10 : « Générer les factures » d'une période (périodicité + un jour de la période, un client facultatif). */
export function GenerateInvoicesDialog({ open, onOpenChange, merchants }: { open: boolean; onOpenChange: (open: boolean) => void; merchants: AdminInvoiceList["merchants"] }) {
  const generate = useGenerateInvoices();
  const [periodType, setPeriodType] = useState<BillingPeriod>("MONTHLY");
  const [date, setDate] = useState(() => parisDateKey(-1));
  const [merchantId, setMerchantId] = useState<string>(ALL);
  const [result, setResult] = useState<GenerationResultView | null>(null);

  const period = useMemo(() => {
    try {
      return periodContaining(periodType, date);
    } catch {
      return null;
    }
  }, [periodType, date]);
  const today = parisDateKey(0);
  const eligible = merchants.filter((merchant) => merchant.billingPeriod === periodType);

  const submit = () =>
    generate.mutate(
      { periodType, date, merchantId: merchantId === ALL ? null : merchantId },
      {
        onSuccess: (data) => {
          setResult(data);
          toast.success(t.generated(data.created.length));
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setResult(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t.generateTitle}</DialogTitle>
          <DialogDescription>{t.generateHint}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label id="generate-period-type">{t.periodType}</Label>
            <Select
              value={periodType}
              onValueChange={(value) => {
                setPeriodType(value as BillingPeriod);
                setMerchantId(ALL);
                setResult(null);
              }}
            >
              <SelectTrigger aria-labelledby="generate-period-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BILLING_PERIODS.map((type) => (
                  <SelectItem key={type} value={type}>{t.periodTypes[type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="generate-date">{t.periodDay}</Label>
            <Input id="generate-date" type="date" value={date} max={today} onChange={(event) => { setDate(event.target.value); setResult(null); }} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label id="generate-client">{t.filters.client}</Label>
            <Select value={merchantId} onValueChange={(value) => { setMerchantId(value); setResult(null); }}>
              <SelectTrigger aria-labelledby="generate-client"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.allClientsOfPeriodicity} ({eligible.length})</SelectItem>
                {eligible.map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {period ? (
          <p className="text-sm font-medium" data-testid="generate-period-label">{t.periodResolved(periodLabel(period))}</p>
        ) : null}
        {period && period.end >= today ? (
          <Alert><AlertDescription>{t.periodOpen}</AlertDescription></Alert>
        ) : null}

        {result ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3 text-sm" data-testid="generate-result">
            <p className="font-medium">{t.generated(result.created.length)}</p>
            {result.created.length > 0 ? (
              <ul className="space-y-1">
                {result.created.map((invoice) => (
                  <li key={invoice.id} className="flex justify-between gap-3">
                    <Link href={`/dashboard/invoices/${invoice.id}`} prefetch={false} className="font-medium text-brand underline-offset-4 hover:underline">
                      {invoice.reference}
                    </Link>
                    <span className="truncate text-muted-foreground">{invoice.merchantName}</span>
                    <span className="tabular-nums">{formatCents(invoice.totalCents)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {result.nothingToBill > 0 ? <p className="text-muted-foreground">{t.nothingToBill(result.nothingToBill)}</p> : null}
            {result.skipped.map((skipped) => (
              <p key={`${skipped.merchantName}-${skipped.reference}`} className="text-warning">{t.skippedOrder(skipped.merchantName, skipped.reference)}</p>
            ))}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{fr.common.close}</Button>
          <Button onClick={submit} loading={generate.isPending} disabled={!period || date > today}>
            {generate.isPending ? t.generating : t.generate}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
