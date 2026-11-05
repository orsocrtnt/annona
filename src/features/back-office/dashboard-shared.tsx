"use client";

import { cn } from "@/lib/utils";
import { TONE_CLASSES, resolveTone, type Tone } from "@/components/ui/tone";
import { DeltaBadge, type StatDelta } from "@/components/ui/stat-card";
import type { DashboardCategoryCounts } from "@/lib/dashboard/dashboard-types";
import type { DashboardHistoryDay } from "@/lib/dashboard/seven-day-history";
import { Package } from "lucide-react";

export function ClickableCount({
  value,
  onClick,
  className,
}: {
  value: number;
  onClick?: () => void;
  className?: string;
}) {
  if (value <= 0 || !onClick) {
    return <span className={cn("tabular-nums", value === 0 && "text-muted-foreground/70", className)}>{value}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-6 min-w-6 max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-md px-1.5 py-0.5 font-medium tabular-nums text-foreground underline-offset-4 transition-colors hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        className
      )}
    >
      {value}
    </button>
  );
}

export function CategoryCard({
  label,
  counts,
  field,
  icon: Icon,
  onClick,
}: {
  label: string;
  counts: DashboardCategoryCounts;
  field: keyof DashboardCategoryCounts;
  icon: typeof Package;
  onClick?: () => void;
}) {
  const value = counts[field];
  const isClickable = value > 0 && onClick;

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
    </>
  );

  if (!isClickable) {
    return <div className="rounded-xl border border-border bg-card p-5">{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-foreground/20"
      )}
    >
      {inner}
    </button>
  );
}

const DONUT_RADIUS = 42;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** Tons du diagramme, mêmes couleurs que les pastilles des chiffres (classes complètes pour Tailwind). */
const DONUT_TONES = {
  success: { stroke: "stroke-brand", dot: "bg-brand" },
  info: { stroke: "stroke-[#2f6fd1] dark:stroke-[#8fb5ee]", dot: "bg-[#2f6fd1] dark:bg-[#8fb5ee]" },
  neutral: { stroke: "stroke-muted-foreground/40", dot: "bg-muted-foreground/40" },
} as const;
export type DonutTone = keyof typeof DONUT_TONES;

