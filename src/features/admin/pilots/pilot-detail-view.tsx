"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addAdminPilotNote, updateAdminPilot } from "@/features/admin/api";
import { Block, Empty, Field, FieldGrid, Stat, Unavailable } from "@/features/admin/company/company-file-blocks";
import { CHART_COLORS, DailyLineChart, type DailyLine } from "@/features/admin/home/daily-line-chart";
import { HomeCard } from "@/features/admin/home/home-card";
import { PilotForm } from "@/features/admin/pilots/pilot-form";
import { PilotStageBadge } from "@/features/admin/pilots/pilot-stage-badge";
import {
  elapsedLabel,
  firstDeliverySource,
  formatCount,
  formatDateTime,
  formatDay,
} from "@/features/admin/pilots/pilot-format";
import { PILOT_STAGE_HINTS, PILOT_STAGE_LABELS, PILOT_STAGES } from "@/domains/admin/pilot-stages";
import { cn } from "@/lib/utils";
import type { PilotStage } from "@prisma/client";
import type { PilotDetail } from "@/domains/admin/pilots.service";

const LINES: ReadonlyArray<DailyLine<"orders" | "delivered">> = [
  { key: "orders", label: "Commandes créées", short: "Commandes", ...CHART_COLORS.blue },
  { key: "delivered", label: "Livraisons livrées", short: "Livrées", ...CHART_COLORS.green },
];

const ERROR_CLASS =
  "rounded-xl border border-[#ead1c9] bg-[#fbefeb] px-4 py-3 text-sm font-semibold text-[#8a3b2a] dark:border-border dark:bg-secondary dark:text-error";

function useInvalidatePilot(id: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "pilot", id] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "pilots"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "home"] }),
    ]);
}

