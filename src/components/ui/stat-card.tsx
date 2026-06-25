import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { DashboardStat } from "@/types";

interface StatCardProps extends DashboardStat {
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon: Icon,
  className,
  onClick,
}: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const numericValue = typeof value === "number" ? value : Number(value);
  const isClickable = Boolean(onClick) && numericValue > 0;

  const content = (
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-subtle">
            <Icon className="h-5 w-5 text-brand" />
          </div>
        )}
      </div>
    </CardContent>
  );

  if (!isClickable) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        {content}
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors hover:border-brand/40 hover:shadow-md",
        className
      )}
    >
      <button type="button" className="w-full text-left" onClick={onClick}>
        {content}
      </button>
    </Card>
  );
}