/** Répartition des missions du jour, aux couleurs des pastilles (livrées vert, en cours bleu, restantes gris). */
export function TodayDonut({
  segments,
}: {
  segments: { label: string; value: number; tone: DonutTone }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? 8 : 0;
  let offset = 0;

  return (
    <figure className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" className="stroke-chart-track" strokeWidth="6" />
        {visible.map((segment) => {
          const length = (segment.value / total) * DONUT_CIRCUMFERENCE;
          const dash = Math.max(length - gap, 0);
          const circle = (
            <circle
              key={segment.label}
              cx="50"
              cy="50"
              r={DONUT_RADIUS}
              fill="none"
              className={DONUT_TONES[segment.tone].stroke}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${DONUT_CIRCUMFERENCE - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
      </svg>
      <figcaption className="space-y-2">
        <p>
          <span className="text-2xl font-semibold tracking-tight">{total}</span>{" "}
          <span className="text-sm text-muted-foreground">mission{total > 1 ? "s" : ""}</span>
        </p>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", DONUT_TONES[segment.tone].dot)} />
              {segment.label} · <span className="font-medium text-foreground">{segment.value}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** Livraisons terminées par heure, en barres vertes (couleur des livrées). */
export function HourlyBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 0);
  return (
    <figure className="space-y-2">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">Livraisons terminées par heure</span>
        {max === 0 && (
          <span className="text-xs text-muted-foreground">Aucune livraison terminée aujourd&apos;hui</span>
        )}
      </figcaption>
      <div
        className="flex h-16 items-end gap-1 border-b border-chart-track"
        role="img"
        aria-label={`Livraisons terminées par heure, maximum ${max}`}
      >
        {values.map((value, hour) => (
          <div
            key={hour}
            title={`${hour} h : ${value} livraison${value > 1 ? "s" : ""}`}
            className="flex h-full flex-1 items-end justify-center"
          >
            {value > 0 && (
              <div
                className="w-1.5 rounded-t-full bg-brand"
                style={{ height: `${Math.max((value / max) * 100, 6)}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>23 h</span>
      </div>
    </figure>
  );
}

const HISTORY_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" });
const HISTORY_DAY_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function historyLabel(day: DashboardHistoryDay) {
  const onTime = day.delivered - day.deliveredLate;
  const failed = day.failed ? `, ${day.failed} en échec` : "";
  return `${HISTORY_DAY_LONG.format(new Date(day.date))} : ${day.delivered} livrée${day.delivered > 1 ? "s" : ""} (${onTime} à l'heure, ${day.deliveredLate} en retard)${failed}`;
}

/** Sept derniers jours : barres empilées « à l'heure » puis « en retard », total au-dessus (DEMO-3, tranche 9). */
export function SevenDayBars({ days }: { days: DashboardHistoryDay[] }) {
  const max = Math.max(...days.map((day) => day.delivered), 0);
  const late = days.reduce((sum, day) => sum + day.deliveredLate, 0);
  const total = days.reduce((sum, day) => sum + day.delivered, 0);
  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm text-muted-foreground">
          {total} livrée{total > 1 ? "s" : ""} en 7 jours, dont {late} en retard
        </span>
        <span className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-chart-ink" />À l&apos;heure</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" />En retard</span>
        </span>
      </figcaption>
      <div className="flex h-32 items-end gap-2 border-b border-chart-track" aria-hidden="true">
        {days.map((day) => {
          const onTime = day.delivered - day.deliveredLate;
          return (
            <div key={day.date} title={historyLabel(day)} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[11px] tabular-nums text-muted-foreground">{day.delivered > 0 ? day.delivered : ""}</span>
              {day.delivered > 0 && (
                <div className="flex w-3 flex-col justify-end gap-[2px]" style={{ height: `${Math.max((day.delivered / max) * 80, 6)}%` }}>
                  {day.deliveredLate > 0 && <div className="w-full rounded-t-[4px] bg-warning" style={{ flexGrow: day.deliveredLate }} />}
                  {onTime > 0 && <div className={cn("w-full bg-chart-ink", day.deliveredLate === 0 && "rounded-t-[4px]")} style={{ flexGrow: onTime }} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
        {days.map((day) => (
          <span key={day.date} className="flex-1 text-center">{HISTORY_DAY.format(new Date(day.date))}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Livraisons des 7 derniers jours</caption>
        <thead>
          <tr><th scope="col">Jour</th><th scope="col">Livrées</th><th scope="col">Dont en retard</th><th scope="col">En échec</th></tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day.date}>
              <th scope="row">{HISTORY_DAY_LONG.format(new Date(day.date))}</th>
              <td>{day.delivered}</td><td>{day.deliveredLate}</td><td>{day.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Fonds teintés des chiffres du jour (sans bordure). */
const TODAY_TINTS: Record<Tone, string> = {
  success: "bg-[#eef8f2] dark:bg-[#1c2722]",
  info: "bg-[#eff4fc] dark:bg-[#1d242c]",
  critical: "bg-[#fdf1f0] dark:bg-[#282120]",
  warning: "bg-[#fdf4ea] dark:bg-[#26231c]",
  neutral: "bg-muted/50",
};

export function TodayMetric({
  label,
  counts,
  variant,
  tone,
  delta,
  onClick,
}: {
  label: string;
  counts: DashboardCategoryCounts;
  variant?: "late";
  tone?: Tone;
  delta?: StatDelta;
  onClick?: () => void;
}) {
  const isClickable = counts.total > 0 && onClick;
  const toneClasses = TONE_CLASSES[resolveTone(tone, counts.total)];
  // Pas de carte dans la carte : une colonne sans bordure ; avec un ton, un fond teinté léger reprend la pastille.
  const surface = cn("rounded-lg p-3", tone && TODAY_TINTS[resolveTone(tone, counts.total)]);

  const inner = (
    <>
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", toneClasses.dot)} aria-hidden="true" />
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tabular-nums",
          variant === "late" && counts.total > 0 ? "text-[#c43b2f] dark:text-error" : toneClasses.value
        )}
      >
        {counts.total}
      </p>
      {delta && <div className="mt-1"><DeltaBadge delta={delta} /></div>}
      {variant !== "late" && (
        <p className="mt-1 text-xs text-muted-foreground">
          {counts.standard} commande{counts.standard > 1 ? "s" : ""} · {counts.courier} course
          {counts.courier > 1 ? "s" : ""}
        </p>
      )}
      {variant === "late" && (
        <p className="mt-1 text-xs text-muted-foreground">Date client dépassée</p>
      )}
    </>
  );

  if (!isClickable) {
    return <div className={surface}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(surface, "flex h-full w-full flex-col items-stretch justify-start text-left transition-shadow", tone ? "hover:ring-1 hover:ring-border" : "hover:bg-muted/60")}
    >
      {inner}
    </button>
  );
}
