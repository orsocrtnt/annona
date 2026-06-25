import { cn } from "@/lib/utils";
import { BarChart3, LineChart, PieChart, TrendingUp } from "lucide-react";

type ChartType = "line" | "bar" | "pie" | "area";

interface ChartPlaceholderProps {
  title?: string;
  type?: ChartType;
  height?: number;
  className?: string;
}

const chartIcons: Record<ChartType, React.ComponentType<{ className?: string }>> = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  area: TrendingUp,
};

export function ChartPlaceholder({
  title = "Graphique",
  type = "line",
  height = 240,
  className,
}: ChartPlaceholderProps) {
  const Icon = chartIcons[type];

  return (
    <div className={cn("rounded-xl border border-border bg-card p-6", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Données à venir
          </span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div
        className="relative flex items-end justify-around gap-2 rounded-lg bg-surface-subtle px-4"
        style={{ height }}
      >
        {type === "bar" &&
          [40, 65, 45, 80, 55, 70, 50, 85, 60, 75, 45, 90].map((h, i) => (
            <div
              key={i}
              className="w-full max-w-[24px] rounded-t-sm bg-brand/20 transition-all hover:bg-brand/40"
              style={{ height: `${h}%` }}
            />
          ))}
        {type === "line" && (
          <svg className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" viewBox="0 0 400 200">
            <path
              d="M0,150 Q50,120 100,100 T200,80 T300,60 T400,40"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand/40"
            />
            <path
              d="M0,150 Q50,120 100,100 T200,80 T300,60 T400,40 L400,200 L0,200 Z"
              fill="currentColor"
              className="text-brand/5"
            />
          </svg>
        )}
        {type === "pie" && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-32 w-32 rounded-full border-[16px] border-brand/20 border-t-brand/60 border-r-brand/40" />
          </div>
        )}
        {type === "area" && (
          <svg className="absolute inset-4 h-[calc(100%-2rem)] w-[calc(100%-2rem)]" viewBox="0 0 400 200">
            <path
              d="M0,180 L50,160 L100,140 L150,120 L200,100 L250,110 L300,80 L350,60 L400,50 L400,200 L0,200 Z"
              fill="currentColor"
              className="text-brand/10"
            />
            <path
              d="M0,180 L50,160 L100,140 L150,120 L200,100 L250,110 L300,80 L350,60 L400,50"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand/50"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
