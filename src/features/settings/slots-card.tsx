"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { settingsApi, type SlotRow } from "@/features/settings/api";
import { useSlotMutation, useSlots } from "@/features/settings/hooks";
import { fr } from "@/lib/i18n/fr";

const t = fr.companySettings;

function SlotLine({ slot, index, count, onMove }: { slot: SlotRow; index: number; count: number; onMove: (from: number, to: number) => void }) {
  const update = useSlotMutation((input: { label?: string | null; startTime?: string; endTime?: string; active?: boolean }) => settingsApi.updateSlot(slot.id, input));
  const remove = useSlotMutation(() => settingsApi.deleteSlot(slot.id));
  const [label, setLabel] = useState(slot.label ?? "");
  const [startTime, setStartTime] = useState(slot.startTime);
  const [endTime, setEndTime] = useState(slot.endTime);
  const dirty = label !== (slot.label ?? "") || startTime !== slot.startTime || endTime !== slot.endTime;

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2" data-testid="slot-row" data-slot={slot.displayLabel}>
      <div className="flex flex-col">
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t.moveUp(slot.displayLabel)} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
          <ArrowUp />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t.moveDown(slot.displayLabel)} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
          <ArrowDown />
        </Button>
      </div>
      <Input className="w-40" aria-label={`${t.slotLabel} — ${slot.displayLabel}`} placeholder={slot.displayLabel} value={label} onChange={(event) => setLabel(event.target.value)} />
      <Input className="w-28" type="time" aria-label={`${t.slotStart} — ${slot.displayLabel}`} value={startTime} onChange={(event) => setStartTime(event.target.value)} />
      <Input className="w-28" type="time" aria-label={`${t.slotEnd} — ${slot.displayLabel}`} value={endTime} onChange={(event) => setEndTime(event.target.value)} />
      {dirty ? (
        <Button
          type="button" variant="outline" size="sm" loading={update.isPending}
          aria-label={t.editSlot(slot.displayLabel)}
          onClick={() => update.mutate({ label: label.trim() || null, startTime, endTime }, { onSuccess: () => toast.success(t.slotSaved), onError: (error) => toast.error(error.message) })}
        >
          {fr.common.save}
        </Button>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {slot.used ? <Badge variant="outline">{t.slotUsed}</Badge> : null}
        {!slot.active ? <Badge variant="secondary">{t.slotInactive}</Badge> : null}
        <Switch
          checked={slot.active}
          aria-label={slot.active ? t.deactivate(slot.displayLabel) : t.activate(slot.displayLabel)}
          disabled={update.isPending}
          onCheckedChange={(active) => update.mutate({ active }, { onSuccess: () => toast.success(t.slotSaved), onError: (error) => toast.error(error.message) })}
        />
        {slot.used ? null : (
          <Button
            type="button" variant="ghost" size="icon-sm" aria-label={t.remove(slot.displayLabel)} loading={remove.isPending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => toast.success(t.slotRemoved), onError: (error) => toast.error(error.message) })}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}

/** ADM-09, RG-08 : créneaux de livraison (créer, modifier, désactiver, ordonner ; un créneau utilisé reste). */
export function SlotsCard() {
  const slots = useSlots();
  const create = useSlotMutation(settingsApi.createSlot);
  const reorder = useSlotMutation(settingsApi.reorderSlots);
  const [label, setLabel] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const rows = slots.data ?? [];

  const move = (from: number, to: number) => {
    const ids = rows.map((slot) => slot.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved!);
    reorder.mutate(ids, { onError: (error) => toast.error(error.message) });
  };

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate(
      { label: label.trim() || null, startTime, endTime },
      {
        onSuccess: () => {
          toast.success(t.slotAdded);
          setLabel("");
          setStartTime("");
          setEndTime("");
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.slots}</CardTitle>
        <CardDescription>{t.slotsHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {slots.error ? <p className="text-sm text-destructive">{slots.error.message}</p> : null}
        <ul className="divide-y rounded-lg border" data-testid="slot-list">
          {rows.map((slot, index) => (
            <SlotLine key={`${slot.id}:${slot.startTime}:${slot.endTime}:${slot.label}`} slot={slot} index={index} count={rows.length} onMove={move} />
          ))}
        </ul>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <FormField label={t.slotLabel}>
            <Input className="w-40" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} />
          </FormField>
          <FormField label={t.slotStart}>
            <Input className="w-28" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required data-testid="new-slot-start" />
          </FormField>
          <FormField label={t.slotEnd}>
            <Input className="w-28" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required data-testid="new-slot-end" />
          </FormField>
          <Button type="submit" variant="outline" loading={create.isPending}>{t.addSlot}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
