"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loader";
import { EinvoicingSettingsCard } from "@/features/back-office/einvoicing-settings-card";
import {
  useCompanyBillingSettings,
  useUpdateCompanyBillingSettings,
} from "@/features/back-office/billing-settings-hooks";
import type { CompanyBillingSettings } from "@/lib/validations/billing-settings";
import { cn } from "@/lib/utils";
import { FileText, Receipt, Wallet } from "lucide-react";
import { toast } from "sonner";

type BillingTab = "payments" | "general";

const TABS: { key: BillingTab; label: string; icon: typeof Wallet }[] = [
  { key: "payments", label: "Paiements", icon: Wallet },
  { key: "general", label: "Factures", icon: FileText },
];

function parseNumber(value: string) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function InvoiceGeneralSection({
  local,
  setLocal,
}: {
  local: CompanyBillingSettings;
  setLocal: (next: CompanyBillingSettings) => void;
}) {
  const invoice = local.invoice;

  const updateInvoice = (patch: Partial<CompanyBillingSettings["invoice"]>) => {
    setLocal({ ...local, invoice: { ...invoice, ...patch } });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Receipt className="h-4 w-4" />
          Paramètres généraux de facturation
        </CardTitle>
        <CardDescription>
          Options par défaut appliquées lors de l&apos;émission des factures.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="billing-vat-rate">TVA (%)</Label>
          <Input
            id="billing-vat-rate"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={invoice.vatRate || ""}
            onChange={(e) => updateInvoice({ vatRate: parseNumber(e.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="billing-due-days">Délai de paiement (jours)</Label>
          <Input
            id="billing-due-days"
            type="number"
            min="1"
            max="365"
            step="1"
            value={invoice.defaultDueDays || ""}
            onChange={(e) =>
              updateInvoice({ defaultDueDays: Math.max(1, Math.round(parseNumber(e.target.value))) })
            }
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="billing-reference-prefix">Préfixe des références</Label>
          <Input
            id="billing-reference-prefix"
            placeholder="FAC"
            value={invoice.referencePrefix}
            onChange={(e) => updateInvoice({ referencePrefix: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="billing-footer-note">Note de pied de page (optionnel)</Label>
          <Input
            id="billing-footer-note"
            placeholder="Merci pour votre confiance."
            value={invoice.footerNote}
            onChange={(e) => updateInvoice({ footerNote: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4 max-md:items-start sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p id="billing-auto-invoice-label" className="text-sm font-medium">Émettre la facture à la livraison</p>
            <p className="text-xs text-muted-foreground">
              Dès qu&apos;une commande passe en « Livrée », la facture est émise avec les achats validés, puis envoyée au client par e-mail. Désactivé : vous facturez à la main.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={invoice.autoInvoiceOnDelivery}
            aria-labelledby="billing-auto-invoice-label"
            onClick={() => updateInvoice({ autoInvoiceOnDelivery: !invoice.autoInvoiceOnDelivery })}
            className="relative inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                invoice.autoInvoiceOnDelivery ? "bg-brand" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform dark:bg-foreground",
                  invoice.autoInvoiceOnDelivery ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BillingSettingsContent() {
  const [tab, setTab] = useState<BillingTab>("payments");
  const { data: settings, isLoading } = useCompanyBillingSettings();
  const updateSettings = useUpdateCompanyBillingSettings();
  const [local, setLocal] = useState<CompanyBillingSettings | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  // Lien direct vers un champ Factur-X (#einvoicing-…) : ouvre l'onglet qui le contient.
  useEffect(() => {
    if (window.location.hash.startsWith("#einvoicing-")) setTab("general");
  }, []);

  const handleSave = async () => {
    if (!local) return;
    try {
      await updateSettings.mutateAsync(local);
      toast.success("Paramètres de facturation enregistrés");
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (isLoading || !local) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facturation</h1>
        <p className="mt-1 text-muted-foreground max-md:hidden">
          Paiements et paramètres de facture
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                tab === item.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "payments" ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Factures par période, règlements et relances : à venir avec la tâche FACT-1.
        </p>
      ) : (
        <InvoiceGeneralSection local={local} setLocal={setLocal} />
      )}

      {tab !== "payments" && (
        <Button
          variant="brand"
          disabled={updateSettings.isPending}
          loading={updateSettings.isPending}
          onClick={handleSave}
        >
          Enregistrer la facturation
        </Button>
      )}

      {tab === "general" && <EinvoicingSettingsCard />}
    </div>
  );
}
