"use client";

import { AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useAdminHome } from "@/features/admin/hooks";
import { useAdminLastVisits } from "@/features/admin/contact-last-visit";
import { AdminDailyChart } from "@/features/admin/home/admin-daily-chart";
import { AdminHealthSignal } from "@/features/admin/home/admin-health-signal";
import { AdminKpiGrid } from "@/features/admin/home/admin-kpi-grid";
import { AdminTodoList } from "@/features/admin/home/admin-todo-list";
import { HOME_CARD_CLASS } from "@/features/admin/home/home-card";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";

const todayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

function HomeSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement de l'accueil">
      <div className={cn(HOME_CARD_CLASS, "h-40 animate-pulse")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={cn(HOME_CARD_CLASS, "h-36 animate-pulse")} />
        ))}
      </div>
      <div className={cn(HOME_CARD_CLASS, "h-72 animate-pulse")} />
    </div>
  );
}

/** ADMIN-ESPACE, lot 1 : « À traiter », chiffres clés, courbe 30 jours et voyant de santé. */
export function AdminHomePanel() {
  const lastVisits = useAdminLastVisits();
  const { data, isLoading, error } = useAdminHome(lastVisits);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand first-letter:uppercase">
          {todayFormat.format(new Date())}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ce qui attend une action, les chiffres clés et l&apos;état de la plateforme.</p>
      </header>
      {isInitialQueryLoading(isLoading, data) ? (
        <HomeSkeleton />
      ) : error || !data ? (
        <EmptyState
          icon={AlertTriangle}
          title="Accueil indisponible"
          description="Impossible de charger les chiffres de la plateforme. Le détail plus bas reste consultable."
        />
      ) : (
        <>
          <AdminTodoList todo={data.todo} />
          <AdminKpiGrid kpis={data.kpis} />
          <AdminDailyChart series={data.series} />
          <AdminHealthSignal health={data.health} />
        </>
      )}
    </div>
  );
}
