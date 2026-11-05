"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { HomeCard } from "@/features/admin/home/home-card";
import { cn } from "@/lib/utils";
import type { AdminHomeDay } from "@/domains/admin/admin-home.service";

/**
 * Courbe 30 jours de l'accueil super-administrateur : commandes créées et livraisons livrées par jour
 * (jours à l'heure de Paris, entreprises de démonstration exclues). SVG maison, sans bibliothèque.
 * Couleurs validées par le script du skill dataviz (Clair : #2a78d6 / #08783f, Sombre : #3987e5 / #2fae6f).
 */
const SERIES = [
  {
    key: "orders",
    label: "Commandes créées",
    stroke: "stroke-[#2a78d6] dark:stroke-[#3987e5]",
    fill: "fill-[#2a78d6] dark:fill-[#3987e5]",
    swatch: "bg-[#2a78d6] dark:bg-[#3987e5]",
  },
  {
    key: "delivered",
    label: "Livraisons livrées",
    stroke: "stroke-[#08783f] dark:stroke-[#2fae6f]",
    fill: "fill-[#08783f] dark:fill-[#2fae6f]",
    swatch: "bg-[#08783f] dark:bg-[#2fae6f]",
  },
] as const;

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 32 };
const dayShort = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dayLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("fr-FR");

/** Les jours sont des dates civiles (« 2026-11-05 ») : lues à midi UTC pour ne jamais changer de jour. */
function dayDate(day: string) {
  return new Date(`${day}T12:00:00Z`);
}

