"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, FilePlus2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvoiceLegalGap } from "@/domains/invoice/invoice-legal";
import { invoiceExportUrl } from "@/features/invoices/api";
import { GenerateInvoicesDialog } from "@/features/invoices/generate-invoices-dialog";
import { useAdminInvoices } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/invoice-status-badge";
import { formatCents } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

const t = fr.invoices;
const ALL = "all";
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—");

/** Mentions légales obligatoires absentes (ENF-05) : signalées, jamais inventées. */
export function LegalGapsAlert({ gaps }: { gaps: InvoiceLegalGap[] }) {
  if (gaps.length === 0) return null;
  return (
    <Alert data-testid="legal-gaps">
      <AlertTitle>{t.legalGapsTitle}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{t.legalGapsHint}</p>
        <ul className="list-disc pl-5">
          {gaps.map((gap) => (
            <li key={gap.field}>
              {/* Lot 1, demande 9 : cible tactile de 44 px sur téléphone. */}
              <Link href={gap.href} className="underline-offset-4 hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center">{gap.label}</Link>
            </li>
          ))}
        </ul>
        <Link href="/settings/billing" className="font-medium text-brand underline-offset-4 hover:underline">{t.legalGapsLink}</Link>
      </AlertDescription>
    </Alert>
  );
}

/** FACT-1 — factures de l'entreprise (ADM-10) : filtres période, client, règlement ; génération ; export. */
export function AdminInvoicesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const filters = {
    from: params.get("from"),
    to: params.get("to"),
    merchantId: params.get("merchantId"),
    status: params.get("status"),
  };
  const list = useAdminInvoices(filters);
  const [generating, setGenerating] = useState(false);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  if (list.isLoading && !list.data) return <PageSkeleton />;
  const data = list.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-muted-foreground max-md:hidden">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href={invoiceExportUrl(filters)} download>
              <Download aria-hidden /> CSV
            </a>
          </Button>
          <Button onClick={() => setGenerating(true)} data-testid="open-generate">
            <FilePlus2 aria-hidden /> {t.generate}
          </Button>
        </div>
      </div>

      {data ? <LegalGapsAlert gaps={data.legalGaps} /> : null}

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-from">{t.filters.from}</Label>
            <Input id="filter-from" type="date" className="w-40" value={filters.from ?? ""} onChange={(event) => update({ from: event.target.value || null })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-to">{t.filters.to}</Label>
            <Input id="filter-to" type="date" className="w-40" value={filters.to ?? ""} onChange={(event) => update({ to: event.target.value || null })} />
          </div>
          <div className="w-full space-y-1.5 sm:w-60">
            <Label id="filter-invoice-client">{t.filters.client}</Label>
            <Select value={filters.merchantId ?? ALL} onValueChange={(value) => update({ merchantId: value === ALL ? null : value })}>
              <SelectTrigger aria-labelledby="filter-invoice-client"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.filters.allClients}</SelectItem>
                {(data?.merchants ?? []).map((merchant) => (
                  <SelectItem key={merchant.id} value={merchant.id}>{merchant.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full space-y-1.5 sm:w-52">
            <Label id="filter-invoice-status">{t.filters.status}</Label>
            <Select value={filters.status ?? ALL} onValueChange={(value) => update({ status: value === ALL ? null : value })}>
              <SelectTrigger aria-labelledby="filter-invoice-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t.filters.all}</SelectItem>
                {Object.entries(t.statusFilter).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {list.error ? (
        <Alert variant="destructive">
          <AlertDescription>{list.error instanceof Error ? list.error.message : fr.common.loadError}</AlertDescription>
        </Alert>
      ) : null}

      {data ? (
        <>
          <p className="text-sm text-muted-foreground" data-testid="invoice-count">
            {t.count(data.invoices.length)} · {t.totals(formatCents(data.totals.totalCents), formatCents(data.totals.remainingCents))}
          </p>
          {data.truncated ? <p className="text-sm text-warning">{t.truncated}</p> : null}
          {data.invoices.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t.empty}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.columns.number}</TableHead>
                  <TableHead>{t.columns.client}</TableHead>
                  <TableHead className="max-md:hidden">{t.columns.period}</TableHead>
                  <TableHead className="max-lg:hidden">{t.columns.issued}</TableHead>
                  <TableHead className="max-lg:hidden">{t.columns.due}</TableHead>
                  <TableHead className="text-right">{t.columns.total}</TableHead>
                  <TableHead className="text-right max-md:hidden">{t.columns.remaining}</TableHead>
                  <TableHead>{t.columns.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((invoice) => (
                  <TableRow key={invoice.id} data-testid={`invoice-row-${invoice.reference}`}>
                    <TableCell className="font-medium">
                      <Link href={`/dashboard/invoices/${invoice.id}`} className="text-brand underline-offset-4 hover:underline">{invoice.reference}</Link>
                    </TableCell>
                    <TableCell>{invoice.merchant.name}</TableCell>
                    <TableCell className="max-md:hidden">{invoice.periodLabel}</TableCell>
                    <TableCell className="max-lg:hidden">{day(invoice.issuedAt)}</TableCell>
                    <TableCell className="max-lg:hidden">{day(invoice.dueDate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(invoice.totalCents)}</TableCell>
                    <TableCell className="text-right tabular-nums max-md:hidden">{formatCents(invoice.remainingCents)}</TableCell>
                    <TableCell><InvoiceStatusBadge invoice={invoice} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      ) : null}

      <GenerateInvoicesDialog open={generating} onOpenChange={setGenerating} merchants={data?.merchants ?? []} />
    </div>
  );
}
