"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loader";
import type { CompanyTariffSettings, TariffFee, TariffZone } from "@/lib/validations/tariff-settings";
import {
  useCompanyTariffSettings,
  useUpdateCompanyTariffSettings,
} from "./tariff-settings-hooks";
import { MapPin, Plus, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";

function newZone(): TariffZone {
  return {
    id: crypto.randomUUID(),
    name: "",
    postalCodePrefixes: [],
    price: 0,
  };
}

function newFee(): TariffFee {
  return {
    id: crypto.randomUUID(),
    name: "",
    price: 0,
  };
}

type TariffSettingsFormProps = {
  /** Intégré dans la page Facturation (libellés orientés courses). */
  embedded?: boolean;
};

export function TariffSettingsForm({ embedded = false }: TariffSettingsFormProps) {
  const { data: settings, isLoading } = useCompanyTariffSettings();
  const updateSettings = useUpdateCompanyTariffSettings();
  const [local, setLocal] = useState<CompanyTariffSettings | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const handleSave = async () => {
    if (!local) return;

    for (const zone of local.tariffZones) {
      if (!zone.name.trim()) {
        toast.error("Chaque zone doit avoir un nom");
        return;
      }
      if (zone.postalCodePrefixes.length === 0) {
        toast.error(`La zone « ${zone.name || "sans nom"} » doit avoir au moins un préfixe postal`);
        return;
      }
    }

    for (const fee of local.tariffFees) {
      if (!fee.name.trim()) {
        toast.error("Chaque supplément doit avoir un nom");
        return;
      }
    }

    try {
      await updateSettings.mutateAsync(local);
      toast.success("Tarifs enregistrés");
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const updateZone = (index: number, patch: Partial<TariffZone>) => {
    if (!local) return;
    const zones = [...local.tariffZones];
    zones[index] = { ...zones[index], ...patch } as TariffZone;
    setLocal({ ...local, tariffZones: zones });
  };

  const updateFee = (index: number, patch: Partial<TariffFee>) => {
    if (!local) return;
    const fees = [...local.tariffFees];
    fees[index] = { ...fees[index], ...patch } as TariffFee;
    setLocal({ ...local, tariffFees: fees });
  };

  if (isLoading || !local) return <PageLoader />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Zones tarifaires
          </CardTitle>
          <CardDescription>
            {embedded
              ? "Zones géographiques pour les courses. Les préfixes postaux (ex. 75, 92) associent automatiquement une zone à une course."
              : "Définissez vos zones de livraison et leur tarif. Utilisez des préfixes postaux (ex. 75, 92, 13001) pour associer automatiquement une zone à une commande."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {local.tariffZones.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune zone configurée.</p>
          )}
          {local.tariffZones.map((zone, index) => (
            <div key={zone.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Zone {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setLocal({
                      ...local,
                      tariffZones: local.tariffZones.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nom de la zone</Label>
                  <Input
                    placeholder="Paris intra-muros"
                    value={zone.name}
                    onChange={(e) => updateZone(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Tarif livraison (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={zone.price || ""}
                    onChange={(e) =>
                      updateZone(index, { price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Préfixes postaux (séparés par des virgules)</Label>
                <Input
                  placeholder="75, 92, 93"
                  value={zone.postalCodePrefixes.join(", ")}
                  onChange={(e) =>
                    updateZone(index, {
                      postalCodePrefixes: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLocal({ ...local, tariffZones: [...local.tariffZones, newZone()] })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter une zone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            Suppléments et options
          </CardTitle>
          <CardDescription>
            Tarifs additionnels sélectionnables au moment de la facturation
            (coursier, urgence, étage sans ascenseur, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {local.tariffFees.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun supplément configuré.</p>
          )}
          {local.tariffFees.map((fee, index) => (
            <div key={fee.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Supplément {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    setLocal({
                      ...local,
                      tariffFees: local.tariffFees.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Nom</Label>
                  <Input
                    placeholder="Supplément coursier"
                    value={fee.name}
                    onChange={(e) => updateFee(index, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Montant (€)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fee.price || ""}
                    onChange={(e) =>
                      updateFee(index, { price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Description (optionnel)</Label>
                <Input
                  placeholder="Collecte et livraison"
                  value={fee.description ?? ""}
                  onChange={(e) => updateFee(index, { description: e.target.value })}
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLocal({ ...local, tariffFees: [...local.tariffFees, newFee()] })
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Ajouter un supplément
          </Button>
        </CardContent>
      </Card>

      <Button
        variant="brand"
        disabled={updateSettings.isPending}
        loading={updateSettings.isPending}
        onClick={handleSave}
      >
        Enregistrer les tarifs
      </Button>
    </div>
  );
}
