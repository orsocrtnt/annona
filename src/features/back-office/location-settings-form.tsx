"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loader";
import type { DriverLocationSettings } from "@/lib/validations/driver-location-settings";
import {
  useCompanyLocationSettings,
  useUpdateCompanyLocationSettings,
} from "./location-settings-hooks";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value) || min));
}

export function LocationSettingsForm() {
  const { data: settings, isLoading } = useCompanyLocationSettings();
  const updateSettings = useUpdateCompanyLocationSettings();
  const [local, setLocal] = useState<DriverLocationSettings | null>(null);

  useEffect(() => {
    if (settings) setLocal(settings);
  }, [settings]);

  const handleSave = async () => {
    if (!local) return;
    try {
      await updateSettings.mutateAsync(local);
      toast.success("Paramètres de localisation enregistrés");
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  if (isLoading || !local) return <PageLoader />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 text-brand" />
          <div>
            <CardTitle className="text-base">Suivi GPS livreurs</CardTitle>
            <CardDescription>
              Fréquence adaptative : plus rapide pendant une tournée, plus espacée au repos.
              Le livreur doit garder l&apos;app ouverte dans Safari pour que le suivi fonctionne.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="loc-active">Tournée en cours (secondes)</Label>
            <Input
              id="loc-active"
              type="number"
              min={2}
              max={60}
              value={local.activeMissionIntervalSeconds}
              onChange={(e) =>
                setLocal({
                  ...local,
                  activeMissionIntervalSeconds: clampInt(Number(e.target.value), 2, 60),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Pendant une tournée démarrée (4 à 5 s conseillées).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loc-idle">Au repos (secondes)</Label>
            <Input
              id="loc-idle"
              type="number"
              min={5}
              max={120}
              value={local.idleIntervalSeconds}
              onChange={(e) =>
                setLocal({
                  ...local,
                  idleIntervalSeconds: clampInt(Number(e.target.value), 5, 120),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Livreur connecté sans tournée en cours (10 à 30 s conseillées).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loc-admin">Rafraîchissement carte admin (secondes)</Label>
            <Input
              id="loc-admin"
              type="number"
              min={5}
              max={60}
              value={local.adminMapRefreshSeconds}
              onChange={(e) =>
                setLocal({
                  ...local,
                  adminMapRefreshSeconds: clampInt(Number(e.target.value), 5, 60),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Fréquence d&apos;actualisation de la carte de suivi des tournées.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="loc-online">Seuil « en ligne » (secondes)</Label>
            <Input
              id="loc-online"
              type="number"
              min={10}
              max={180}
              value={local.onlineThresholdSeconds}
              onChange={(e) =>
                setLocal({
                  ...local,
                  onlineThresholdSeconds: clampInt(Number(e.target.value), 10, 180),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Sans signal GPS depuis ce délai, le livreur apparaît hors ligne sur la carte.
            </p>
          </div>
        </div>

        <Button
          variant="brand"
          loading={updateSettings.isPending}
          disabled={updateSettings.isPending}
          onClick={handleSave}
        >
          Enregistrer la localisation
        </Button>
      </CardContent>
    </Card>
  );
}
