"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
  DISPATCH_STRATEGY_LABELS,
  type CompanyDispatchSettings,
  type DispatchDriverRule,
  type DispatchStrategy,
  normalizeDispatchDriverRule,
} from "@/lib/validations/dispatch-settings";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { useCompanyDrivers } from "./hooks";
import { useCompanyTariffSettings } from "./tariff-settings-hooks";
import {
  useCompanyDispatchSettings,
  useUpdateCompanyDispatchSettings,
} from "./dispatch-settings-hooks";
import { formatDriverFromParts } from "@/lib/format/person-labels";
import { formatPostalCodeList, parsePostalCodeList } from "@/lib/dispatch/postal-codes";
import { Bike, MapPin, Package, Plus, Radio, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { lockedOfferReason } from "@/domains/saas/saas-access";
import { useHasOfferFeature, useOfferAccess } from "@/features/saas/use-offer-access";

function driverLabel(firstName: string, lastName: string) {
  return formatDriverFromParts({ firstName, lastName }, null);
}

function createDefaultRule(driverId: string, priority: number): DispatchDriverRule {
  return normalizeDispatchDriverRule({
    driverId,
    priority,
    allowedCategories: { STANDARD: true, COURIER: true, SPECIAL_MISSION: false },
    zoneIds: [],
    postalCodePrefixes: [],
    dispatchStatus: "ACTIVE",
  });
}

export function DispatchSettingsForm() {
  const { data: settings, isLoading } = useCompanyDispatchSettings();
  const { data: drivers } = useCompanyDrivers();
  const { data: tariffSettings } = useCompanyTariffSettings();
  const updateSettings = useUpdateCompanyDispatchSettings();
  const offerAccess = useOfferAccess();
  const hasAutoDispatch = useHasOfferFeature("auto_dispatch");
  const [local, setLocal] = useState<CompanyDispatchSettings | null>(null);
  const [postalDrafts, setPostalDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      setLocal(settings);
      setPostalDrafts({});
    }
  }, [settings]);

  const zones = tariffSettings?.tariffZones ?? [];

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
      toast.error("Chaque chauffeur ne peut apparaître qu'une fois");
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
      await updateSettings.mutateAsync(
        hasAutoDispatch ? local : { ...local, enabled: false }
      );
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

  const setZoneDriver = (zoneId: string, driverId: string) => {
    if (!local) return;
    setLocal({
      ...local,
      zoneDriverMap: { ...local.zoneDriverMap, [zoneId]: driverId },
    });
  };

  const toggleDriverZone = (index: number, zoneId: string, checked: boolean) => {
    if (!local) return;
    const rule = local.driverRules[index];
    if (!rule) return;
    const zoneIds = new Set(rule.zoneIds ?? []);
    if (checked) zoneIds.add(zoneId);
    else zoneIds.delete(zoneId);
    updateRule(index, { zoneIds: [...zoneIds] });
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
            Définissez pour chaque livreur ce qu&apos;il peut faire : commandes, courses, zones
            géographiques, charge max et pause. Sans profil, un livreur accepte tout par défaut.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unconfiguredCount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm">
                <span className="font-medium">{unconfiguredCount} livreur(s)</span> sans profil
                dispatch — les règles par catégorie et par zone ne s&apos;appliquent pas encore.
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
                (commandes / courses) et par zone.
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
                          <Badge variant="outline" className="text-xs text-amber-700">
                            En pause
                          </Badge>
                        )}
                        {(rule.zoneIds ?? []).length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {(rule.zoneIds ?? []).length} zone(s)
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
                          <Label className="text-xs">Chauffeur</Label>
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
                          couvrir toutes les zones. Les courses utilisent le code postal de
                          collecte.
                        </p>
                      </div>

                      {zones.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs">Ou zones tarifaires (Facturation)</Label>
                          <p className="text-xs text-muted-foreground">
                            Alternative aux codes postaux : cochez les zones définies dans{" "}
                            <Link href="/settings/billing" className="text-brand underline underline-offset-2 hover:decoration-2">
                              Facturation
                            </Link>
                            . Un livreur est éligible si le code postal OU la zone correspond.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {zones.map((zone) => {
                              const checked = (rule.zoneIds ?? []).includes(zone.id);
                              return (
                                <label
                                  key={zone.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs",
                                    checked ? "border-brand/30 bg-brand-subtle/20" : "border-border"
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      toggleDriverZone(index, zone.id, e.target.checked)
                                    }
                                  />
                                  {zone.name}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isPaused}
                        onChange={(e) =>
                          updateRule(index, {
                            dispatchStatus: e.target.checked ? "PAUSED" : "ACTIVE",
                          })
                        }
                      />
                      <span>Mettre en pause (exclu de l&apos;auto-dispatch)</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2 : Auto-dispatch global ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            Auto-dispatch
          </CardTitle>
          <CardDescription>
            Les missions sont assignées par le dispatch — les livreurs ne peuvent pas les prendre
            eux-mêmes. Relancez la file depuis l&apos;onglet File d&apos;attente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <label className={cn("flex items-center gap-3 rounded-xl border p-4", hasAutoDispatch ? "cursor-pointer" : "cursor-not-allowed opacity-60")}>
            <input
              type="checkbox"
              checked={hasAutoDispatch && local.enabled}
              disabled={!hasAutoDispatch}
              title={hasAutoDispatch ? undefined : lockedOfferReason("auto_dispatch", offerAccess?.planCode)}
              onChange={(e) => setLocal({ ...local, enabled: e.target.checked })}
            />
            <div>
              <p className="font-medium">Activer l&apos;auto-dispatch</p>
              <p className="text-sm text-muted-foreground">
                {hasAutoDispatch
                  ? "Assigne automatiquement aux livreurs compatibles selon leurs profils ci-dessus."
                  : lockedOfferReason("auto_dispatch", offerAccess?.planCode)}
              </p>
            </div>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Stratégie principale</Label>
              <Select
                value={local.strategy}
                onValueChange={(value) =>
                  setLocal({ ...local, strategy: value as DispatchStrategy })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DISPATCH_STRATEGY_LABELS) as DispatchStrategy[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {DISPATCH_STRATEGY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {local.strategy === "PRIORITY_LIST" &&
                  "Premier livreur compatible par ordre de priorité."}
                {local.strategy === "LEAST_LOADED" &&
                  "Livreur compatible avec le moins de missions actives."}
                {local.strategy === "ZONE_THEN_PRIORITY" &&
                  "Livreur préféré de la zone, puis priorité."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-active">Max livraisons actives / livreur (global)</Label>
              <Input
                id="max-active"
                type="number"
                min={1}
                value={local.maxActiveDeliveriesPerDriver}
                onChange={(e) =>
                  setLocal({
                    ...local,
                    maxActiveDeliveriesPerDriver: Math.max(1, Number(e.target.value) || 1),
                  })
                }
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-3">
            <input
              type="checkbox"
              checked={local.prioritizeCourier}
              onChange={(e) => setLocal({ ...local, prioritizeCourier: e.target.checked })}
            />
            <div>
              <p className="text-sm font-medium">Prioriser les courses dans la file</p>
              <p className="text-xs text-muted-foreground">
                Les courses passent avant les commandes lors de l&apos;auto-dispatch.
              </p>
            </div>
          </label>

          <div className="space-y-2">
            <Label>Types auto-assignés</Label>
            <div className="flex flex-wrap gap-3">
              {(["STANDARD", "COURIER", "SPECIAL_MISSION"] as const).map((category) => (
                <label
                  key={category}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={local.autoAssignCategories[category]}
                    onChange={(e) =>
                      setLocal({
                        ...local,
                        autoAssignCategories: {
                          ...local.autoAssignCategories,
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
        </CardContent>
      </Card>

      {/* ── Section 3 : Zones & secours ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Zones & secours
          </CardTitle>
          <CardDescription>
            Préférence par zone (stratégie « Zone puis priorité ») et livreur de secours.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {zones.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Aucune zone tarifaire — configurez-les dans{" "}
              <Link href="/settings/billing" className="text-brand underline underline-offset-2 hover:decoration-2">
                Facturation
              </Link>{" "}
              pour activer le dispatch par zone.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Livreur préféré par zone</Label>
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                >
                  <span className="min-w-[120px] text-sm font-medium">{zone.name}</span>
                  <Select
                    value={local.zoneDriverMap[zone.id] ?? ""}
                    onValueChange={(value) => setZoneDriver(zone.id, value)}
                  >
                    <SelectTrigger className="max-w-xs">
                      <SelectValue placeholder="Choisir un livreur" />
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
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>Livreur par défaut (secours)</Label>
            <Select
              value={local.defaultDriverId ?? "none"}
              onValueChange={(value) =>
                setLocal({
                  ...local,
                  defaultDriverId: value === "none" ? null : value,
                })
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Aucun" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {(drivers ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {driverLabel(d.firstName, d.lastName)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assigné si aucun livreur compatible n&apos;est trouvé (doit respecter le profil).
            </p>
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
