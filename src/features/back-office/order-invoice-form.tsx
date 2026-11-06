"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InvoiceStatusBadge } from "@/features/client-portal/status-badges";
import { formatCurrency } from "@/features/client-portal/utils";
import { effectiveInvoiceStatus, isInvoiceOutstanding } from "@/domains/invoice/invoice-due";
import { formatDate } from "@/lib/utils";
import type { InvoiceLineItem } from "@/lib/validations/invoice";
import type { CompanyOrder } from "./types";
import { backOfficeApi } from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface OrderInvoiceFormProps {
  order: CompanyOrder & {
    invoices?: {
      id: string;
      reference: string;
      status: string;
      amount: string | number;
      dueDate: string | null;
      paidAt?: string | null;
      createdAt: string;
      updatedAt: string;
      lineItems?: InvoiceLineItem[];
    }[];
  };
}

function computeTotal(
  includePurchases: boolean,
  customLines: { label: string; amount: string }[],
  order: OrderInvoiceFormProps["order"]
) {
  let total = 0;

  if (includePurchases && order.items) {
    for (const item of order.items) {
      const unitPrice = Number(item.unitPrice);
      if (unitPrice > 0) total += unitPrice * item.quantity;
    }
  }

  for (const line of customLines) {
    const amount = parseFloat(line.amount);
    if (!isNaN(amount) && amount > 0) total += amount;
  }

  return total;
}

