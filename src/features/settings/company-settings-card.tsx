"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanySettings, useUpdateCompanySettings } from "@/features/settings/hooks";
import { fr } from "@/lib/i18n/fr";
import { COMPANY_TIMEZONES } from "@/lib/validations/company-admin";

const t = fr.companySettings;

/** ADM-09, PLA-03, PLA-04 : nom de l'entreprise, heure limite, fuseau, délai du rappel, unités. */
export function CompanySettingsCard() {
  const settings = useCompanySettings();
  const update = useUpdateCompanySettings();
  const [name, setName] = useState("");
  const [cutoffTime, setCutoffTime] = useState("17:00");
  const [timezone, setTimezone] = useState("Europe/Paris");
  const [lead, setLead] = useState("120");
  const [units, setUnits] = useState("");

  // Valeurs posées une seule fois au chargement : une saisie en cours n'est jamais écrasée.
  const loaded = useRef(false);
  useEffect(() => {
    if (!settings.data || loaded.current) return;
    loaded.current = true;
    setName(settings.data.name);
    setCutoffTime(settings.data.cutoffTime);
    setTimezone(settings.data.timezone);
    setLead(String(settings.data.reminderLeadMinutes));
    setUnits(settings.data.units.join(", "));
  }, [settings.data]);

  const save = (section: "identity" | "ordering" | "units") => (event: React.FormEvent) => {
    event.preventDefault();
    // Avant le chargement, les champs portent des valeurs par défaut (17:00, Europe/Paris) : les enregistrer
    // écraserait le fuseau et le délai réels de l'entreprise (RECETTE-V1).
    if (!settings.data) return;
    const input =
      section === "identity"
        ? { name }
        : section === "ordering"
          ? { cutoffTime, timezone, reminderLeadMinutes: Number.parseInt(lead, 10) }
          : { units: units.split(",").map((unit) => unit.trim()).filter(Boolean) };
    update.mutate(input, { onSuccess: () => toast.success(t.saved), onError: (error) => toast.error(error.message) });
  };

  if (settings.error) return <p className="text-sm text-destructive">{settings.error.message}</p>;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.identity}</CardTitle>
          <CardDescription>{t.identityHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save("identity")} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField label={t.name} className="flex-1">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} data-testid="company-name" />
            </FormField>
            <Button type="submit" variant="outline" disabled={!settings.data} loading={update.isPending && update.variables && "name" in update.variables}>{fr.common.save}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.ordering}</CardTitle>
          <CardDescription>{t.orderingHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save("ordering")} className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <FormField label={t.cutoffTime}>
              <Input type="time" value={cutoffTime} onChange={(event) => setCutoffTime(event.target.value)} required data-testid="cutoff-time" />
            </FormField>
            <FormField label={t.timezone}>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger aria-label={t.timezone}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_TIMEZONES.map((zone) => (
                    <SelectItem key={zone} value={zone}>{zone.replace("_", " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label={t.reminderLead} hint={t.reminderLeadHint}>
              <Input type="number" min={0} max={1440} step={5} value={lead} onChange={(event) => setLead(event.target.value)} data-testid="reminder-lead" />
            </FormField>
            <div className="sm:col-span-3">
              <Button type="submit" variant="brand" disabled={!settings.data} loading={update.isPending && update.variables && "cutoffTime" in update.variables} data-testid="ordering-save">
                {fr.common.save}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t.units}</CardTitle>
          <CardDescription>{t.unitsHint}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={save("units")} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <FormField label={t.units} className="flex-1">
              <Input value={units} onChange={(event) => setUnits(event.target.value)} placeholder="pièce, kg, plaque" />
            </FormField>
            <Button type="submit" variant="outline" disabled={!settings.data} loading={update.isPending && update.variables && "units" in update.variables}>{fr.common.save}</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