/** Graduation entière et ronde : 1, 2, 5 × 10ⁿ, au moins 1. */
export function niceAxis(max: number, ticks = 4) {
  const raw = Math.max(1, max) / ticks;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * power).find((candidate) => candidate >= raw) ?? 10 * power);
  const top = Math.max(step, Math.ceil(Math.max(1, max) / step) * step);
  const values: number[] = [];
  for (let value = 0; value <= top; value += step) values.push(value);
  return { top, values };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.floor(element.getBoundingClientRect().width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

export function AdminDailyChart({ series }: { series: AdminHomeDay[] }) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const totals = useMemo(
    () => ({
      orders: series.reduce((sum, day) => sum + day.orders, 0),
      delivered: series.reduce((sum, day) => sum + day.delivered, 0),
    }),
    [series]
  );
  const axis = niceAxis(Math.max(0, ...series.map((day) => Math.max(day.orders, day.delivered))));
  const innerWidth = Math.max(0, width - PAD.left - PAD.right);
  const innerHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (series.length <= 1 ? innerWidth / 2 : (index / (series.length - 1)) * innerWidth);
  const y = (value: number) => PAD.top + innerHeight - (value / axis.top) * innerHeight;
  const path = (key: "orders" | "delivered") =>
    series.map((day, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(day[key]).toFixed(1)}`).join(" ");
  const labelIndexes = series.length > 0 ? [...new Set([0, Math.floor((series.length - 1) / 2), series.length - 1])] : [];
  const last = series.length - 1;

  const summary =
    series.length === 0
      ? "Aucune donnée sur la période."
      : `Sur ${series.length} jours, du ${dayLong.format(dayDate(series[0]!.day))} au ${dayLong.format(dayDate(series[last]!.day))} : ` +
        `${numberFormat.format(totals.orders)} commandes créées et ${numberFormat.format(totals.delivered)} livraisons livrées. ` +
        `Aujourd'hui : ${series[last]!.orders} commandes, ${series[last]!.delivered} livrées.`;

  const pickIndex = (clientX: number, rect: DOMRect) => {
    if (series.length === 0 || innerWidth <= 0) return null;
    const ratio = (clientX - rect.left - PAD.left) / innerWidth;
    return Math.min(last, Math.max(0, Math.round(ratio * last)));
  };

  const activeDay = active !== null ? series[active] : null;
  const tooltipLeft = active !== null ? Math.min(Math.max(x(active), 80), Math.max(80, width - 80)) : 0;

  return (
    <HomeCard aria-labelledby="admin-chart-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="admin-chart-title" className="text-lg font-bold tracking-tight text-foreground">30 derniers jours</h2>
          <p className="mt-1 text-sm text-muted-foreground">Toutes entreprises hors démo, jours à l&apos;heure de Paris.</p>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Légende">
          {SERIES.map((serie) => (
            <li key={serie.key} className="flex items-center gap-2 text-foreground">
              <span className={cn("h-0.5 w-4 rounded-full", serie.swatch)} aria-hidden />
              {serie.label}
              <span className="tabular-nums text-muted-foreground">{numberFormat.format(totals[serie.key])}</span>
            </li>
          ))}
        </ul>
      </div>

      <div ref={ref} className="relative mt-4 w-full">
        {width > 0 && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={summary}
            tabIndex={0}
            className="block touch-pan-y rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerMove={(event) => setActive(pickIndex(event.clientX, event.currentTarget.getBoundingClientRect()))}
            onPointerDown={(event) => setActive(pickIndex(event.clientX, event.currentTarget.getBoundingClientRect()))}
            onPointerLeave={() => setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(event) => {
              if (series.length === 0) return;
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                setActive((current) => Math.max(0, (current ?? last + 1) - 1));
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                setActive((current) => Math.min(last, (current ?? -1) + 1));
              } else if (event.key === "Escape") {
                setActive(null);
              }
            }}
          >
            {axis.values.map((value) => (
              <g key={value}>
                <line
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(value)}
                  y2={y(value)}
                  className="stroke-border"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text x={PAD.left - 8} y={y(value)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
                  {numberFormat.format(value)}
                </text>
              </g>
            ))}
            {labelIndexes.map((index) => (
              <text
                key={index}
                x={x(index)}
                y={HEIGHT - 8}
                textAnchor={index === 0 ? "start" : index === last ? "end" : "middle"}
                className="fill-muted-foreground text-[11px]"
              >
                {index === last ? "Aujourd'hui" : dayShort.format(dayDate(series[index]!.day))}
              </text>
            ))}
            {activeDay && active !== null && (
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + innerHeight}
                className="stroke-muted-foreground/50"
                strokeWidth={1}
                shapeRendering="crispEdges"
              />
            )}
            {SERIES.map((serie) => (
              <path
                key={serie.key}
                d={path(serie.key)}
                fill="none"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={serie.stroke}
              />
            ))}
            {SERIES.map((serie) => {
              const index = active ?? last;
              const day = series[index];
              if (!day) return null;
              return (
                <circle
                  key={serie.key}
                  cx={x(index)}
                  cy={y(day[serie.key])}
                  r={4}
                  strokeWidth={2}
                  className={cn(serie.fill, "stroke-card")}
                />
              );
            })}
          </svg>
        )}
        {activeDay && active !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-10 w-40 -translate-x-1/2 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
            style={{ left: tooltipLeft }}
          >
            <p className="font-semibold first-letter:uppercase">{dayLong.format(dayDate(activeDay.day))}</p>
            {SERIES.map((serie) => (
              <p key={serie.key} className="mt-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", serie.swatch)} />
                  {serie.key === "orders" ? "Commandes" : "Livrées"}
                </span>
                <span className="font-semibold tabular-nums">{activeDay[serie.key]}</span>
              </p>
            ))}
          </div>
        )}
        {width === 0 && <div style={{ height: HEIGHT }} aria-hidden />}
      </div>

      <details className="group mt-4 rounded-2xl border border-border">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl">
          Voir les chiffres jour par jour
        </summary>
        <div className="max-h-72 overflow-auto border-t border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Commandes créées et livraisons livrées par jour, 30 derniers jours</caption>
            <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Jour</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Commandes</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Livrées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...series].reverse().map((day) => (
                <tr key={day.day}>
                  <th scope="row" className="px-4 py-2 text-left font-normal text-foreground">{dayShort.format(dayDate(day.day))}</th>
                  <td className="px-4 py-2 text-right tabular-nums">{day.orders}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{day.delivered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </HomeCard>
  );
}
