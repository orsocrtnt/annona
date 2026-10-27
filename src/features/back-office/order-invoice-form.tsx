"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { InvoiceStatusBadge } from "@/features/client-portal/status-badges";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatDate } from "@/lib/utils";
import type { InvoiceLineItem } from "@/lib/validations/invoice";
import type { CompanyOrder } from "./types";
import { useCompanyTariffSettings } from "./tariff-settings-hooks";
import { backOfficeApi } from "./api";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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
  zoneId: string,
  feeIds: string[],
  includePurchases: boolean,
  customLines: { label: string; amount: string }[],
  order: OrderInvoiceFormProps["order"],
  tariffs: ReturnType<typeof useCompanyTariffSettings>["data"]
) {
  if (!tariffs) return 0;
  let total = 0;

  const zone = tariffs.tariffZones.find((z) => z.id === zoneId);
  if (zone) total += zone.price;

  for (const feeId of feeIds) {
    const fee = tariffs.tariffFees.find((f) => f.id === feeId);
    if (fee) total += fee.price;
  }

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
  const { data: tariffs, isLoading, isError } = useCompanyTariffSettings();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const hasPurchasePrices =
    order.items?.some((item) => Number(item.unitPrice) > 0) ?? false;
  const [zoneId, setZoneId] = useState("");
  const [feeIds, setFeeIds] = useState<string[]>([]);
  const [includePurchases, setIncludePurchases] = useState(hasPurchasePrices);
  const [customLines, setCustomLines] = useState<{ label: string; amount: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existingInvoice = order.invoices?.find((invoice) => invoice.status !== "CANCELLED");
  const existingLines = (existingInvoice?.lineItems ?? []) as InvoiceLineItem[];
  const isPaid = existingInvoice?.status === "PAID";
  const isInvoiced =
    existingInvoice?.status === "PENDING";

  const suggestedZone = useMemo(() => {
    if (!tariffs || !order.shippingPostalCode) return null;
    const normalized = order.shippingPostalCode.trim();
    return (
      tariffs.tariffZones.find((zone) =>
        zone.postalCodePrefixes.some((prefix) => normalized.startsWith(prefix.trim()))
      ) ?? null
    );
  }, [tariffs, order.shippingPostalCode]);

  useEffect(() => {
    if (suggestedZone && !zoneId) setZoneId(suggestedZone.id);
  }, [suggestedZone, zoneId]);

  const previewTotal = computeTotal(
    zoneId,
    feeIds,
    includePurchases,
    customLines,
    order,
    tariffs
  );

  const toggleFee = (id: string) => {
    setFeeIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleSubmit = async () => {
    if (previewTotal <= 0) {
      if (includePurchases && !hasPurchasePrices) {
        toast.error("Aucun prix d'achat", {
          description:
            "Le livreur doit d'abord valider les prix des articles, ou ajoutez une zone tarifaire.",
        });
      } else {
        toast.error("Sélectionnez au moins une zone, un supplément ou une ligne");
      }
      return;
    }
    if (zoneId && !tariffs?.tariffZones.some((z) => z.id === zoneId)) {
      toast.error("Zone tarifaire invalide", {
        description: "Rechargez la page ou sélectionnez une autre zone.",
      });
      return;
    }
    setSubmitting(true);
    try {
      await backOfficeApi.createOrderInvoice(order.id, {
        zoneId: zoneId || undefined,
        feeIds,
        includePurchases,
        customLines: customLines
          .filter((l) => l.label && parseFloat(l.amount) > 0)
          .map((l) => ({ label: l.label, amount: parseFloat(l.amount) })),
        notes: notes || undefined,
      });
      toast.success("Relevé enregistré — le client peut le consulter");
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

  if (isInitialQueryLoading(isLoading, tariffs)) return <PageSkeleton />;

  if (isError || !tariffs) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Impossible de charger les tarifs. Vérifiez votre connexion ou configurez-les dans{" "}
          <Link href="/settings" className="text-brand underline underline-offset-2 hover:decoration-2">
            Paramètres
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  if (isPaid && existingInvoice) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Relevé de prestation
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
            Relevé de prestation enregistré
          </CardTitle>
          <CardDescription>
            Document opérationnel visible dans l&apos;espace factures du client. Il ne constitue pas une facture électronique réglementaire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{existingInvoice.reference}</span>
            <InvoiceStatusBadge status={existingInvoice.status as "PENDING"} />
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
        </CardContent>
      </Card>
    );
  }

  if (!can("invoices:create")) return null;

  const hasTariffs =
    tariffs.tariffZones.length > 0 || tariffs.tariffFees.length > 0;

  return (
    <Card className="border-brand/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Tarifs de la prestation
        </CardTitle>
        <CardDescription>
          Choisissez les tarifs à appliquer. Le relevé sera visible côté client. Document opérationnel, distinct de l&apos;abonnement TutelLiv, sans émission réglementaire de facture électronique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasTariffs ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aucun tarif configuré.{" "}
            <Link href="/settings" className="text-brand underline underline-offset-2 hover:decoration-2">
              Configurez vos zones et tarifs
            </Link>{" "}
            dans les paramètres.
          </div>
        ) : (
          <>
            {tariffs.tariffZones.length > 0 && (
              <div className="space-y-2">
                <Label>Zone de livraison</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                >
                  <option value="">— Aucune zone —</option>
                  {tariffs.tariffZones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name} — {formatCurrency(zone.price)}
                      {suggestedZone?.id === zone.id ? " (suggérée)" : ""}
                    </option>
                  ))}
                </select>
                {order.shippingPostalCode && (
                  <p className="text-xs text-muted-foreground">
                    Code postal livraison : {order.shippingPostalCode}
                  </p>
                )}
              </div>
            )}

            {tariffs.tariffFees.length > 0 && (
              <div className="space-y-2">
                <Label>Suppléments</Label>
                <div className="space-y-2">
                  {tariffs.tariffFees.map((fee) => (
                    <label
                      key={fee.id}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
                    >
                      <input
                        type="checkbox"
                        checked={feeIds.includes(fee.id)}
                        onChange={() => toggleFee(fee.id)}
                      />
                      <div className="flex-1">
                        <span className="font-medium">{fee.name}</span>
                        {fee.description && (
                          <p className="text-xs text-muted-foreground">{fee.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-medium">{formatCurrency(fee.price)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {order.items && order.items.some((i) => Number(i.unitPrice) > 0) && (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <input
                  type="checkbox"
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
              <span className="font-medium">Total facture</span>
              <span className="text-lg font-semibold">{formatCurrency(previewTotal)}</span>
            </div>

            <Button
              variant="brand"
              disabled={previewTotal <= 0 || submitting}
              loading={submitting}
              onClick={handleSubmit}
            >
              Enregistrer le relevé
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
