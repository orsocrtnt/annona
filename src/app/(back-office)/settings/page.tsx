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
  useUpdateCompanyDeliveryOptions,
} from "@/features/back-office/company-settings-hooks";
import type { DeliveryCategory } from "@prisma/client";
import { Package, Bike, Sparkles } from "lucide-react";
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
  SPECIAL_MISSION: Sparkles,
} as const;

export default function SettingsPage() {
  const { data: options, isLoading } = useCompanyDeliveryOptions();
  const updateOptions = useUpdateCompanyDeliveryOptions();
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
                  className="mt-1"
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
    </div>
  );
}
