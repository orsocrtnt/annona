"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loader";
import { TariffSettingsForm } from "@/features/back-office/tariff-settings-form";
import {
  useCompanyBillingSettings,
  useUpdateCompanyBillingSettings,
} from "@/features/back-office/billing-settings-hooks";
import type { CompanyBillingSettings } from "@/lib/validations/billing-settings";
import { cn } from "@/lib/utils";
import { Bike, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";

type BillingTab = "courses" | "general";

const TABS: { key: BillingTab; label: string; icon: typeof Bike }[] = [
  { key: "courses", label: "Courses", icon: Bike },
  { key: "general", label: "Factures", icon: FileText },
];

function parseNumber(value: string) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function CourierPricingSection({
  local,
  setLocal,
}: {
  local: CompanyBillingSettings;
  setLocal: (next: CompanyBillingSettings) => void;
}) {
  const courier = local.courier;

  const updateCourier = (patch: Partial<CompanyBillingSettings["courier"]>) => {
    setLocal({ ...local, courier: { ...courier, ...patch } });
  };

  const previewEstimate = Math.max(
    courier.minimumPrice,
    courier.basePrice + courier.pricePerKm * 5
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bike className="h-4 w-4" />
            Tarification des courses
          </CardTitle>
          <CardDescription>
            Paramètres de base pour facturer une course (COURIER). Les zones et suppléments
            ci-dessous s&apos;appliquent en complément.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="billing-base-price">Forfait de prise en charge (€)</Label>
            <Input
              id="billing-base-price"
              type="number"
              min="0"
              step="0.01"
              value={courier.basePrice || ""}
              onChange={(e) => updateCourier({ basePrice: parseNumber(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="billing-price-per-km">Prix au km (€)</Label>
            <Input
              id="billing-price-per-km"
              type="number"
              min="0"
              step="0.01"
              value={courier.pricePerKm || ""}
              onChange={(e) => updateCourier({ pricePerKm: parseNumber(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="billing-minimum-price">Minimum facturable (€)</Label>
            <Input
              id="billing-minimum-price"
              type="number"
              min="0"
              step="0.01"
              value={courier.minimumPrice || ""}
              onChange={(e) => updateCourier({ minimumPrice: parseNumber(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="billing-included-km">Km inclus dans le forfait</Label>
            <Input
              id="billing-included-km"
              type="number"
              min="0"
              step="0.1"
              value={courier.freeKmIncluded || ""}
              onChange={(e) => updateCourier({ freeKmIncluded: parseNumber(e.target.value) })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="billing-night-surcharge">Majoration nuit (%)</Label>
            <Input
              id="billing-night-surcharge"
              type="number"
              min="0"
              max="100"
              step="1"
              value={courier.nightSurchargePercent || ""}
              onChange={(e) =>
                updateCourier({ nightSurchargePercent: parseNumber(e.target.value) })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="billing-weekend-surcharge">Majoration week-end (%)</Label>
            <Input
              id="billing-weekend-surcharge"
              type="number"
              min="0"
              max="100"
              step="1"
              value={courier.weekendSurchargePercent || ""}
              onChange={(e) =>
                updateCourier({ weekendSurchargePercent: parseNumber(e.target.value) })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 max-md:items-start sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Estimation de prix visible par le client</p>
            <p className="text-xs text-muted-foreground">
              Affiche un prix indicatif au client lorsqu&apos;il crée une course, calculé selon
              ces tarifs. Le prix final reste fixé par votre entreprise.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={courier.showClientEstimate}
            aria-label="Activer l'estimation de prix client"
            onClick={() => updateCourier({ showClientEstimate: !courier.showClientEstimate })}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              courier.showClientEstimate ? "bg-brand" : "bg-muted-foreground/30"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                courier.showClientEstimate ? "translate-x-5" : "translate-x-0.5"
              )}
            />
          </button>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Aperçu indicatif</CardTitle>
          <CardDescription>
            Exemple pour une course d&apos;environ 5 km (hors zones et suppléments).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{previewEstimate.toFixed(2)} €</p>
          <p className="mt-1 text-xs text-muted-foreground">
            max({courier.minimumPrice.toFixed(2)} €, {courier.basePrice.toFixed(2)} € +{" "}
            {courier.pricePerKm.toFixed(2)} €/km × distance)
          </p>
        </CardContent>
      </Card>

      <TariffSettingsForm embedded />
    </div>
  );
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
      </CardContent>
    </Card>
  );
}

export function BillingSettingsContent() {
  const [tab, setTab] = useState<BillingTab>("courses");
  const { data: settings, isLoading } = useCompanyBillingSettings();
  const updateSettings = useUpdateCompanyBillingSettings();
  const [local, setLocal] = useState<CompanyBillingSettings | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

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
        <p className="mt-1 text-muted-foreground">
          Tarification des courses, zones, suppléments et paramètres de facture
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

      {tab === "courses" ? (
        <CourierPricingSection local={local} setLocal={setLocal} />
      ) : (
        <InvoiceGeneralSection local={local} setLocal={setLocal} />
      )}

      <Button
        variant="brand"
        disabled={updateSettings.isPending}
        loading={updateSettings.isPending}
        onClick={handleSave}
      >
        Enregistrer la facturation
      </Button>
    </div>
  );
}