/** Étape actuelle, parcours du protocole et passages autorisés (en avant, en arrière, sortie). */
function StageBlock({ pilot }: { pilot: PilotDetail }) {
  const invalidate = useInvalidatePilot(pilot.id);
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (stage: PilotStage) => updateAdminPilot(pilot.id, { stage }),
    onMutate: () => setError(null),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Changement impossible."),
    onSuccess: invalidate,
  });
  const currentIndex = PILOT_STAGES.indexOf(pilot.stage);
  const path = PILOT_STAGES.filter((stage) => stage !== "CONTINUED" && stage !== "STOPPED");

  return (
    <Block id="pilot-stage" title="Étape" hint={PILOT_STAGE_HINTS[pilot.stage]}>
      <ol className="flex flex-wrap gap-2" aria-label="Parcours du pilote">
        {path.map((stage, index) => {
          const done = pilot.stage !== "STOPPED" && index < currentIndex;
          const current = stage === pilot.stage;
          return (
            <li
              key={stage}
              aria-current={current ? "step" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-full border px-3 text-xs font-semibold",
                current
                  ? "border-[#08783f] bg-[#e3f7ec] text-[#08783f] dark:border-brand dark:bg-brand-subtle dark:text-brand"
                  : done
                    ? "border-border bg-background text-foreground"
                    : "border-dashed border-border text-muted-foreground"
              )}
            >
              <span className="mr-1.5 tabular-nums opacity-70">{index + 1}.</span>
              {PILOT_STAGE_LABELS[stage]}
            </li>
          );
        })}
        {(pilot.stage === "CONTINUED" || pilot.stage === "STOPPED") && (
          <li aria-current="step">
            <PilotStageBadge stage={pilot.stage} className="min-h-9 px-3" />
          </li>
        )}
      </ol>

      <div className="mt-4">
        <p className="text-sm font-semibold text-foreground">Passer à</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pilot.allowedStages.map((stage) => {
            const forward = PILOT_STAGES.indexOf(stage) > currentIndex && stage !== "STOPPED";
            return (
              <Button
                key={stage}
                type="button"
                size="touch"
                variant={stage === "STOPPED" ? "outline" : forward ? "brand" : "outline"}
                className={cn("max-sm:w-full", stage === "STOPPED" && "text-[#8a3b2a] dark:text-error")}
                disabled={mutation.isPending}
                loading={mutation.isPending && mutation.variables === stage}
                onClick={() => mutation.mutate(stage)}
              >
                {forward ? "→ " : stage === "STOPPED" ? "" : "← "}
                {PILOT_STAGE_LABELS[stage]}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Étape depuis le {formatDateTime(pilot.stageChangedAt)}. Le début se pose seul en quittant la préparation, la fin réelle à la sortie.
        </p>
      </div>
      {error && <p role="alert" className={cn(ERROR_CLASS, "mt-3")}>{error}</p>}
    </Block>
  );
}

function FirstDeliveryValue({ pilot }: { pilot: PilotDetail }) {
  if (!pilot.firstDelivery) {
    if (pilot.company && !pilot.deliveriesReadable) return <>Indisponible (livraisons illisibles)</>;
    return <span className="text-muted-foreground">Pas encore{pilot.company ? "" : " (aucune entreprise liée pour la déduire)"}</span>;
  }
  const differs = pilot.firstDelivery.source === "manual" && pilot.deducedFirstDelivery && pilot.deducedFirstDelivery !== pilot.firstDelivery.date;
  return (
    <>
      {formatDay(pilot.firstDelivery.date)}
      <span className="block text-xs text-muted-foreground">
        {firstDeliverySource(pilot.firstDelivery)}
        {pilot.firstDelivery.source === "deduced" ? " de l'entreprise liée" : ""}
      </span>
      {differs && (
        <span className="block text-xs text-muted-foreground">
          Première livraison livrée dans TutelLiv : {formatDay(pilot.deducedFirstDelivery)}
        </span>
      )}
    </>
  );
}

function InfoBlock({ pilot }: { pilot: PilotDetail }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <HomeCard aria-labelledby="pilot-edit-title">
        <h2 id="pilot-edit-title" className="text-lg font-bold tracking-tight text-foreground">Modifier le pilote</h2>
        <div className="mt-4">
          <PilotForm pilot={pilot} onCancel={() => setEditing(false)} onDone={() => setEditing(false)} />
        </div>
      </HomeCard>
    );
  }
  return (
    <Block
      id="pilot-info"
      title="Suivi"
      action={
        <Button type="button" variant="outline" size="touch" onClick={() => setEditing(true)} className="max-sm:w-full">
          <Pencil aria-hidden />
          Modifier
        </Button>
      }
    >
      <FieldGrid>
        <Field label="Contact">{pilot.contactName ?? "—"}</Field>
        <Field label="E-mail">
          {pilot.contactEmail ? (
            <a className="inline-flex min-h-11 items-center break-all text-brand hover:underline" href={`mailto:${pilot.contactEmail}`}>{pilot.contactEmail}</a>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Téléphone">
          {pilot.contactPhone ? (
            <a className="inline-flex min-h-11 items-center text-brand hover:underline" href={`tel:${pilot.contactPhone.replace(/[^0-9+]/g, "")}`}>{pilot.contactPhone}</a>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Début">
          {formatDay(pilot.startDate)}
          {pilot.startDate && <span className="block text-xs text-muted-foreground">{elapsedLabel(pilot.daysSinceStart, pilot.startDate)}</span>}
        </Field>
        <Field label="Fin prévue">{formatDay(pilot.plannedEndDate)}</Field>
        <Field label="Fin réelle">{formatDay(pilot.endDate)}</Field>
        <Field label="Première livraison">
          <FirstDeliveryValue pilot={pilot} />
        </Field>
        <Field label="Créé">
          {formatDateTime(pilot.createdAt)}
          {pilot.createdBy ? ` par ${pilot.createdBy}` : ""}
        </Field>
        <Field label="Dernière modification">
          {formatDateTime(pilot.updatedAt)}
          {pilot.updatedBy ? ` par ${pilot.updatedBy}` : ""}
        </Field>
      </FieldGrid>
    </Block>
  );
}

function ActivityBlock({ pilot }: { pilot: PilotDetail }) {
  if (!pilot.company) {
    return (
      <Block id="pilot-activity" title="Activité">
        <Empty>Liez une entreprise TutelLiv pour suivre ses livraisons et déduire sa première livraison.</Empty>
      </Block>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat
          label="Livraisons livrées sur 30 jours"
          value={pilot.delivered30 === null ? "Indisponible" : formatCount(pilot.delivered30)}
          note="Jours de Paris, statut « Livrée »"
          tone={pilot.delivered30 ? "brand" : undefined}
        />
        <Stat
          label="Première livraison"
          value={pilot.firstDelivery ? formatDay(pilot.firstDelivery.date) : pilot.deliveriesReadable ? "Pas encore" : "Indisponible"}
          note={pilot.firstDelivery ? firstDeliverySource(pilot.firstDelivery) : undefined}
        />
      </div>
      {pilot.series ? (
        <DailyLineChart
          series={pilot.series}
          lines={LINES}
          title="30 derniers jours"
          subtitle={`Commandes créées et livraisons livrées de ${pilot.company.name}, jours à l'heure de Paris.`}
          titleId="pilot-chart-title"
          tableCaption="Commandes créées et livraisons livrées par jour, 30 derniers jours, pour l'entreprise du pilote"
        />
      ) : (
        <HomeCard aria-labelledby="pilot-chart-title">
          <h2 id="pilot-chart-title" className="text-lg font-bold tracking-tight text-foreground">30 derniers jours</h2>
          <div className="mt-4">
            <Unavailable what="La courbe de l'entreprise n'a pas pu être lue." />
          </div>
        </HomeCard>
      )}
    </div>
  );
}

function NotesBlock({ pilot }: { pilot: PilotDetail }) {
  const fieldId = useId();
  const invalidate = useInvalidatePilot(pilot.id);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (text: string) => addAdminPilotNote(pilot.id, text),
    onMutate: () => setError(null),
    onError: (mutationError) => setError(mutationError instanceof Error ? mutationError.message : "Note non enregistrée."),
    onSuccess: async () => {
      setBody("");
      await invalidate();
    },
  });

  return (
    <Block id="pilot-notes" title="Notes de suivi" hint="Points hebdomadaires, incidents, retours des trois rôles, décisions.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(body);
        }}
        className="space-y-2"
      >
        <label htmlFor={fieldId} className="sr-only">Nouvelle note</label>
        <textarea
          id={fieldId}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Ce qui s'est passé, ce qui a été décidé."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:text-base"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground tabular-nums">{formatCount(body.length)} / 2 000</span>
          <Button type="submit" variant="brand" size="touch" loading={mutation.isPending} disabled={body.trim().length === 0} className="max-sm:w-full">
            Ajouter la note
          </Button>
        </div>
        {error && <p role="alert" className={ERROR_CLASS}>{error}</p>}
      </form>

      {pilot.notes.length === 0 ? (
        <div className="mt-4">
          <Empty>Aucune note pour l&apos;instant.</Empty>
        </div>
      ) : (
        <ol className="mt-4 space-y-3" aria-label="Historique des notes, la plus récente d'abord">
          {pilot.notes.map((note) => (
            <li key={note.id} className="rounded-2xl border border-border bg-background px-4 py-3 dark:bg-background/40">
              <p className="whitespace-pre-line break-words text-sm text-foreground">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                <time dateTime={note.createdAt}>{formatDateTime(note.createdAt)}</time>
                {note.author ? ` · ${note.author}` : " · auteur supprimé"}
              </p>
            </li>
          ))}
          {pilot.notesTruncated && <li className="text-xs text-muted-foreground">Seules les 200 dernières notes sont affichées.</li>}
        </ol>
      )}
    </Block>
  );
}

/** ADMIN-ESPACE lot 4 : fiche d'un pilote (étape, suivi, activité de l'entreprise liée, notes). */
export function PilotDetailView({ pilot }: { pilot: PilotDetail }) {
  return (
    <div className="space-y-5">
      <Link
        href="/admin/pilots"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Tous les pilotes
      </Link>
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Pilote</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{pilot.name}</h1>
          <PilotStageBadge stage={pilot.stage} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden />
          {pilot.company ? (
            <Link
              href={`/companies/${encodeURIComponent(pilot.company.id)}`}
              className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {pilot.company.name}
              {pilot.company.isDemo && <span className="ml-1.5 text-xs text-muted-foreground">Démo</span>}
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center">Aucune entreprise TutelLiv liée</span>
          )}
          <span aria-hidden className="max-sm:hidden">·</span>
          <span className="max-sm:w-full">{elapsedLabel(pilot.daysSinceStart, pilot.startDate)}</span>
        </p>
      </header>
      <StageBlock pilot={pilot} />
      <div className="grid gap-5 xl:grid-cols-2">
        <InfoBlock pilot={pilot} />
        <NotesBlock pilot={pilot} />
      </div>
      <ActivityBlock pilot={pilot} />
    </div>
  );
}
