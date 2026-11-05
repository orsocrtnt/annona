"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Building2, Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useAdminPilots } from "@/features/admin/hooks";
import { HomeCard, HOME_CARD_CLASS } from "@/features/admin/home/home-card";
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
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import type { PilotStage } from "@prisma/client";
import type { PilotListItem } from "@/domains/admin/pilots.service";

type Filter = "all" | PilotStage;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function PilotCard({ pilot }: { pilot: PilotListItem }) {
  const href = `/admin/pilots/${encodeURIComponent(pilot.id)}`;
  return (
    <li className="flex min-w-0 flex-col rounded-2xl border border-border bg-background p-4 dark:bg-background/40">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-base font-bold tracking-tight text-foreground">
          <Link href={href} className="break-words rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {pilot.name}
          </Link>
        </h3>
        <PilotStageBadge stage={pilot.stage} />
      </div>
      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {pilot.company ? (
          <Link
            href={`/companies/${encodeURIComponent(pilot.company.id)}`}
            className="inline-flex min-h-11 min-w-0 items-center truncate font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="truncate">{pilot.company.name}</span>
            {pilot.company.isDemo && <span className="ml-1.5 shrink-0 text-xs font-semibold text-muted-foreground">Démo</span>}
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center text-muted-foreground">Aucune entreprise liée</span>
        )}
      </p>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Depuis le début">{elapsedLabel(pilot.daysSinceStart, pilot.startDate)}</Fact>
        <Fact label="Première livraison">
          {pilot.firstDelivery ? (
            <>
              {formatDay(pilot.firstDelivery.date)}
              <span className="block text-xs text-muted-foreground">{firstDeliverySource(pilot.firstDelivery)}</span>
            </>
          ) : pilot.company && !pilot.deliveriesReadable ? (
            "Indisponible"
          ) : (
            <span className="text-muted-foreground">Pas encore</span>
          )}
        </Fact>
        <Fact label="Livrées sur 30 jours">
          {!pilot.company ? (
            <span className="text-muted-foreground">— sans entreprise</span>
          ) : pilot.delivered30 === null ? (
            "Indisponible"
          ) : (
            <span className="font-semibold tabular-nums">{formatCount(pilot.delivered30)}</span>
          )}
        </Fact>
        <Fact label="Notes">{formatCount(pilot.notesCount)}</Fact>
      </dl>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs font-semibold text-muted-foreground">Dernière note</p>
        {pilot.lastNote ? (
          <>
            <p className="mt-0.5 line-clamp-3 whitespace-pre-line break-words text-sm text-foreground">{pilot.lastNote.body}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDateTime(pilot.lastNote.createdAt)}
              {pilot.lastNote.author ? ` · ${pilot.lastNote.author}` : ""}
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-muted-foreground">Aucune note pour l&apos;instant.</p>
        )}
      </div>
      <Link
        href={href}
        className="mt-auto inline-flex min-h-11 items-center gap-1 self-start rounded-lg pt-2 text-sm font-semibold text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Ouvrir le suivi
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * ADMIN-ESPACE lot 4 : pilotes rangés par étape (une section par étape, cartes sur deux ou trois colonnes),
 * lisible sur ordinateur comme sur téléphone, sans défilement horizontal.
 */
export function PilotsBoard() {
  const router = useRouter();
  const { data, isLoading, error } = useAdminPilots();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const header = (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand">Clients</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Pilotes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entreprises accompagnées pendant leur pilote : étape, première livraison, activité et notes de suivi.
        </p>
      </div>
      {!creating && (
        <Button type="button" variant="brand" size="touch" onClick={() => setCreating(true)} className="max-sm:w-full">
          <Plus aria-hidden />
          Nouveau pilote
        </Button>
      )}
    </header>
  );

  const form = creating && (
    <HomeCard aria-labelledby="pilot-create-title">
      <h2 id="pilot-create-title" className="text-lg font-bold tracking-tight text-foreground">Nouveau pilote</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">Étapes du protocole PILOT-1 : préparation, activation, première valeur, usage, sortie.</p>
      <div className="mt-4">
        <PilotForm
          onCancel={() => setCreating(false)}
          onDone={(id) => {
            setCreating(false);
            router.push(`/admin/pilots/${encodeURIComponent(id)}`);
          }}
        />
      </div>
    </HomeCard>
  );

  if (isInitialQueryLoading(isLoading, data)) {
    return (
      <div className="space-y-5">
        {header}
        <div className={cn(HOME_CARD_CLASS, "h-80 animate-pulse")} aria-busy="true" aria-label="Chargement des pilotes" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-5">
        {header}
        {form}
        <EmptyState icon={AlertTriangle} title="Pilotes indisponibles" description="Impossible de charger les pilotes pour le moment." />
      </div>
    );
  }

  const stages = PILOT_STAGES.filter((stage) => data.byStage[stage] > 0 && (filter === "all" || filter === stage));
  const chips: Array<{ value: Filter; label: string; count: number }> = [
    { value: "all", label: "Tous", count: data.items.length },
    ...PILOT_STAGES.map((stage) => ({ value: stage, label: PILOT_STAGE_LABELS[stage], count: data.byStage[stage] })),
  ];

  return (
    <div className="space-y-5">
      {header}
      {form}

      {data.items.length === 0 ? (
        !creating && (
          <EmptyState
            icon={Flag}
            title="Aucun pilote"
            description="Ajoutez la première entreprise accompagnée pour suivre son étape, sa première livraison et vos notes."
            action={{ label: "Nouveau pilote", onClick: () => setCreating(true) }}
          />
        )
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatCount(data.inProgress)}</span> en cours
            {" · "}
            {formatCount(data.byStage.PREPARATION)} en préparation
            {" · "}
            {formatCount(data.byStage.CONTINUED + data.byStage.STOPPED)} sorti{data.byStage.CONTINUED + data.byStage.STOPPED > 1 ? "s" : ""}
            {data.truncated && " · seuls les 200 derniers pilotes modifiés sont affichés"}
          </p>
          <div role="group" aria-label="Filtrer par étape" className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={filter === chip.value}
                disabled={chip.value !== "all" && chip.count === 0}
                onClick={() => setFilter(chip.value)}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                  filter === chip.value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {chip.label}
                <span className="tabular-nums opacity-80">{formatCount(chip.count)}</span>
              </button>
            ))}
          </div>

          {stages.map((stage) => {
            const pilots = data.items.filter((pilot) => pilot.stage === stage);
            return (
              <HomeCard key={stage} aria-labelledby={`pilots-${stage}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h2 id={`pilots-${stage}`} className="flex items-center gap-2 text-lg font-bold tracking-tight text-foreground">
                    {PILOT_STAGE_LABELS[stage]}
                    <span className="text-base font-semibold tabular-nums text-muted-foreground">{formatCount(pilots.length)}</span>
                  </h2>
                  <p className="text-sm text-muted-foreground">{PILOT_STAGE_HINTS[stage]}</p>
                </div>
                <ul className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {pilots.map((pilot) => (
                    <PilotCard key={pilot.id} pilot={pilot} />
                  ))}
                </ul>
              </HomeCard>
            );
          })}
        </>
      )}
    </div>
  );
}
