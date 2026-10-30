"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loader";
import { CompanyLogoCard } from "@/features/back-office/company-logo-card";
import { useAuthStore } from "@/stores/auth.store";
import { DELIVERY_CATEGORY_DESCRIPTIONS, DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import {
  useCompanyDeliveryOptions,
  useCompanyPortalSettings,
  useCompanyProofRules,
  useUpdateCompanyDeliveryOptions,
  useUpdateCompanyPortalSettings,
  useUpdateCompanyProofRules,
} from "@/features/back-office/company-settings-hooks";
import type { DeliveryCategory } from "@prisma/client";
import { Package, Bike, Briefcase } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES: DeliveryCategory[] = ["STANDARD", "COURIER", "SPECIAL_MISSION"];

const SETTINGS_CATEGORY_LABELS: Record<DeliveryCategory, string> = {
  ...DELIVERY_CATEGORY_LABELS,
  STANDARD: "Commande",
  COURIER: "Course",
  SPECIAL_MISSION: "Mission spéciale",
};

const SETTINGS_CATEGORY_DESCRIPTIONS: Record<DeliveryCategory, string> = {
  ...DELIVERY_CATEGORY_DESCRIPTIONS,
  STANDARD: "Achat et livraison",
  COURIER: "Collecte et livraison",
  SPECIAL_MISSION:
    "Expérimental, hors offre pilote — demande multi-adresses ; devis et accord gérés hors TutelLiv",
};

const CATEGORY_ICONS = {
  STANDARD: Package,
  COURIER: Bike,
  SPECIAL_MISSION: Briefcase,
} as const;

export default function SettingsPage() {
  const { data: options, isLoading } = useCompanyDeliveryOptions();
  const updateOptions = useUpdateCompanyDeliveryOptions();
  const { data: portal } = useCompanyPortalSettings();
  const updatePortal = useUpdateCompanyPortalSettings();
  const { data: proofRules } = useCompanyProofRules();
  const updateProofRules = useUpdateCompanyProofRules();
  const readOnly = useAuthStore((state) => state.saas?.canMutate === false);
  const [local, setLocal] = useState(options?.deliveryCategories);

  useEffect(() => {
    if (options) setLocal(options.deliveryCategories);
  }, [options]);

  const handleToggle = (category: DeliveryCategory) => {
    if (!local) return;
    setLocal((prev) =>
      prev ? { ...prev, [category]: !prev[category] } : prev
    );
  };

  const handleSave = async () => {
    if (!local) return;
    try {
      await updateOptions.mutateAsync({ deliveryCategories: local });
      toast.success("Options client mises à jour");
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleDriverPhone = async (portalShowDriverPhone: boolean) => {
    try {
      await updatePortal.mutateAsync({ portalShowDriverPhone });
      toast.success(portalShowDriverPhone ? "Téléphone du livreur visible par les clients" : "Téléphone du livreur masqué aux clients");
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const handleProofRule = async (patch: { signatureRequired: boolean } | { emailToClient: boolean }) => {
    try {
      await updateProofRules.mutateAsync(patch);
      toast.success(
        "signatureRequired" in patch
          ? patch.signatureRequired ? "Signature du réceptionnaire obligatoire" : "Signature du réceptionnaire facultative"
          : patch.emailToClient ? "La preuve sera envoyée au client par e-mail" : "La preuve ne sera plus envoyée au client par e-mail"
      );
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const hasChange =
    local &&
    options &&
    (local.STANDARD !== options.deliveryCategories.STANDARD ||
      local.COURIER !== options.deliveryCategories.COURIER ||
      local.SPECIAL_MISSION !== options.deliveryCategories.SPECIAL_MISSION);

  if (isLoading || !local) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-muted-foreground">
          Options proposées aux clients. Les règles dispatch se configurent dans le{" "}
          <Link href="/dispatch" className="text-brand underline underline-offset-2 hover:decoration-2">
            centre de dispatch
          </Link>
          .
        </p>
      </div>

      <CompanyLogoCard readOnly={readOnly} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Options de livraison client</CardTitle>
          <CardDescription>
            Activez ou désactivez les types de commande proposés à vos clients.
            Les options désactivées n&apos;apparaissent pas du tout dans leur espace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category];
            const enabled = local[category];
            return (
              <label
                key={category}
                className={`flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors ${
                  enabled ? "border-brand/30 bg-brand-subtle/20" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 max-md:size-5"
                  checked={enabled}
                  onChange={() => handleToggle(category)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${enabled ? "text-brand" : "text-muted-foreground"}`} />
                    <span className="font-medium">{SETTINGS_CATEGORY_LABELS[category]}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {SETTINGS_CATEGORY_DESCRIPTIONS[category]}
                  </p>
                </div>
              </label>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Au moins une option doit rester active.
          </p>
          <Button
            variant="brand"
            disabled={!hasChange || updateOptions.isPending}
            loading={updateOptions.isPending}
            onClick={handleSave}
          >
            Enregistrer les options
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Livreur dans l&apos;espace client</CardTitle>
          <CardDescription>
            Vos clients voient toujours le prénom du livreur, jamais son nom de famille.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border p-3 max-md:items-center">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0"
              checked={portal?.portalShowDriverPhone ?? true}
              disabled={!portal || readOnly || updatePortal.isPending}
              onChange={(event) => handleDriverPhone(event.target.checked)}
            />
            <span className="text-sm font-medium">Afficher le téléphone du livreur aux clients</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preuve de livraison</CardTitle>
          <CardDescription>
            Ce que le livreur doit recueillir à la remise. Une photo reste toujours demandée ; avec une
            signature, le nom du réceptionnaire est obligatoire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0"
              checked={proofRules?.signatureRequired ?? false}
              disabled={!proofRules || readOnly || updateProofRules.isPending}
              onChange={(event) => handleProofRule({ signatureRequired: event.target.checked })}
            />
            <span className="text-sm">
              <span className="font-medium">Signature du réceptionnaire obligatoire</span>
              <span className="mt-0.5 block text-muted-foreground">
                Sans signature, le livreur doit noter le refus et son motif.
              </span>
            </span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0"
              checked={proofRules?.emailToClient ?? true}
              disabled={!proofRules || readOnly || updateProofRules.isPending}
              onChange={(event) => handleProofRule({ emailToClient: event.target.checked })}
            />
            <span className="text-sm">
              <span className="font-medium">Envoyer la preuve au client par e-mail</span>
              <span className="mt-0.5 block text-muted-foreground">
                Lien vers la preuve (PDF) envoyé au donneur d&apos;ordre une fois la livraison validée.
              </span>
            </span>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