export function OrderInvoiceForm({ order }: OrderInvoiceFormProps) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const hasPurchasePrices =
    order.items?.some((item) => Number(item.unitPrice) > 0) ?? false;
  const [includePurchases, setIncludePurchases] = useState(hasPurchasePrices);
  const [customLines, setCustomLines] = useState<{ label: string; amount: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existingInvoice = order.invoices?.find((invoice) => invoice.status !== "CANCELLED");
  const existingLines = (existingInvoice?.lineItems ?? []) as InvoiceLineItem[];
  const isPaid = existingInvoice?.status === "PAID";
  // Même règle que Paiements : l'échéance dépassée s'affiche « En retard » sans attendre le cron.
  const shown = existingInvoice ? effectiveInvoiceStatus(existingInvoice) : { status: "PENDING" as const, daysOverdue: 0 };
  // Une facture en retard reste émise : on l'affiche, on ne propose pas d'en refaire une.
  const isInvoiced = existingInvoice ? isInvoiceOutstanding(existingInvoice.status) : false;

  const previewTotal = computeTotal(includePurchases, customLines, order);

  const handleSubmit = async () => {
    if (previewTotal <= 0) {
      if (includePurchases && !hasPurchasePrices) {
        toast.error("Aucun prix d'achat", {
          description:
            "Le livreur doit d'abord valider les prix des articles, ou ajoutez une ligne.",
        });
      } else {
        toast.error("Ajoutez au moins une ligne");
      }
      return;
    }
    setSubmitting(true);
    try {
      await backOfficeApi.createOrderInvoice(order.id, {
        includePurchases,
        customLines: customLines
          .filter((l) => l.label && parseFloat(l.amount) > 0)
          .map((l) => ({ label: l.label, amount: parseFloat(l.amount) })),
        notes: notes || undefined,
      });
      toast.success("Facture enregistrée — le client peut la consulter");
      qc.invalidateQueries({ queryKey: ["company", "orders", order.id] });
    } catch (error) {
      toast.error("Émission impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async () => {
    if (!existingInvoice) return;
    setSubmitting(true);
    try {
      await backOfficeApi.markOrderInvoicePaid(order.id, existingInvoice.id, existingInvoice.updatedAt);
      await qc.invalidateQueries({ queryKey: ["company", "orders", order.id] });
      toast.success("Règlement enregistré");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Règlement impossible");
    } finally {
      setSubmitting(false);
    }
  };

  if (isPaid && existingInvoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Facture de prestation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{existingInvoice.reference}</span>
            <InvoiceStatusBadge status={existingInvoice.status as "PAID"} />
          </div>
          <p>Montant : {formatCurrency(existingInvoice.amount)}</p>
          {existingInvoice.paidAt && (
            <p className="text-muted-foreground">
              Payée le {formatDate(existingInvoice.paidAt)}
            </p>
          )}
          <InvoiceDownloadLinks invoiceId={existingInvoice.id} />
        </CardContent>
      </Card>
    );
  }

  if (isInvoiced && existingInvoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Facture de prestation enregistrée
          </CardTitle>
          <CardDescription>
            Document opérationnel visible dans l&apos;espace factures du client. Il ne constitue pas une facture électronique réglementaire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{existingInvoice.reference}</span>
            <InvoiceStatusBadge status={shown.status} daysOverdue={shown.daysOverdue} />
          </div>
          {existingLines.length > 0 && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              {existingLines.map((line, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {line.label}
                    {line.quantity > 1 ? ` × ${line.quantity}` : ""}
                  </span>
                  <span>{formatCurrency(line.amount * line.quantity)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <span>{formatCurrency(existingInvoice.amount)}</span>
              </div>
            </div>
          )}
          {can("invoices:update") && (
            <Button onClick={handlePayment} disabled={submitting} loading={submitting}>
              Enregistrer le règlement
            </Button>
          )}
          {existingInvoice.dueDate && (
            <p className="text-muted-foreground">
              Échéance : {formatDate(existingInvoice.dueDate)}
            </p>
          )}
          <InvoiceDownloadLinks invoiceId={existingInvoice.id} />
        </CardContent>
      </Card>
    );
  }

  if (!can("invoices:create")) return null;

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Facture de la commande
        </CardTitle>
        <CardDescription>
          Choisissez les lignes à facturer. La facture sera visible côté client. Document opérationnel, sans émission réglementaire de facture électronique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <>
            {order.items && order.items.some((i) => Number(i.unitPrice) > 0) && (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 max-md:min-h-11">
                <input
                  type="checkbox"
                  className="max-md:size-5"
                  checked={includePurchases}
                  onChange={(e) => setIncludePurchases(e.target.checked)}
                />
                <div className="flex-1">
                  <span className="font-medium">Inclure les achats articles</span>
                  <p className="text-xs text-muted-foreground">
                    Prix estimés saisis par le client
                  </p>
                </div>
              </label>
            )}

            <div className="space-y-2">
              <Label>Lignes personnalisées</Label>
              {customLines.map((line, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Libellé"
                    value={line.label}
                    onChange={(e) => {
                      const next = [...customLines];
                      const current = next[index] ?? { label: "", amount: "" };
                      next[index] = { label: e.target.value, amount: current.amount };
                      setCustomLines(next);
                    }}
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Montant"
                    className="w-28"
                    value={line.amount}
                    onChange={(e) => {
                      const next = [...customLines];
                      const current = next[index] ?? { label: "", amount: "" };
                      next[index] = { label: current.label, amount: e.target.value };
                      setCustomLines(next);
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setCustomLines(customLines.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCustomLines([...customLines, { label: "", amount: "" }])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Ajouter une ligne
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice-notes">Notes (optionnel)</Label>
              <Input
                id="invoice-notes"
                placeholder="Informations complémentaires sur la facture"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
              <span className="font-medium">Total hors taxes, TVA ajoutée à l’enregistrement</span>
              <span className="text-lg font-semibold">{formatCurrency(previewTotal)}</span>
            </div>

            <Button
              variant="brand"
              disabled={previewTotal <= 0 || submitting}
              loading={submitting}
              onClick={handleSubmit}
            >
              Enregistrer la facture
            </Button>
        </>
      </CardContent>
    </Card>
  );
}

/** Téléchargements de la facture : PDF classique et PDF Factur-X (XML CII embarqué). */
function InvoiceDownloadLinks({ invoiceId }: { invoiceId: string }) {
  const { can, isRole } = usePermissions();
  if (!can("invoices:read") || !isRole(["COMPANY_ADMIN", "MINI_ADMIN"])) return null;
  const base = `/api/invoices/${encodeURIComponent(invoiceId)}/pdf`;
  return (
    <div className="flex flex-wrap gap-2 pt-1" data-testid="invoice-downloads">
      <Button variant="outline" size="sm" asChild>
        <a href={base} target="_blank" rel="noopener noreferrer">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          PDF
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={`${base}?format=facturx`} target="_blank" rel="noopener noreferrer">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Factur-X
          <span className="sr-only"> (PDF avec données de facture électronique, nouvel onglet)</span>
        </a>
      </Button>
    </div>
  );
}
