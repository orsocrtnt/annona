"use client";

import { useState } from "react";
import Link from "next/link";
import type { PaymentMethod } from "@prisma/client";
import { ArrowLeft, BellRing, FileCode2, FileText, Mail, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parisDateKey } from "@/components/shared/delivery-day-picker";
import type { AdminInvoiceDetail } from "@/domains/invoice/invoice.types";
import { LegalGapsAlert } from "@/features/invoices/admin-invoices-content";
import { adminInvoicePdfUrl } from "@/features/invoices/api";
import { useAdminInvoice, useDeletePayment, useRecordPayment, useRemindInvoice, useSendInvoice } from "@/features/invoices/hooks";
import { InvoiceStatusBadge } from "@/features/invoices/invoice-status-badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants/invoice-status";
import { shortDeliveryDateLabel } from "@/lib/format/delivery-date";
import { formatCents, formatVatRate } from "@/lib/format/money";
import { fr } from "@/lib/i18n/fr";

const t = fr.invoices;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "—");

function BackLink() {
  return (
    <Link href="/dashboard/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" aria-hidden /> {t.back}
    </Link>
  );
}

/** FACT-1 — fiche facture (ADM-10) : commandes incluses, lignes, PDF, Factur-X, envoi, règlements (RG-07). */
export function AdminInvoiceDetailView({ id }: { id: string }) {
  const invoice = useAdminInvoice(id);
  if (invoice.isLoading && !invoice.data) return <PageSkeleton />;
  if (!invoice.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="destructive">
          <AlertDescription>{invoice.error instanceof Error ? invoice.error.message : t.errors.notFound}</AlertDescription>
        </Alert>
      </div>
    );
  }
  return <InvoiceView invoice={invoice.data} />;
}

