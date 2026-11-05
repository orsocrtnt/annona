import { Building2, ReceiptText, Truck, UserPlus } from "lucide-react";
import { DeltaBadge } from "@/components/ui/stat-card";
import { formatCurrency } from "@/features/client-portal/utils";
import { HomeCard } from "@/features/admin/home/home-card";
import { cn } from "@/lib/utils";
import type { AdminHomeKpis } from "@/domains/admin/admin-home.service";

const numberFormat = new Intl.NumberFormat("fr-FR");
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });

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

function MoneyDelta({ currentCents, previousCents, label }: { currentCents: number; previousCents: number; label: string }) {
  const diff = currentCents - previousCents;
  const tone = diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-brand" : "text-[#c43b2f] dark:text-error";
  const sign = diff > 0 ? "↑ +" : diff < 0 ? "↓ −" : "";
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs">
      <span className={cn("whitespace-nowrap font-semibold", tone)}>
        {diff === 0 ? "=" : `${sign}${formatCurrency(Math.abs(diff) / 100)}`}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </p>
  );
}

export function AdminKpiGrid({ kpis }: { kpis: AdminHomeKpis }) {
  const revenue = kpis.subscriptionRevenue;
  const previousMonth = revenue
    ? monthFormat.format(new Date(new Date(revenue.monthStartsAt).getTime() - 86_400_000))
    : "";
  return (
    <section aria-labelledby="admin-kpi-title">
      <h2 id="admin-kpi-title" className="sr-only">Chiffres clés</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Entreprises actives" value={numberFormat.format(kpis.activeCompanies.current)} icon={Building2}>
          <p>
            {kpis.activeCompanies.newLast30Days > 0
              ? `dont ${numberFormat.format(kpis.activeCompanies.newLast30Days)} créée${kpis.activeCompanies.newLast30Days > 1 ? "s" : ""} ces 30 derniers jours`
              : "aucune nouvelle ces 30 derniers jours"}
            {" · hors démo"}
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
        <KpiCard label="Inscrits à la liste d'attente" value={numberFormat.format(kpis.waitlist.total)} icon={UserPlus}>
          <p>
            <span className={cn("font-semibold", kpis.waitlist.last7Days > 0 && "text-brand")}>
              +{numberFormat.format(kpis.waitlist.last7Days)}
            </span>{" "}
            sur 7 jours
          </p>
        </KpiCard>
        <KpiCard
          label="Abonnements encaissés HT"
          value={revenue ? formatCurrency(revenue.currentCents / 100) : "Indisponible"}
          icon={ReceiptText}
        >
          {revenue ? (
            revenue.previousCents !== null ? (
              <MoneyDelta
                currentCents={revenue.currentCents}
                previousCents={revenue.previousCents}
                label={`vs ${formatCurrency(revenue.previousCents / 100)} en ${previousMonth} (mois entier)`}
              />
            ) : (
              <p>mois en cours, sans comparaison</p>
            )
          ) : (
            <p>lecture du journal de facturation impossible</p>
          )}
        </KpiCard>
      </div>
    </section>
  );
}
