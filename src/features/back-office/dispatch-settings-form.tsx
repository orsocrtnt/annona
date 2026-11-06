"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type CompanyDispatchSettings,
  type DispatchDriverRule,
  normalizeDispatchDriverRule,
} from "@/lib/validations/dispatch-settings";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { useCompanyDrivers } from "./hooks";
import {
  useCompanyDispatchSettings,
  useUpdateCompanyDispatchSettings,
} from "./dispatch-settings-hooks";
import { formatDriverFromParts } from "@/lib/format/person-labels";
import { formatPostalCodeList, parsePostalCodeList } from "@/lib/dispatch/postal-codes";
import { Bike, Package, Plus, Radio, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function driverLabel(firstName: string, lastName: string) {
  return formatDriverFromParts({ firstName, lastName }, null);
}

function createDefaultRule(driverId: string, priority: number): DispatchDriverRule {
  return normalizeDispatchDriverRule({
    driverId,
    priority,
    allowedCategories: { STANDARD: true, COURIER: true, SPECIAL_MISSION: false },
    postalCodePrefixes: [],
    dispatchStatus: "ACTIVE",
  });
}

export function DispatchSettingsForm() {
  const { data: settings, isLoading } = useCompanyDispatchSettings();
  const { data: drivers } = useCompanyDrivers();
  const updateSettings = useUpdateCompanyDispatchSettings();
  const [local, setLocal] = useState<CompanyDispatchSettings | null>(null);
  const [postalDrafts, setPostalDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setLocal(settings);
      setPostalDrafts({});
    }
  }, [settings]);

  const syncAllDrivers = () => {
    if (!local || !drivers?.length) return;
    const existing = new Set(local.driverRules.map((r) => r.driverId));
    let nextPriority = local.driverRules.reduce((m, r) => Math.max(m, r.priority), 0);
    const toAdd = drivers
      .filter((d) => !existing.has(d.id))
      .map((d) => createDefaultRule(d.id, ++nextPriority));

    if (toAdd.length === 0) {
      toast.info("Tous les livreurs ont déjà un profil");
      return;
    }

    setLocal({ ...local, driverRules: [...local.driverRules, ...toAdd] });
    toast.success(`${toAdd.length} profil(s) ajouté(s)`);
  };

  const handleSave = async () => {
    if (!local) return;

    const ruleDriverIds = local.driverRules.map((r) => r.driverId);
    const duplicates = ruleDriverIds.filter((id, i) => ruleDriverIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      toast.error("Chaque livreur ne peut apparaître qu'une fois");
      return;
    }

    for (const rule of local.driverRules) {
      const cats = rule.allowedCategories ?? {
        STANDARD: true,
        COURIER: true,
        SPECIAL_MISSION: false,
      };
      if (!cats.STANDARD && !cats.COURIER && !cats.SPECIAL_MISSION) {
        toast.error("Chaque livreur doit autoriser au moins un type de mission");
        return;
      }
    }

    try {
      await updateSettings.mutateAsync(local);
      toast.success("Règles de dispatch enregistrées");
    } catch (error) {
      toast.error("Enregistrement impossible", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const addDriverRule = () => {
    if (!local || !drivers?.length) return;
    const used = new Set(local.driverRules.map((r) => r.driverId));
    const nextDriver = drivers.find((d) => !used.has(d.id));
    if (!nextDriver) {
      toast.error("Tous les livreurs sont déjà configurés");
      return;
    }
    const maxPriority = local.driverRules.reduce((m, r) => Math.max(m, r.priority), 0);
    setLocal({
      ...local,
      driverRules: [...local.driverRules, createDefaultRule(nextDriver.id, maxPriority + 1)],
    });
  };

  const updateRule = (index: number, patch: Partial<DispatchDriverRule>) => {
    if (!local) return;
    const rules = [...local.driverRules];
    const current = rules[index];
    if (!current) return;
    rules[index] = normalizeDispatchDriverRule({
      ...current,
      ...patch,
    });
    setLocal({ ...local, driverRules: rules });
  };

  const removeRule = (index: number) => {
    if (!local) return;
    setLocal({
      ...local,
      driverRules: local.driverRules.filter((_, i) => i !== index),
    });
  };

  const unconfiguredCount = useMemo(() => {
    if (!drivers?.length || !local) return 0;
    const configured = new Set(local.driverRules.map((r) => r.driverId));
    return drivers.filter((d) => !configured.has(d.id)).length;
  }, [drivers, local]);

  if (isLoading || !local) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* ── Section 1 : Profils livreurs (prioritaire) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Profils livreurs
          </CardTitle>
          <CardDescription>
            Définissez pour chaque livreur ce qu&apos;il peut faire : commandes, courses, codes
            postaux, charge max et pause. Sans profil, un livreur accepte tout par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unconfiguredCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm">
                <span className="font-medium">{unconfiguredCount} livreur(s)</span> sans profil
                dispatch — les règles par catégorie et par code postal ne s&apos;appliquent pas encore.
              </p>
              <Button type="button" variant="brand" size="sm" onClick={syncAllDrivers}>
                <Plus className="mr-1 h-4 w-4" />
                Configurer tous les livreurs
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {local.driverRules.length} profil(s) configuré(s)
              {drivers?.length ? ` sur ${drivers.length} livreur(s) actif(s)` : ""}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDriverRule}
              disabled={!drivers?.length || unconfiguredCount === 0}
            >
              <Plus className="mr-1 h-4 w-4" />
              Ajouter un livreur
            </Button>
          </div>

          {local.driverRules.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">Aucun profil livreur</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cliquez sur « Configurer tous les livreurs » pour définir les règles par catégorie
                (commandes / courses) et par code postal.
              </p>
              {drivers?.length ? (
                <Button type="button" variant="brand" size="sm" className="mt-4" onClick={syncAllDrivers}>
                  Configurer les {drivers.length} livreur(s)
                </Button>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Créez d&apos;abord des comptes livreur dans Gestion des comptes.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {local.driverRules.map((rule, index) => {
                const driver = drivers?.find((d) => d.id === rule.driverId);
                const cats = rule.allowedCategories ?? {
        STANDARD: true,
        COURIER: true,
        SPECIAL_MISSION: false,
      };
                const isPaused = rule.dispatchStatus === "PAUSED";

                return (
                  <div
                    key={`${rule.driverId}-${index}`}
                    className={cn(
                      "space-y-4 rounded-xl border p-4",
                      isPaused && "border-dashed opacity-80"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {driver
                            ? driverLabel(driver.firstName, driver.lastName)
                            : "Livreur inconnu"}
                        </span>
                        {cats.STANDARD && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Package className="h-3 w-3" />
                            Commandes
                          </Badge>
                        )}
                        {cats.COURIER && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Bike className="h-3 w-3" />
                            Courses
                          </Badge>
                        )}
                        {isPaused && (
                          <Badge variant="outline" className="text-xs text-warning">
                            En pause
                          </Badge>
                        )}
                        {(rule.postalCodePrefixes ?? []).length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {(rule.postalCodePrefixes ?? []).length} CP
                          </Badge>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRule(index)}
                        aria-label="Retirer le profil"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">
                        <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Types de mission autorisés
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {(["STANDARD", "COURIER", "SPECIAL_MISSION"] as const).map((category) => (
                            <label
                              key={category}
                              className={cn(
                                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                                cats[category] && "border-brand/30 bg-brand-subtle/20"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="max-md:size-5"
                                checked={cats[category]}
                                onChange={(e) =>
                                  updateRule(index, {
                                    allowedCategories: {
                                      ...cats,
                                      [category]: e.target.checked,
                                    },
                                  })
                                }
                              />
                              {DELIVERY_CATEGORY_LABELS[category]}
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Priorité</Label>
                          <Input
                            type="number"
                            min={1}
                            value={rule.priority}
                            onChange={(e) =>
                              updateRule(index, {
                                priority: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Max actives</Label>
                          <Input
                            type="number"
                            min={1}
                            placeholder={String(local.maxActiveDeliveriesPerDriver)}
                            value={rule.maxActiveDeliveries ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              updateRule(index, {
                                maxActiveDeliveries: raw
                                  ? Math.max(1, Number(raw) || 1)
                                  : undefined,
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Capacité (kg)</Label>
                          <Input
                            type="number"
                            min={1}
                            aria-label="Capacité du véhicule en kg"
                            placeholder="Sans limite"
                            value={rule.vehicleCapacityKg ?? ""}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              updateRule(index, { vehicleCapacityKg: e.target.value && value > 0 ? value : undefined });
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Livreur</Label>
                          <Select
                            value={rule.driverId}
                            onValueChange={(value) => updateRule(index, { driverId: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(drivers ?? []).map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {driverLabel(d.firstName, d.lastName)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Max commandes actives</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Illimité"
                          value={rule.maxActiveByCategory?.STANDARD ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateRule(index, {
                              maxActiveByCategory: {
                                ...rule.maxActiveByCategory,
                                STANDARD: raw ? Math.max(1, Number(raw) || 1) : undefined,
                              },
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max courses actives</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Illimité"
                          value={rule.maxActiveByCategory?.COURIER ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            updateRule(index, {
                              maxActiveByCategory: {
                                ...rule.maxActiveByCategory,
                                COURIER: raw ? Math.max(1, Number(raw) || 1) : undefined,
                              },
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Codes postaux couverts</Label>
                        <Input
                          placeholder="75009, 75007, 75001, 92"
                          value={
                            postalDrafts[rule.driverId] ??
                            formatPostalCodeList(rule.postalCodePrefixes ?? [])
                          }
                          onChange={(e) => {
                            const raw = e.target.value;
                            setPostalDrafts((prev) => ({ ...prev, [rule.driverId]: raw }));
                            updateRule(index, {
                              postalCodePrefixes: parsePostalCodeList(raw),
                            });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Saisissez les codes postaux ou préfixes séparés par des virgules (ex.{" "}
                          <span className="font-mono">75009</span>,{" "}
                          <span className="font-mono">75007</span> ou{" "}
                          <span className="font-mono">75</span> pour tout Paris). Laissez vide pour
                          couvrir tous les codes postaux.
                        </p>
                      </div>

                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm max-md:min-h-11">
                      <input
                        type="checkbox"
                        className="max-md:size-5"
                        checked={isPaused}
                        onChange={(e) =>
                          updateRule(index, {
                            dispatchStatus: e.target.checked ? "PAUSED" : "ACTIVE",
                          })
                        }
                      />
                      <span>Mettre en pause (exclu des affectations)</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2 : Tournées ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            Tournées
          </CardTitle>
          <CardDescription>
            Limites appliquées aux propositions de tournées. L&apos;équipe attribue chaque tournée à un livreur.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="max-active">Max livraisons actives / livreur (global)</Label>
            <Input
              id="max-active"
              type="number"
              min={1}
              className="max-w-xs"
              value={local.maxActiveDeliveriesPerDriver}
              onChange={(e) =>
                setLocal({
                  ...local,
                  maxActiveDeliveriesPerDriver: Math.max(1, Number(e.target.value) || 1),
                })
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="round-day">Durée maximale (minutes)</Label>
              <Input id="round-day" type="number" min={30} max={1440} value={local.rounds.dayMinutes}
                onChange={(e) => setLocal({ ...local, rounds: { ...local.rounds, dayMinutes: Math.min(1440, Math.max(30, Number(e.target.value) || 30)) } })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="round-stop">Temps à chaque arrêt (minutes)</Label>
              <Input id="round-stop" type="number" min={1} max={60} value={local.rounds.stopMinutes}
                onChange={(e) => setLocal({ ...local, rounds: { ...local.rounds, stopMinutes: Math.min(60, Math.max(1, Number(e.target.value) || 1)) } })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="round-max">Livraisons par tournée</Label>
              <Input id="round-max" type="number" min={2} max={40} value={local.rounds.maxDeliveries}
                onChange={(e) => setLocal({ ...local, rounds: { ...local.rounds, maxDeliveries: Math.min(40, Math.max(2, Number(e.target.value) || 2)) } })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="brand"
        size="lg"
        className="w-full sm:w-auto"
        loading={updateSettings.isPending}
        disabled={updateSettings.isPending}
        onClick={handleSave}
      >
        Enregistrer les règles dispatch
      </Button>
    </div>
  );
}
