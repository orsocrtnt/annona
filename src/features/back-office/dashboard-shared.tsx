"use client";

import { cn } from "@/lib/utils";
import { TONE_CLASSES, resolveTone, type Tone } from "@/components/ui/tone";
import { DeltaBadge, type StatDelta } from "@/components/ui/stat-card";
import type { DashboardCategoryCounts } from "@/lib/dashboard/dashboard-types";
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
    return <span className={className}>{value}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-6 min-w-6 max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-md px-1.5 py-0.5 font-medium text-brand underline-offset-2 transition-colors hover:bg-brand/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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
  accentClass,
  onClick,
}: {
  label: string;
  counts: DashboardCategoryCounts;
  field: keyof DashboardCategoryCounts;
  icon: typeof Package;
  accentClass: string;
  onClick?: () => void;
}) {
  const value = counts[field];
  const isClickable = value > 0 && onClick;

  const inner = (
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
        {isClickable && <p className="mt-2 text-xs text-brand">Voir le détail →</p>}
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background/60">
        <Icon className="h-5 w-5 text-foreground/70" />
      </div>
    </div>
  );

  if (!isClickable) {
    return <div className={cn("rounded-xl border p-5", accentClass)}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border p-5 text-left transition-colors hover:shadow-md",
        accentClass
      )}
    >
      {inner}
    </button>
  );
}

const DONUT_RADIUS = 42;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** Tons du diagramme en jetons : encre en Light, gris clair en Dark (classes complètes pour Tailwind). */
const DONUT_TONES = {
  ink: { stroke: "stroke-chart-ink", dot: "bg-chart-ink" },
  mid: { stroke: "stroke-chart-mid", dot: "bg-chart-mid" },
  soft: { stroke: "stroke-chart-soft", dot: "bg-chart-soft" },
} as const;
export type DonutTone = keyof typeof DONUT_TONES;

/** Répartition des missions du jour, en tons encre (les diagrammes suivent la direction Encre). */
export function TodayDonut({
  segments,
}: {
  segments: { label: string; value: number; tone: DonutTone }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <figure className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" className="stroke-chart-track" strokeWidth="10" />
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
              strokeWidth="10"
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

/** Livraisons terminées par heure, en barres encre (direction Encre pour les diagrammes). */
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
      <div className="flex h-16 items-end gap-1" role="img" aria-label={`Livraisons terminées par heure, maximum ${max}`}>
        {values.map((value, hour) => (
          <div
            key={hour}
            title={`${hour} h : ${value} livraison${value > 1 ? "s" : ""}`}
            className="flex h-full flex-1 items-end rounded-[4px] bg-[#f3f5f3] dark:bg-chart-track"
          >
            {value > 0 && (
              <div
                className="w-full rounded-[4px] bg-chart-ink"
                style={{ height: `${Math.max((value / max) * 100, 6)}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
        <span>0 h</span>
        <span>6 h</span>
        <span>12 h</span>
        <span>18 h</span>
        <span>23 h</span>
      </div>
    </figure>
  );
}

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
  const surface = cn("rounded-xl border p-4", toneClasses.surface);

  const inner = (
    <>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          variant === "late" && counts.total > 0 ? "text-[#c43b2f] dark:text-error" : toneClasses.value
        )}
      >
        {counts.total}
      </p>
      {delta && <div className="mt-1"><DeltaBadge delta={delta} /></div>}
      {variant !== "late" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {counts.standard} commande{counts.standard > 1 ? "s" : ""} · {counts.courier} course
          {counts.courier > 1 ? "s" : ""}
        </p>
      )}
      {variant === "late" && (
        <p className="mt-2 text-xs text-muted-foreground">Date client dépassée</p>
      )}
      {isClickable && <p className="mt-2 text-xs text-brand">Voir le détail →</p>}
    </>
  );

  if (!isClickable) {
    return <div className={surface}>{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(surface, "w-full text-left transition-shadow hover:shadow-md")}
    >
      {inner}
    </button>
  );
}
