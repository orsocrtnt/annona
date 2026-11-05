"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createAdminPilot, updateAdminPilot, type PilotPayload } from "@/features/admin/api";
import { PilotCompanyPicker, type PickedCompany } from "@/features/admin/pilots/pilot-company-picker";
import { PILOT_STAGE_HINTS, PILOT_STAGE_LABELS, PILOT_STAGES } from "@/domains/admin/pilot-stages";
import type { PilotStage } from "@prisma/client";
import type { PilotDetail } from "@/domains/admin/pilots.service";

const SELECT_CLASS =
  "flex min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:text-base";

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

interface PilotFormProps {
  /** Pilote modifié ; absent = création. */
  pilot?: PilotDetail;
  onDone: (id: string) => void;
  onCancel: () => void;
}

/**
 * Création et modification d'un pilote. Le serveur contrôle tout (zod stricte, dates cohérentes, étapes) ;
 * son message s'affiche tel quel. En modification, l'étape se change depuis la fiche, pas ici.
 */
export function PilotForm({ pilot, onDone, onCancel }: PilotFormProps) {
  const uid = useId();
  const id = (name: string) => `${uid}-${name}`;
  const queryClient = useQueryClient();
  const [company, setCompany] = useState<PickedCompany>(pilot?.company ? { id: pilot.company.id, name: pilot.company.name } : null);
  const [stage, setStage] = useState<PilotStage>("PREPARATION");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (payload: PilotPayload) => (pilot ? updateAdminPilot(pilot.id, payload) : createAdminPilot(payload)),
    onMutate: () => setError(null),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Enregistrement impossible."),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "pilots"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "pilot", result.id] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "home"] }),
      ]);
      onDone(result.id);
    },
  });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const payload: PilotPayload = {
      name: value("name"),
      companyId: company?.id ?? null,
      contactName: value("contactName"),
      contactEmail: value("contactEmail"),
      contactPhone: value("contactPhone"),
      startDate: value("startDate"),
      plannedEndDate: value("plannedEndDate"),
      firstDeliveryDate: value("firstDeliveryDate"),
    };
    if (pilot) {
      if (form.has("endDate")) payload.endDate = value("endDate");
    } else {
      payload.stage = stage;
    }
    mutation.mutate(payload);
  };

  const terminal = pilot ? pilot.stage === "CONTINUED" || pilot.stage === "STOPPED" : false;

  return (
    <form onSubmit={submit} noValidate={false} className="space-y-5" aria-describedby={error ? id("error") : undefined}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("name")} label="Nom du pilote" hint="Nom affiché, par exemple celui de l'entreprise accompagnée.">
          <Input id={id("name")} name="name" required minLength={2} maxLength={120} defaultValue={pilot?.name ?? ""} className="min-h-11" />
        </Field>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground" id={id("company-label")}>Entreprise TutelLiv liée</p>
          <p className="text-xs text-muted-foreground">Facultatif au début : à lier quand son espace est créé.</p>
          <div className="mt-1.5" role="group" aria-labelledby={id("company-label")}>
            <PilotCompanyPicker value={company} onChange={setCompany} />
          </div>
        </div>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-bold text-foreground">Contact chez le pilote</legend>
        <Field id={id("contactName")} label="Nom">
          <Input id={id("contactName")} name="contactName" maxLength={120} defaultValue={pilot?.contactName ?? ""} autoComplete="off" className="min-h-11" />
        </Field>
        <Field id={id("contactEmail")} label="E-mail">
          <Input id={id("contactEmail")} name="contactEmail" type="email" maxLength={254} defaultValue={pilot?.contactEmail ?? ""} autoComplete="off" className="min-h-11" />
        </Field>
        <Field id={id("contactPhone")} label="Téléphone">
          <Input id={id("contactPhone")} name="contactPhone" type="tel" maxLength={30} defaultValue={pilot?.contactPhone ?? ""} autoComplete="off" className="min-h-11" />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 text-sm font-bold text-foreground">Dates</legend>
        <Field id={id("startDate")} label="Début">
          <Input id={id("startDate")} name="startDate" type="date" defaultValue={pilot?.startDate ?? ""} className="min-h-11" />
        </Field>
        <Field id={id("plannedEndDate")} label="Fin prévue">
          <Input id={id("plannedEndDate")} name="plannedEndDate" type="date" defaultValue={pilot?.plannedEndDate ?? ""} className="min-h-11" />
        </Field>
        <Field id={id("firstDeliveryDate")} label="Première livraison" hint="Laisser vide pour la déduire.">
          <Input id={id("firstDeliveryDate")} name="firstDeliveryDate" type="date" defaultValue={pilot?.firstDeliveryDate ?? ""} className="min-h-11" />
        </Field>
        {pilot && terminal && (
          <Field id={id("endDate")} label="Fin réelle">
            <Input id={id("endDate")} name="endDate" type="date" defaultValue={pilot.endDate ?? ""} className="min-h-11" />
          </Field>
        )}
      </fieldset>

      {!pilot && (
        <Field id={id("stage")} label="Étape actuelle" hint={PILOT_STAGE_HINTS[stage]}>
          <select id={id("stage")} value={stage} onChange={(event) => setStage(event.target.value as PilotStage)} className={SELECT_CLASS}>
            {PILOT_STAGES.map((value) => (
              <option key={value} value={value}>{PILOT_STAGE_LABELS[value]}</option>
            ))}
          </select>
        </Field>
      )}

      {error && (
        <p id={id("error")} role="alert" className="rounded-xl border border-[#ead1c9] bg-[#fbefeb] px-4 py-3 text-sm font-semibold text-[#8a3b2a] dark:border-border dark:bg-secondary dark:text-error">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="touch" onClick={onCancel} disabled={mutation.isPending}>
          Annuler
        </Button>
        <Button type="submit" variant="brand" size="touch" loading={mutation.isPending}>
          {pilot ? "Enregistrer" : "Créer le pilote"}
        </Button>
      </div>
    </form>
  );
}
