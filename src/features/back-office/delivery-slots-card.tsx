"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCompanyDeliverySlots, useUpdateCompanyDeliverySlots } from "@/features/back-office/company-settings-hooks";
import { companyDeliverySlotsSchema, type CompanyDeliverySlots } from "@/lib/validations/delivery-slots";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

/** DEMO-3, tranche 7 : l'entreprise livre « au jour » ou propose ses créneaux au client (C13). */
export function DeliverySlotsCard() {
  const { data } = useCompanyDeliverySlots();
  const update = useUpdateCompanyDeliverySlots();
  const [draft, setDraft] = useState<CompanyDeliverySlots | null>(null);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);
  if (!draft) return null;

  const setSlot = (index: number, key: "start" | "end", value: string) =>
    setDraft({ ...draft, slots: draft.slots.map((slot, i) => (i === index ? { ...slot, [key]: value } : slot)) });

  const save = () => {
    const parsed = companyDeliverySlotsSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Créneaux invalides");
      return;
    }
    update.mutate(parsed.data, {
      onSuccess: () => toast.success("Créneaux enregistrés"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Enregistrement impossible"),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Créneaux de livraison</CardTitle>
        <CardDescription>
          Ce que le client choisit à la commande. Les créneaux sont en heure de Paris ; les commandes déjà passées ne changent pas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="sr-only">Mode de livraison</legend>
          {([
            ["DAY", "Au jour", "Le client choisit seulement une date."],
            ["SLOTS", "Par créneaux", "Le client choisit une date et un créneau."],
          ] as const).map(([mode, label, hint]) => (
            <label key={mode} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="radio"
                name="delivery-slot-mode"
                className="mt-1"
                checked={draft.mode === mode}
                onChange={() => setDraft({ ...draft, mode })}
              />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {draft.mode === "SLOTS" && (
          <div className="space-y-2">
            {draft.slots.map((slot, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input type="time" aria-label={`Début du créneau ${index + 1}`} value={slot.start} onChange={(event) => setSlot(index, "start", event.target.value)} />
                <span className="text-sm text-muted-foreground">à</span>
                <Input type="time" aria-label={`Fin du créneau ${index + 1}`} value={slot.end} onChange={(event) => setSlot(index, "end", event.target.value)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer le créneau ${index + 1}`}
                  onClick={() => setDraft({ ...draft, slots: draft.slots.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.slots.length >= 8}
              onClick={() => setDraft({ ...draft, slots: [...draft.slots, { start: "09:00", end: "12:00" }] })}
            >
              <Plus className="h-4 w-4" />
              Ajouter un créneau
            </Button>
          </div>
        )}

        <Button type="button" onClick={save} disabled={update.isPending}>
          {update.isPending ? "Enregistrement..." : "Enregistrer les créneaux"}
        </Button>
      </CardContent>
    </Card>
  );
}
