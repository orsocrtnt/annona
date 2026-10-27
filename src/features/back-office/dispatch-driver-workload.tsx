"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { CompanyDispatchSettings } from "@/lib/validations/dispatch-settings";
import { getDispatchDriverRule, getDriverCategoryLabels } from "@/lib/validations/dispatch-settings";
import { formatDriverFromParts, withoutRolePrefix } from "@/lib/format/person-labels";
import { workloadBar, workloadMax, workloadSentence, type WorkloadSplit } from "@/lib/dispatch/workload-bars";
import { Users } from "lucide-react";
import type { DriverDispatchWorkload } from "./types";

function WorkloadBar({ label, split, max }: { label: string; split: WorkloadSplit; max: number }) {
  const bar = workloadBar(split, max);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground" aria-hidden="true">
          {bar.total}
        </span>
      </div>
      <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-[#eef1ef]" aria-hidden="true">
        <span className="h-full bg-[#0e1310]" style={{ width: `${bar.standardPct}%` }} />
        <span className="h-full bg-[#00a855]" style={{ width: `${bar.courierPct}%` }} />
      </div>
      <p className="sr-only">
        {label} : {workloadSentence(split)}.
      </p>
    </div>
  );
}

function DriverRow({
  driver,
  settings,
  maxToday,
  maxWeek,
}: {
  driver: DriverDispatchWorkload;
  settings: CompanyDispatchSettings | undefined;
  maxToday: number;
  maxWeek: number;
}) {
  const name = withoutRolePrefix(formatDriverFromParts(driver, null));
  const rule = settings ? getDispatchDriverRule(settings, driver.id) : null;
  const categoryLabels = getDriverCategoryLabels(rule);
  const isPaused = rule?.dispatchStatus === "PAUSED";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:items-center sm:gap-6">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#eef4f0] text-xs font-semibold text-[#0e1310]"
          aria-hidden="true"
        >
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link href={`/dashboard/drivers/${driver.id}`} className="truncate font-medium hover:underline">
              {name}
            </Link>
            {isPaused && (
              <Badge variant="outline" className="text-[10px] text-amber-800">
                Pause
              </Badge>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {[
              categoryLabels.join(", "),
              `${driver.assigned} assignée${driver.assigned > 1 ? "s" : ""}`,
              `${driver.inTransit} en cours`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <WorkloadBar label="Aujourd'hui" split={driver.today} max={maxToday} />
      <WorkloadBar label="7 prochains jours" split={driver.next7Days} max={maxWeek} />
    </li>
  );
}

export function DispatchDriverWorkload({
  drivers,
  settings,
}: {
  drivers: DriverDispatchWorkload[] | undefined;
  settings: CompanyDispatchSettings | undefined;
}) {
  if (drivers === undefined) return <PageSkeleton />;

  if (!drivers?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Charge par chauffeur</CardTitle>
          <CardDescription>Commandes et courses planifiées par livreur</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Users}
            title="Aucun chauffeur actif"
            description="Créez des comptes chauffeur dans Gestion des comptes."
          />
        </CardContent>
      </Card>
    );
  }

  const maxToday = workloadMax(drivers.map((d) => d.today));
  const maxWeek = workloadMax(drivers.map((d) => d.next7Days));
  const teamToday = drivers.reduce((sum, d) => sum + d.today.standard + d.today.courier, 0);
  const teamWeek = drivers.reduce((sum, d) => sum + d.next7Days.standard + d.next7Days.courier, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Charge par chauffeur</CardTitle>
        <CardDescription>
          Équipe : {teamToday} livraison{teamToday > 1 ? "s" : ""} aujourd&apos;hui · {teamWeek} sur les 7
          prochains jours (aujourd&apos;hui inclus)
        </CardDescription>
        <p className="flex items-center gap-4 pt-1 text-xs text-muted-foreground" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#0e1310]" /> Commandes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#00a855]" /> Courses
          </span>
        </p>
      </CardHeader>
      <CardContent>
        {/* Barres plutôt qu'un tableau de compteurs : qui est chargé se voit sans lire les chiffres. */}
        <ul className="divide-y divide-border/60">
          {drivers.map((driver) => (
            <DriverRow key={driver.id} driver={driver} settings={settings} maxToday={maxToday} maxWeek={maxWeek} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
