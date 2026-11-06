import { Building2, Truck } from "lucide-react";
import { DeltaBadge } from "@/components/ui/stat-card";
import { HomeCard } from "@/features/admin/home/home-card";
import type { AdminHomeKpis } from "@/domains/admin/admin-home.service";

const numberFormat = new Intl.NumberFormat("fr-FR");

interface KpiCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

function KpiCard({ label, value, icon: Icon, children }: KpiCardProps) {
  return (
    <HomeCard as="article" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-[2rem]">{value}</p>
      <div className="min-h-5 text-xs text-muted-foreground">{children}</div>
    </HomeCard>
  );
}

export function AdminKpiGrid({ kpis }: { kpis: AdminHomeKpis }) {
  return (
    <section aria-labelledby="admin-kpi-title">
      <h2 id="admin-kpi-title" className="sr-only">Chiffres clés</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard label="Entreprises actives" value={numberFormat.format(kpis.activeCompanies.current)} icon={Building2}>
          <p>
            {kpis.activeCompanies.newLast30Days > 0
              ? `dont ${numberFormat.format(kpis.activeCompanies.newLast30Days)} créée${kpis.activeCompanies.newLast30Days > 1 ? "s" : ""} ces 30 derniers jours`
              : "aucune nouvelle ces 30 derniers jours"}
          </p>
        </KpiCard>
        <KpiCard label="Livraisons livrées aujourd'hui" value={numberFormat.format(kpis.deliveredToday.current)} icon={Truck}>
          {kpis.deliveredToday.previous !== null && (
            <DeltaBadge
              delta={{
                value: kpis.deliveredToday.current - kpis.deliveredToday.previous,
                label: `vs ${numberFormat.format(kpis.deliveredToday.previous)} il y a 7 jours à la même heure`,
                goodWhen: "up",
              }}
            />
          )}
        </KpiCard>
      </div>
    </section>
  );
}