function InvoiceView({ invoice }: { invoice: AdminInvoiceDetail }) {
  const send = useSendInvoice(invoice.id);
  const remind = useRemindInvoice(invoice.id);
  const email = invoice.email;

  return (
    <div className="space-y-6">
      <BackLink />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="invoice-reference">{invoice.reference}</h1>
          <p className="mt-1 text-muted-foreground">{invoice.merchant.name} · {invoice.periodLabel}</p>
        </div>
        <InvoiceStatusBadge invoice={invoice} />
      </header>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <a href={adminInvoicePdfUrl(invoice.id)} target="_blank" rel="noopener" data-testid="invoice-pdf">
            <FileText aria-hidden /> {t.pdf}
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href={adminInvoicePdfUrl(invoice.id, true)} target="_blank" rel="noopener" data-testid="invoice-facturx">
            <FileCode2 aria-hidden /> {t.facturx}
          </a>
        </Button>
        <Button
          variant="outline"
          loading={send.isPending}
          data-testid="invoice-send"
          onClick={() =>
            send.mutate(undefined, {
              onSuccess: (data) => (data.alreadyPending ? toast.info(t.alreadySending) : toast.success(t.sendRequested)),
              onError: (error) => toast.error(error.message),
            })
          }
        >
          <Mail aria-hidden /> {email ? t.resend : t.send}
        </Button>
        {invoice.canRemind ? (
          <Button
            variant="outline"
            loading={remind.isPending}
            onClick={() =>
              remind.mutate(undefined, {
                onSuccess: (data) => (data.duplicate ? toast.info(t.remindDuplicate) : toast.success(t.reminded)),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            <BellRing aria-hidden /> {t.remind}
          </Button>
        ) : null}
      </div>

      <LegalGapsAlert gaps={invoice.legalGaps} />

      <dl className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t.filters.client}</dt>
          <dd className="font-medium">{invoice.merchant.name}</dd>
          <dd className="text-muted-foreground">{invoice.merchant.address}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.issuedOn}</dt>
          <dd className="font-medium">{day(invoice.issuedAt)}</dd>
          <dt className="mt-2 text-muted-foreground">{t.dueOn}</dt>
          <dd className="font-medium">{day(invoice.dueDate)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.total}</dt>
          <dd className="text-lg font-semibold tabular-nums" data-testid="invoice-total">{formatCents(invoice.totalCents)}</dd>
          <dd className="text-muted-foreground tabular-nums">{t.subtotal} {formatCents(invoice.subtotalCents)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t.remaining}</dt>
          <dd className="text-lg font-semibold tabular-nums" data-testid="invoice-remaining">{formatCents(invoice.remainingCents)}</dd>
          <dd className="text-muted-foreground tabular-nums">{t.paid} {formatCents(invoice.paidCents)}</dd>
        </div>
      </dl>

      <Card>
        <CardHeader><CardTitle className="text-base">{t.email}</CardTitle></CardHeader>
        <CardContent className="text-sm" data-testid="invoice-email-status">
          {email ? (
            <p>
              <span className={email.state === "SENT" ? "font-medium text-success" : email.state === "PENDING" ? "font-medium" : "font-medium text-warning"}>
                {t.emailStates[email.state]}
              </span>
              {email.recipient ? <span className="text-muted-foreground"> {t.emailTo(email.recipient)}</span> : null}
              <span className="text-muted-foreground"> · {new Date(email.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}</span>
            </p>
          ) : (
            <p className="text-muted-foreground">{t.emailNone}</p>
          )}
          {invoice.merchant.billingEmail ? null : <p className="mt-1 text-warning">{t.emailStates.NO_RECIPIENT}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t.lines}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.product}</TableHead>
                <TableHead className="text-right">{t.quantity}</TableHead>
                <TableHead className="text-right max-md:hidden">{t.unitPrice}</TableHead>
                <TableHead className="text-right max-md:hidden">{t.vat}</TableHead>
                <TableHead className="text-right">{t.lineTotal}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.map((line, index) => (
                <TableRow key={`${line.label}-${index}`} data-testid={`invoice-line-${line.label}`}>
                  <TableCell>
                    <p className="font-medium">{line.label}</p>
                    {line.unit ? <p className="text-xs text-muted-foreground">{line.unit}</p> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                  <TableCell className="text-right tabular-nums max-md:hidden">{formatCents(line.unitPriceCents)}</TableCell>
                  <TableCell className="text-right tabular-nums max-md:hidden">{formatVatRate(line.vatRateBasisPoints)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(line.totalCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <dl className="ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">{t.subtotal}</dt>
            <dd className="text-right">{formatCents(invoice.subtotalCents)}</dd>
            {invoice.vatBreakdown.map((row) => (
              <div key={row.vatRateBasisPoints} className="contents">
                <dt className="text-muted-foreground">{t.vatOn(formatVatRate(row.vatRateBasisPoints), formatCents(row.baseCents))}</dt>
                <dd className="text-right">{formatCents(row.vatCents)}</dd>
              </div>
            ))}
            <dt className="font-semibold">{t.total}</dt>
            <dd className="text-right font-semibold">{formatCents(invoice.totalCents)}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t.orders} ({invoice.orders.length})</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y text-sm">
            {invoice.orders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2" data-testid={`invoice-order-${order.reference}`}>
                <span className="flex items-center gap-2">
                  <Link href={`/dashboard/orders/${order.id}`} prefetch={false} className="font-medium text-brand underline-offset-4 hover:underline">{order.reference}</Link>
                  <span className="text-muted-foreground">{shortDeliveryDateLabel(order.deliveryDate)}</span>
                  {order.shortage ? <Badge variant="error">{t.shortage}</Badge> : null}
                </span>
                <span className="tabular-nums">{formatCents(order.subtotalCents)} {fr.common.exclVat}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <PaymentsCard invoice={invoice} />
    </div>
  );
}

function PaymentsCard({ invoice }: { invoice: AdminInvoiceDetail }) {
  const record = useRecordPayment(invoice.id);
  const remove = useDeletePayment(invoice.id);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => parisDateKey(0));
  const [method, setMethod] = useState<PaymentMethod>("VIREMENT");
  const [reference, setReference] = useState("");
  const payable = invoice.status !== "CANCELLED" && invoice.remainingCents > 0;
  const cents = Math.round(Number(amount.replace(",", ".").replace(/\s/g, "")) * 100);
  const valid = Number.isFinite(cents) && cents > 0 && cents <= invoice.remainingCents;

  const submit = () =>
    record.mutate(
      { amountCents: cents, method, paidAt, reference: reference.trim() || null },
      {
        onSuccess: () => {
          toast.success(t.paymentRecorded);
          setAmount("");
          setReference("");
        },
        onError: (error) => toast.error(error.message),
      }
    );

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t.payments}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {invoice.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noPayments}</p>
        ) : (
          <ul className="divide-y text-sm" data-testid="invoice-payments">
            {invoice.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium tabular-nums">{formatCents(payment.amountCents)}</span>
                  <span className="text-muted-foreground"> · {PAYMENT_METHOD_LABELS[payment.method]} · {day(payment.paidAt)}</span>
                  {payment.reference ? <span className="text-muted-foreground"> · {payment.reference}</span> : null}
                  {payment.recordedBy ? <span className="text-xs text-muted-foreground"> · {t.by(payment.recordedBy)}</span> : null}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.deletePayment}
                  loading={remove.isPending && remove.variables === payment.id}
                  onClick={() => {
                    if (!window.confirm(t.deleteConfirm)) return;
                    remove.mutate(payment.id, { onSuccess: () => toast.success(t.paymentDeleted), onError: (error) => toast.error(error.message) });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {payable ? (
          <form
            className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (valid) submit();
            }}
            aria-label={t.addPayment}
          >
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">{t.amount}</Label>
              <div className="flex gap-1">
                <Input id="payment-amount" inputMode="decimal" value={amount} placeholder="0,00" onChange={(event) => setAmount(event.target.value)} />
                <Button type="button" variant="ghost" size="sm" onClick={() => setAmount((invoice.remainingCents / 100).toFixed(2).replace(".", ","))}>
                  {t.payRemaining}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-date">{t.paymentDate}</Label>
              <Input id="payment-date" type="date" value={paidAt} max={parisDateKey(0)} onChange={(event) => setPaidAt(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label id="payment-method">{t.method}</Label>
              <Select value={method} onValueChange={(value) => setMethod(value as PaymentMethod)}>
                <SelectTrigger aria-labelledby="payment-method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-reference">{t.reference}</Label>
              <Input id="payment-reference" value={reference} maxLength={120} placeholder={t.referencePlaceholder} onChange={(event) => setReference(event.target.value)} />
            </div>
            <Button type="submit" loading={record.isPending} disabled={!valid || !paidAt}>{t.recordPayment}</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
