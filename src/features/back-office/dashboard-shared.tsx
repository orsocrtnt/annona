"use client";

import { cn } from "@/lib/utils";
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

export function TodayMetric({
  label,
  counts,
  variant,
  onClick,
}: {
  label: string;
  counts: DashboardCategoryCounts;
  variant?: "late";
  onClick?: () => void;
}) {
  const isClickable = counts.total > 0 && onClick;

  const inner = (
    <>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold",
          variant === "late" && counts.total > 0 ? "text-destructive" : "text-foreground"
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
    return (
      <div className="rounded-lg border border-border/60 bg-muted/20 p-4">{inner}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-border/60 bg-muted/20 p-4 text-left transition-colors hover:border-brand/30 hover:bg-muted/40"
    >
      {inner}
    </button>
  );
}
