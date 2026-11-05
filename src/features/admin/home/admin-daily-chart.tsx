"use client";

import { CHART_COLORS, DailyLineChart, type DailyLine } from "@/features/admin/home/daily-line-chart";
import type { AdminHomeDay } from "@/domains/admin/admin-home.service";

/** Courbe 30 jours de l'accueil : commandes créées et livraisons livrées (hors démo, jours de Paris). */
const LINES: ReadonlyArray<DailyLine<"orders" | "delivered">> = [
  { key: "orders", label: "Commandes créées", short: "Commandes", ...CHART_COLORS.blue },
  { key: "delivered", label: "Livraisons livrées", short: "Livrées", ...CHART_COLORS.green },
];

export function AdminDailyChart({ series }: { series: AdminHomeDay[] }) {
  return (
    <DailyLineChart
      series={series}
      lines={LINES}
      title="30 derniers jours"
      subtitle="Toutes entreprises hors démo, jours à l'heure de Paris."
      titleId="admin-chart-title"
      tableCaption="Commandes créées et livraisons livrées par jour, 30 derniers jours"
    />
  );
}
