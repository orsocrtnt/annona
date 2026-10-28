import { AlertTriangle, CheckCircle2, Clock3, PackageOpen, Truck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CityStreets } from "@/features/landing/product-tour/city-map";
import { SpaceSidebar, type SpaceNavItem } from "@/features/landing/product-tour/space-sidebar";
import { TOUR_LANES } from "@/features/landing/product-tour/tour-data";
import { companyNavItems } from "@/features/navigation/nav-config";

/** Le vrai menu de l'espace entreprise : toutes les fonctionnalités disponibles aujourd'hui. */
const NAV: SpaceNavItem[] = companyNavItems.flatMap((item) =>
  // Toutes les icônes de la navigation sont des icônes Lucide.
  item.icon ? [{ icon: item.icon as LucideIcon, label: item.title, active: item.title === "Tableau de bord" }] : []
);

const KPIS = [
  { label: "En retard", value: "3", icon: AlertTriangle, tone: "bg-[#fde8e6] text-[#c2382a]" },
  { label: "Sans livreur", value: "5", icon: PackageOpen, tone: "bg-[#fff1d6] text-[#a8660b]" },
  { label: "En route", value: "7", icon: Truck, tone: "bg-[#eaf2ff] text-[#1d4f9e]" },
  { label: "Livrées", value: "48", icon: CheckCircle2, tone: "bg-[#e6f8ee] text-[#00a854]" },
] as const;

/** Livraisons des 7 derniers jours (démo) : la courbe du graphique. */
const WEEK = [
  { day: "L", count: 31 },
  { day: "M", count: 38 },
  { day: "M", count: 34 },
  { day: "J", count: 44 },
  { day: "V", count: 41 },
  { day: "S", count: 52 },
  { day: "D", count: 48 },
] as const;

const LATE = [
  { number: "#1031", client: "Bureau Bastille", delay: "+2 j" },
  { number: "#1027", client: "Studio Oberkampf", delay: "+3 h" },
] as const;

/** Positions des livreurs sur le plan (repère des rues de la démo). */
const DRIVER_PINS = [
  { x: 96, y: 96 },
  { x: 256, y: 62 },
  { x: 176, y: 214 },
] as const;

/** Un bâton par jour, et la courbe qui relie leurs sommets : on lit le volume et la tendance. */
function WeekChart() {
  const max = Math.max(...WEEK.map((point) => point.count));
  const slot = 300 / WEEK.length;
  const bars = WEEK.map((point, index) => {
    const top = 100 - (point.count / max) * 82;
    return { x: slot * index + slot / 2, top };
  });
  const line = bars.map((bar, index) => `${index === 0 ? "M" : "L"}${bar.x.toFixed(1)} ${bar.top.toFixed(1)}`).join(" ");
  const last = bars[bars.length - 1] ?? { x: 279, top: 18 };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <svg viewBox="0 0 300 104" preserveAspectRatio="none" className="min-h-0 w-full flex-1">
        {[26, 52, 78].map((y) => (
          <line key={y} x1="0" x2="300" y1={y} y2={y} stroke="#e7ece9" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {bars.map((bar, index) => (
          <rect
            key={index}
            x={bar.x - slot * 0.28}
            y={bar.top}
            width={slot * 0.56}
            height={104 - bar.top}
            rx="3"
            fill={index === bars.length - 1 ? "#9be8bf" : "#d3f4e2"}
          />
        ))}
        <path d={line} fill="none" stroke="#00b85c" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <circle cx={last.x} cy={last.top} r="3.5" fill="#00b85c" stroke="#ffffff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 grid grid-cols-7 text-center text-[9px] font-medium text-muted-foreground">
        {WEEK.map((point, index) => (
          <span key={index}>{point.day}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Tableau de bord entreprise recomposé pour l'écran d'accueil de la démo : compteurs, courbe de la semaine,
 * livreurs en direct sur la carte et livraisons en retard, agencés pour tenir dans la fenêtre à toutes les tailles.
 */
export function CoverDashboard() {
  return (
    <div className="flex h-full bg-[#f5f8f6]" aria-hidden>
      <SpaceSidebar items={NAV} dense />
      <div className="@container flex min-w-0 flex-1 flex-col gap-2.5 p-3 sm:p-4">
        <div className="flex items-center justify-between">
          <div className="leading-tight">
            <p className="text-sm font-semibold">Tableau de bord</p>
            <p className="text-[11px] text-muted-foreground">Aujourd&apos;hui, en direct</p>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-[#e6f8ee] px-2 py-1 text-[10px] font-semibold text-[#0e1310]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00d46a]" />
            En direct
          </span>
        </div>

        <ul className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
          {KPIS.map(({ label, value, icon: Icon, tone }) => (
            <li key={label} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-black/[0.05]">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", tone)}>
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="text-base font-bold tracking-[-0.02em]">{value}</p>
                <p className="truncate text-[10px] text-muted-foreground">{label}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[1.15fr_1fr]">
          <section className="flex min-h-0 flex-col rounded-xl bg-white p-2.5 ring-1 ring-black/[0.05]">
            <div className="mb-1 flex items-baseline justify-between">
              <p className="text-[11px] font-semibold">Livraisons · 7 jours</p>
              <p className="text-[10px] font-semibold text-[#00a854]">+16 %</p>
            </div>
            <WeekChart />
          </section>

          <section className="relative hidden min-h-0 overflow-hidden rounded-xl ring-1 ring-black/[0.05] sm:block">
            <svg viewBox="40 30 320 220" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
              <CityStreets />
              {DRIVER_PINS.map((pin) => (
                <g key={`${pin.x}-${pin.y}`}>
                  <circle cx={pin.x} cy={pin.y} r="14" fill="#00d46a" opacity="0.18" />
                  <circle cx={pin.x} cy={pin.y} r="7" fill="#00d46a" stroke="#ffffff" strokeWidth="3" />
                </g>
              ))}
            </svg>
            <p className="absolute left-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">Livreurs en direct</p>
            <ul className="absolute bottom-2 left-2 flex gap-1">
              {TOUR_LANES.map((lane) => (
                <li key={lane.driver} className="rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold">
                  {lane.driver}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-xl bg-white p-2.5 ring-1 ring-black/[0.05]">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold">
            <Clock3 className="h-3.5 w-3.5 text-[#c2382a]" />
            En retard
          </p>
          <ul className="space-y-1">
            {LATE.map((row) => (
              <li key={row.number} className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold">{row.number}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.client}</span>
                <span className="shrink-0 rounded-full bg-[#fde8e6] px-1.5 py-0.5 text-[10px] font-semibold text-[#c2382a]">{row.delay}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
