"use client";

import { AlertTriangle, Eye, MousePointerClick, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useAdminWaitlistFunnel } from "@/features/admin/hooks";
import { HomeCard, HOME_CARD_CLASS } from "@/features/admin/home/home-card";
import { CHART_COLORS, DailyLineChart, type DailyLine } from "@/features/admin/home/daily-line-chart";
import { campaignLabel, percentOf } from "@/features/admin/waitlist/waitlist-labels";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { cn } from "@/lib/utils";
import type { FunnelPeriod, WaitlistFunnel } from "@/domains/growth/waitlist-funnel.service";

const numberFormat = new Intl.NumberFormat("fr-FR");
const percentFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const LINES: ReadonlyArray<DailyLine<"visits" | "clicks" | "signups">> = [
  { key: "visits", label: "Visites de /tarifs", short: "Visites", ...CHART_COLORS.blue },
  { key: "clicks", label: "Clics « Rejoindre la liste »", short: "Clics", ...CHART_COLORS.orange },
  { key: "signups", label: "Inscriptions", short: "Inscriptions", ...CHART_COLORS.green },
];

export function formatRate(rate: number | null) {
  return rate === null ? "—" : `${percentFormat.format(rate)} %`;
}

interface PeriodSwitchProps {
  value: FunnelPeriod;
  onChange: (value: FunnelPeriod) => void;
}

function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  return (
    <div role="group" aria-label="Période" className="inline-flex rounded-full border border-border bg-background p-1">
      {([7, 30] as const).map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={value === days}
          onClick={() => onChange(days)}
          className={cn(
            "min-h-9 rounded-full px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {days} jours
        </button>
      ))}
    </div>
  );
}

interface StepProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  rate?: { value: number | null; text: string };
}

function Step({ label, value, icon: Icon, rate }: StepProps) {
  return (
    <HomeCard as="article" className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-muted-foreground">{label}</h3>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f7ec] text-brand dark:bg-brand-subtle" aria-hidden>
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-[2rem]">{numberFormat.format(value)}</p>
      <p className="min-h-5 text-xs text-muted-foreground">
        {rate ? (
          <>
            <span className="font-semibold text-foreground">{formatRate(rate.value)}</span> {rate.text}
          </>
        ) : (
          "première étape de l'entonnoir"
        )}
      </p>
    </HomeCard>
  );
}

function CampaignTable({ funnel }: { funnel: WaitlistFunnel }) {
  return (
    <HomeCard aria-labelledby="waitlist-campaigns-title">
      <h2 id="waitlist-campaigns-title" className="text-lg font-bold tracking-tight text-foreground">Par campagne</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lien <span className="font-mono text-xs">/tarifs?c=code</span> ; sans code valide, la visite compte en « Direct ».
      </p>
      {funnel.campaigns.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">Aucune visite sur la période.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[30rem] text-sm">
            <caption className="sr-only">Visites, clics et inscriptions par campagne, {funnel.days} derniers jours</caption>
            <thead className="bg-secondary/60 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Campagne</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Visites</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Clics</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Inscriptions</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Visites → inscriptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {funnel.campaigns.map((campaign) => (
                <tr key={campaign.code}>
                  <th scope="row" className="px-4 py-2 text-left font-medium text-foreground">{campaignLabel(campaign.code)}</th>
                  <td className="px-4 py-2 text-right tabular-nums">{numberFormat.format(campaign.visits)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numberFormat.format(campaign.clicks)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{numberFormat.format(campaign.signups)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatRate(percentOf(campaign.signups, campaign.visits))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HomeCard>
  );
}

/** ADMIN-ESPACE lot 2 : entonnoir de /tarifs (compteurs anonymes par jour et par campagne). */
export function WaitlistFunnelPanel({ days, onDaysChange }: { days: FunnelPeriod; onDaysChange: (days: FunnelPeriod) => void }) {
  const { data, isLoading, error } = useAdminWaitlistFunnel(days);

  if (isInitialQueryLoading(isLoading, data)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Chargement de l'entonnoir">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => <div key={index} className={cn(HOME_CARD_CLASS, "h-36 animate-pulse")} />)}
        </div>
        <div className={cn(HOME_CARD_CLASS, "h-72 animate-pulse")} />
      </div>
    );
  }
  if (error || !data) {
    return <EmptyState icon={AlertTriangle} title="Entonnoir indisponible" description="Impossible de lire les compteurs de la page Tarifs." />;
  }

  return (
    <section aria-labelledby="waitlist-funnel-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="waitlist-funnel-title" className="text-lg font-bold tracking-tight text-foreground">Page Tarifs : de la visite à l&apos;inscription</h2>
          <p className="mt-1 text-sm text-muted-foreground">Comptage anonyme, sans cookie ni adresse IP. Robots évidents exclus.</p>
        </div>
        <PeriodSwitch value={days} onChange={onDaysChange} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Step label="Visites de la page" value={data.totals.visits} icon={Eye} />
        <Step
          label="Clics « Rejoindre la liste »"
          value={data.totals.clicks}
          icon={MousePointerClick}
          rate={{ value: data.rates.visitToClick, text: "des visites" }}
        />
        <Step
          label="Inscriptions"
          value={data.totals.signups}
          icon={UserPlus}
          rate={{
            value: data.rates.clickToSignup,
            text: `des clics · ${formatRate(data.rates.visitToSignup)} des visites`,
          }}
        />
      </div>
      <DailyLineChart
        series={data.series}
        lines={LINES}
        title={`${data.days} derniers jours`}
        subtitle="Jours à l'heure de Paris, toutes campagnes."
        titleId="waitlist-chart-title"
        tableCaption={`Visites, clics et inscriptions par jour, ${data.days} derniers jours`}
      />
      <CampaignTable funnel={data} />
    </section>
  );
}
