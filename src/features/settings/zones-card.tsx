"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { settingsApi, type ZoneInput, type ZoneRow } from "@/features/settings/api";
import { useZoneMutation, useZones } from "@/features/settings/hooks";
import { fr } from "@/lib/i18n/fr";

const t = fr.companySettings;

const EMPTY: ZoneInput = { name: "", morningStart: "", morningEnd: "", eveningStart: "", eveningEnd: "" };

/** Deux champs horaires « de … à … » pour une plage (matin ou soir). */
function RangeFields({
  title, start, end, onStart, onEnd, startLabel, endLabel, testId,
}: {
  title: string; start: string; end: string; onStart: (value: string) => void; onEnd: (value: string) => void;
  startLabel: string; endLabel: string; testId: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <div className="flex items-center gap-2">
        <Input className="w-28" type="time" aria-label={startLabel} value={start} onChange={(event) => onStart(event.target.value)} required data-testid={`${testId}-start`} />
        <span className="text-sm text-muted-foreground">{t.to}</span>
        <Input className="w-28" type="time" aria-label={endLabel} value={end} onChange={(event) => onEnd(event.target.value)} required data-testid={`${testId}-end`} />
      </div>
    </fieldset>
  );
}

function ZoneLine({ zone }: { zone: ZoneRow }) {
  const update = useZoneMutation((input: Partial<ZoneInput> & { active?: boolean }) => settingsApi.updateZone(zone.id, input));
  const remove = useZoneMutation(() => settingsApi.deleteZone(zone.id));
  const saved: ZoneInput = { name: zone.name, morningStart: zone.morningStart, morningEnd: zone.morningEnd, eveningStart: zone.eveningStart, eveningEnd: zone.eveningEnd };
  const [value, setValue] = useState<ZoneInput>(saved);
  const dirty = (Object.keys(saved) as (keyof ZoneInput)[]).some((key) => value[key] !== saved[key]);
  const set = (key: keyof ZoneInput) => (next: string) => setValue({ ...value, [key]: next });

  return (
    <li className="space-y-3 px-3 py-3" data-testid="zone-row" data-zone={zone.name}>
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-44" aria-label={`${t.zoneName} — ${zone.name}`} value={value.name} onChange={(event) => set("name")(event.target.value)} maxLength={60} />
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline">{t.zoneClients(zone.merchantCount)}</Badge>
          {!zone.active ? <Badge variant="secondary">{t.zoneInactive}</Badge> : null}
          <Switch
            checked={zone.active}
            aria-label={zone.active ? t.deactivate(zone.name) : t.activate(zone.name)}
            disabled={update.isPending}
            onCheckedChange={(active) => update.mutate({ active }, { onSuccess: () => toast.success(t.zoneSaved), onError: (error) => toast.error(error.message) })}
          />
          {zone.used ? null : (
            <Button
              type="button" variant="ghost" size="icon-sm" aria-label={t.remove(zone.name)} loading={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success(t.zoneRemoved), onError: (error) => toast.error(error.message) })}
            >
              <Trash2 />
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <RangeFields title={t.morning} start={value.morningStart} end={value.morningEnd} onStart={set("morningStart")} onEnd={set("morningEnd")} startLabel={`${t.morningStart} — ${zone.name}`} endLabel={`${t.morningEnd} — ${zone.name}`} testId="zone-morning" />
        <RangeFields title={t.evening} start={value.eveningStart} end={value.eveningEnd} onStart={set("eveningStart")} onEnd={set("eveningEnd")} startLabel={`${t.eveningStart} — ${zone.name}`} endLabel={`${t.eveningEnd} — ${zone.name}`} testId="zone-evening" />
        {dirty ? (
          <Button
            type="button" variant="outline" size="sm" loading={update.isPending} aria-label={t.editZone(zone.name)}
            onClick={() => update.mutate({ ...value, name: value.name.trim() }, { onSuccess: () => toast.success(t.zoneSaved), onError: (error) => toast.error(error.message) })}
          >
            {fr.common.save}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Lot 1, demande 1 : tournées de l'entreprise. Une tournée = un nom de zone, une plage du matin et une
 * plage du soir ; le client choisit seulement « Matin » ou « Soir ». Une tournée utilisée se désactive.
 */
export function ZonesCard() {
  const zones = useZones();
  const create = useZoneMutation(settingsApi.createZone);
  const [draft, setDraft] = useState<ZoneInput>(EMPTY);
  const rows = zones.data ?? [];
  const set = (key: keyof ZoneInput) => (next: string) => setDraft({ ...draft, [key]: next });

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { ...draft, name: draft.name.trim() },
      { onSuccess: () => { toast.success(t.zoneAdded); setDraft(EMPTY); }, onError: (error) => toast.error(error.message) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.zones}</CardTitle>
        <CardDescription>{t.zonesHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {zones.error ? <p className="text-sm text-destructive">{zones.error.message}</p> : null}
        {zones.isSuccess && rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="zone-empty">{t.zoneEmpty}</p> : null}
        {rows.length > 0 ? (
          <ul className="divide-y rounded-lg border" data-testid="zone-list">
            {rows.map((zone) => (
              <ZoneLine key={`${zone.id}:${zone.name}:${zone.morningStart}:${zone.morningEnd}:${zone.eveningStart}:${zone.eveningEnd}`} zone={zone} />
            ))}
          </ul>
        ) : null}
        <form onSubmit={add} className="flex flex-wrap items-end gap-4 rounded-lg border border-dashed p-3">
          <FormField label={t.zoneName}>
            <Input className="w-44" value={draft.name} onChange={(event) => set("name")(event.target.value)} placeholder={t.zoneNamePlaceholder} maxLength={60} required data-testid="new-zone-name" />
          </FormField>
          <RangeFields title={t.morning} start={draft.morningStart} end={draft.morningEnd} onStart={set("morningStart")} onEnd={set("morningEnd")} startLabel={t.morningStart} endLabel={t.morningEnd} testId="new-zone-morning" />
          <RangeFields title={t.evening} start={draft.eveningStart} end={draft.eveningEnd} onStart={set("eveningStart")} onEnd={set("eveningEnd")} startLabel={t.eveningStart} endLabel={t.eveningEnd} testId="new-zone-evening" />
          <Button type="submit" variant="outline" loading={create.isPending}>{t.addZone}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
