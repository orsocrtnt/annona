import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { TONE_CLASSES, resolveTone, type Tone } from "./tone";
import type { DashboardStat } from "@/types";

export type StatDelta = {
  /** Écart absolu avec le point de comparaison (ex. hier à la même heure). */
  value: number;
  label: string;
  /** Sens favorable : une hausse des retards est une mauvaise nouvelle. */
  goodWhen: "up" | "down";
};

/** Écart affiché en valeur absolue : sur de petits volumes, un pourcentage exagère. */
export function DeltaBadge({ delta }: { delta: StatDelta }) {
  const { value, label, goodWhen } = delta;
  const isGood = value === 0 ? null : (value > 0) === (goodWhen === "up");
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs">
      <span
        className={cn(
          "whitespace-nowrap font-semibold",
          isGood === null ? "text-muted-foreground" : isGood ? "text-brand" : "text-[#c43b2f] dark:text-error"
        )}
      >
        {value > 0 ? `↑ +${value}` : value < 0 ? `↓ ${value}` : "="}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

interface StatCardProps extends DashboardStat {
  className?: string;
  onClick?: () => void;
  /** Teinte d'état (direction Menthe). Une alerte critique à zéro reste neutre. */
  tone?: Tone;
  delta?: StatDelta;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  className,
  onClick,
  tone,
  delta,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const numericValue = typeof value === "number" ? value : Number(value);
  const isClickable = Boolean(onClick) && numericValue > 0;
  const toneClasses = tone ? TONE_CLASSES[resolveTone(tone, numericValue)] : null;

  const content = (
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-3xl font-semibold tracking-tight",
              toneClasses ? toneClasses.value : "text-foreground"
            )}
          >
            {value}
          </p>
          {delta && <DeltaBadge delta={delta} />}
          {(change !== undefined || changeLabel) && (
            <div className="flex items-center gap-1.5">
              {change !== undefined && (
                <>
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isPositive ? "text-success" : "text-destructive"
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {change}%
                  </span>
                </>
              )}
              {changeLabel && (
                <span className="text-xs text-muted-foreground">{changeLabel}</span>
              )}
            </div>
          )}
          {isClickable && (
            <p className="text-xs text-brand">Voir le détail →</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              toneClasses ? toneClasses.icon : "bg-brand-subtle text-brand"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </CardContent>
  );

  if (!isClickable) {
    return (
      <Card className={cn("overflow-hidden", toneClasses?.surface, className)}>
        {content}
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors hover:border-brand/40 hover:shadow-md",
        toneClasses?.surface,
        className
      )}
    >
      <button type="button" className="w-full text-left" onClick={onClick}>
        {content}
      </button>
    </Card>
  );
}
