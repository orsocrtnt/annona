"use client";

import { cn } from "@/lib/utils";
import { TONE_CLASSES, resolveTone, type Tone } from "@/components/ui/tone";
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
        "inline-flex min-h-6 min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 font-medium text-brand underline-offset-2 transition-colors hover:bg-brand/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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

/** Répartition des missions du jour, en tons encre (les diagrammes suivent la direction Encre). */
export function TodayDonut({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <figure className="flex items-center gap-5">
      <svg viewBox="0 0 100 100" className="h-28 w-28 shrink-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={DONUT_RADIUS} fill="none" stroke="#eef1ee" strokeWidth="10" />
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
              stroke={segment.color}
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
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label} · <span className="font-medium text-foreground">{segment.value}</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

export function TodayMetric({
  label,
  counts,
  variant,
  tone,
  onClick,
}: {
  label: string;
  counts: DashboardCategoryCounts;
  variant?: "late";
  tone?: Tone;
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
          variant === "late" && counts.total > 0 ? "text-[#c43b2f]" : toneClasses.value
        )}
      >
        {counts.total}
      </p>
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
