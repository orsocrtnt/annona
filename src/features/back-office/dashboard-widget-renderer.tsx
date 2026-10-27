"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bike,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Radio,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { PageLoader } from "@/components/ui/loader";
import { cn } from "@/lib/utils";
import { DASHBOARD_PERIOD_LABELS } from "@/lib/dashboard/period-stats";
import type { DashboardWidgetLayout, DashboardWidgetType } from "@/lib/dashboard/dashboard-layout";
import { useDashboardContext, useWidgetPeriod } from "@/features/back-office/dashboard-context";
import {
  PERIOD_OPTIONS,
  STATUS_ROWS,
  STATUS_WIDGET_MAP,
} from "@/features/back-office/dashboard-drill-down";
import { CategoryCard, ClickableCount, TodayMetric } from "@/features/back-office/dashboard-shared";
import { useDriverLiveLocations } from "@/features/back-office/dispatch-map-hooks";
import { lockedOfferReason } from "@/domains/saas/saas-access";
import { useHasOfferFeature, useOfferAccess } from "@/features/saas/use-offer-access";
import { getCompactStatusLabel } from "@/lib/constants/order-status";
import { buildDispatchTargetHref } from "@/features/back-office/dispatch-focus";
import type { DashboardDeliveryItem } from "@/lib/dashboard/dashboard-types";

const DeliveriesMapWidget = dynamic(
  () =>
    import("@/features/back-office/dashboard-map-widgets").then((m) => m.DeliveriesMapWidget),
  { ssr: false, loading: () => <MapWidgetSkeleton /> }
);

const DriversMapWidget = dynamic(
  () =>
    import("@/features/back-office/dashboard-map-widgets").then((m) => m.DriversMapWidget),
  { ssr: false, loading: () => <MapWidgetSkeleton /> }
);

function MapWidgetSkeleton() {
  return (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-border bg-muted/20">
      <PageLoader />
    </div>
  );
}

function PeriodToggle() {
  const { period, setPeriod } = useDashboardContext();

  return (
    <div className="inline-flex rounded-full border border-black/[0.065] bg-[#f3f5f2] p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setPeriod(option.key)}
          aria-pressed={period === option.key}
          className={cn(
            "min-h-11 rounded-full px-3 text-xs font-semibold transition-all",
            period === option.key
              ? "bg-[#0e1310] text-white shadow-sm hover:bg-[#0e1310]"
              : "text-[#68726b] hover:bg-white hover:text-[#0e1310]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PremiumKpiCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof Package;
  tone?: "neutral" | "success" | "danger";
  onClick?: () => void;
}) {
  const Component = value > 0 && onClick ? "button" : "div";
  return (
    <Component
      {...(Component === "button" ? { type: "button" as const, onClick } : {})}
      className={cn(
        "group relative min-h-[148px] overflow-hidden rounded-2xl border bg-white p-5 text-left transition-all duration-300",
        Component === "button" && "hover:-translate-y-0.5 hover:border-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d46a] focus-visible:ring-offset-2",
        tone === "danger" && value > 0
          ? "border-[#efc5c5]"
          : tone === "success"
            ? "border-[#ccebd9]"
            : "border-black/[0.065]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#68726b]">{label}</p>
          <p
            className={cn(
              "mt-3 text-[2.25rem] font-semibold leading-none tracking-[-0.04em] text-[#0e1310]",
              tone === "danger" && value > 0 && "text-[#a12c2c]"
            )}
          >
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            tone === "success"
              ? "bg-[#dcf8e7] text-[#08783f]"
              : tone === "danger" && value > 0
                ? "bg-[#fff0f0] text-[#b63737]"
                : "bg-[#f1f4f1] text-[#4f5c54]"
          )}
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden />
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-[#5f6962]">
        <span>{detail}</span>
        {Component === "button" && (
          <ArrowUpRight className="h-4 w-4 text-[#0e1310] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        )}
      </div>
    </Component>
  );
}

function AlertsRowWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();

  return (
    <section aria-label="Indicateurs essentiels" className="grid gap-4 sm:grid-cols-3">
      <PremiumKpiCard
        label="En cours"
        value={dashboard.alerts.inProgress}
        detail="Missions actuellement en route"
        icon={Clock3}
        onClick={() =>
          openDrillDown({
            scope: "alert",
            key: "inProgress",
            title: "Missions en cours de route",
          })
        }
      />
      <PremiumKpiCard
        label="Terminées aujourd'hui"
        value={dashboard.today.delivered.total}
        detail={`${dashboard.today.delivered.standard} commande${dashboard.today.delivered.standard > 1 ? "s" : ""} · ${dashboard.today.delivered.courier} course${dashboard.today.delivered.courier > 1 ? "s" : ""}`}
        icon={CheckCircle2}
        tone="success"
        onClick={() =>
          openDrillDown({
            scope: "today",
            key: "delivered",
            title: "Missions livrées aujourd'hui",
          })
        }
      />
      <PremiumKpiCard
        label="En retard"
        value={dashboard.alerts.late}
        detail="Date demandée par le client dépassée"
        icon={AlertTriangle}
        tone="danger"
        onClick={() =>
          openDrillDown({
            scope: "alert",
            key: "late",
            title: "Missions en retard",
            description: "Date demandée par le client dépassée",
          })
        }
      />
    </section>
  );
}

function AlertLateWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <StatCard
      label="En retard"
      value={dashboard.alerts.late}
      icon={AlertTriangle}
      className={dashboard.alerts.late > 0 ? "border-destructive/40" : undefined}
      onClick={() =>
        openDrillDown({
          scope: "alert",
          key: "late",
          title: "Missions en retard",
          description: "Date demandée par le client dépassée",
        })
      }
    />
  );
}

function AlertUnassignedWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <StatCard
      label="Sans livreur"
      value={dashboard.alerts.unassigned}
      icon={Package}
      onClick={() =>
        openDrillDown({
          scope: "alert",
          key: "unassigned",
          title: "Missions sans livreur",
        })
      }
    />
  );
}

function AlertAssignedNotStartedWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <StatCard
      label="Assignées non démarrées"
      value={dashboard.alerts.assignedNotStarted}
      icon={UserCheck}
      onClick={() =>
        openDrillDown({
          scope: "alert",
          key: "assignedNotStarted",
          title: "Missions assignées non démarrées",
        })
      }
    />
  );
}

function AlertInProgressWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <StatCard
      label="En cours de route"
      value={dashboard.alerts.inProgress}
      icon={Truck}
      onClick={() =>
        openDrillDown({
          scope: "alert",
          key: "inProgress",
          title: "Missions en cours de route",
        })
      }
    />
  );
}

function TodaySummaryWidget() {
  const { dashboard, openDrillDown, period } = useDashboardContext();
  const periodStats = dashboard.periods[period];
  const values = STATUS_ROWS.map((row) => periodStats.byStatus[row.key].total);
  const maxValue = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = 24 + index * 113;
    const y = 108 - (value / maxValue) * 72;
    return { x, y, value, row: STATUS_ROWS[index]! };
  });
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPoints = `24,116 ${linePoints} 476,116`;

  return (
    <section className="overflow-hidden rounded-2xl bg-[#0e1310] text-white shadow-[0_22px_60px_rgba(14,19,16,0.13)]">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-7 sm:pt-7">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-xl font-semibold tracking-[-0.035em]">Répartition par étape</h2>
            <span className="text-sm text-white/45">{DASHBOARD_PERIOD_LABELS[period]}</span>
          </div>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
            Volumes des missions visibles à chaque statut sur la période sélectionnée.
          </p>
        </div>
        <PeriodToggle />
      </div>

      <div className="px-3 sm:px-6">
        <svg
          role="img"
          aria-label={`Répartition des ${periodStats.total.total} missions par statut sur ${DASHBOARD_PERIOD_LABELS[period]}`}
          viewBox="0 0 500 128"
          className="h-[190px] w-full overflow-visible sm:h-[230px]"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="dashboardActivityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D46A" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#00D46A" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[36, 60, 84, 108].map((y) => (
            <line key={y} x1="24" y1={y} x2="476" y2={y} stroke="rgba(255,255,255,0.075)" strokeWidth="1" />
          ))}
          <polygon points={areaPoints} fill="url(#dashboardActivityFill)" />
          <polyline
            points={linePoints}
            pathLength="1"
            fill="none"
            stroke="#00D46A"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dashboard-v2-route-line"
          />
          {points.map(({ x, y, value, row }) => (
            <g key={row.key}>
              <circle cx={x} cy={y} r="7" fill="#0E1310" stroke="#00D46A" strokeWidth="3" />
              <text x={x} y={Math.max(19, y - 13)} fill="white" textAnchor="middle" fontSize="12" fontWeight="700">
                {value}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-2 border-t border-white/10 sm:grid-cols-5">
        {points.map(({ value, row }, index) => (
          <button
            key={row.key}
            type="button"
            onClick={() =>
              openDrillDown({
                scope: "periodStatus",
                status: row.key,
                title: `${row.label} — ${DASHBOARD_PERIOD_LABELS[period]}`,
              })
            }
            className={cn(
              "group min-h-[78px] border-white/10 px-4 py-3 text-left transition-colors hover:bg-white/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#00d46a]",
              index > 0 && "sm:border-l",
              index === points.length - 1 && "col-span-2 sm:col-span-1"
            )}
          >
            <span className="block text-[11px] leading-4 text-white/48">{row.label}</span>
            <span className="mt-1 flex items-center justify-between text-sm font-semibold">
              {value} mission{value > 1 ? "s" : ""}
              <ArrowUpRight className="h-3.5 w-3.5 text-[#00d46a] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function TodayDeliveredWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <Card>
      <CardContent className="p-4">
        <TodayMetric
          label="Livrées aujourd'hui"
          counts={dashboard.today.delivered}
          onClick={() =>
            openDrillDown({
              scope: "today",
              key: "delivered",
              title: "Missions livrées aujourd'hui",
            })
          }
        />
      </CardContent>
    </Card>
  );
}

function TodayInProgressWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <Card>
      <CardContent className="p-4">
        <TodayMetric
          label="En cours aujourd'hui"
          counts={dashboard.today.inProgress}
          onClick={() =>
            openDrillDown({
              scope: "today",
              key: "inProgress",
              title: "Missions en cours aujourd'hui",
            })
          }
        />
      </CardContent>
    </Card>
  );
}

function TodayRemainingWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <Card>
      <CardContent className="p-4">
        <TodayMetric
          label="Restantes aujourd'hui"
          counts={dashboard.today.remaining}
          onClick={() =>
            openDrillDown({
              scope: "today",
              key: "remaining",
              title: "Missions restantes aujourd'hui",
            })
          }
        />
      </CardContent>
    </Card>
  );
}

function TodayLateWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <Card>
      <CardContent className="p-4">
        <TodayMetric
          label="En retard aujourd'hui"
          counts={{ standard: 0, courier: 0, total: dashboard.today.late }}
          variant="late"
          onClick={() =>
            openDrillDown({
              scope: "today",
              key: "late",
              title: "Missions en retard aujourd'hui",
              description: "Date client dépassée",
            })
          }
        />
      </CardContent>
    </Card>
  );
}

function PlanningCategoriesSection({
  widgetPeriod,
}: {
  widgetPeriod?: import("@/lib/dashboard/dashboard-types").DashboardPeriodKey;
}) {
  const { dashboard, openDrillDown, period: globalPeriod } = useDashboardContext();
  const period = widgetPeriod ?? globalPeriod;
  const periodStats = dashboard.periods[period];
  const periodLabel = DASHBOARD_PERIOD_LABELS[period];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <CategoryCard
        label="Commandes"
        counts={periodStats.total}
        field="standard"
        icon={Package}
        accentClass="border-rose-200 bg-rose-50/80"
        onClick={() =>
          openDrillDown({
            scope: "period",
            key: "standard",
            title: `Commandes — ${periodLabel}`,
          })
        }
      />
      <CategoryCard
        label="Courses"
        counts={periodStats.total}
        field="courier"
        icon={Bike}
        accentClass="border-blue-200 bg-blue-50/80"
        onClick={() =>
          openDrillDown({
            scope: "period",
            key: "courier",
            title: `Courses — ${periodLabel}`,
          })
        }
      />
      <CategoryCard
        label="Total missions"
        counts={periodStats.total}
        field="total"
        icon={Truck}
        accentClass="border-border bg-muted/20"
        onClick={() =>
          openDrillDown({
            scope: "period",
            key: "all",
            title: `Total missions — ${periodLabel}`,
          })
        }
      />
    </div>
  );
}

function PlanningStatusTableSection({ widgetPeriod }: { widgetPeriod?: import("@/lib/dashboard/dashboard-types").DashboardPeriodKey }) {
  const { dashboard, openDrillDown, period: globalPeriod } = useDashboardContext();
  const period = widgetPeriod ?? globalPeriod;
  const periodStats = dashboard.periods[period];
  const periodLabel = DASHBOARD_PERIOD_LABELS[period];

  return (
    <>
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-3 pr-4 font-medium">Statut</th>
            <th className="pb-3 px-2 text-center font-medium">Commandes</th>
            <th className="pb-3 px-2 text-center font-medium">Courses</th>
            <th className="pb-3 pl-2 text-center font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {STATUS_ROWS.map((row) => {
            const counts = periodStats.byStatus[row.key];
            return (
              <tr key={row.key} className="border-b border-border/60 last:border-0">
                <td className="py-3 pr-4 font-medium">{row.label}</td>
                <td className="py-3 px-2 text-center">
                  <ClickableCount
                    value={counts.standard}
                    onClick={() =>
                      openDrillDown({
                        scope: "periodStatus",
                        status: row.key,
                        category: "standard",
                        title: `${row.label} — commandes (${periodLabel})`,
                      })
                    }
                  />
                </td>
                <td className="py-3 px-2 text-center">
                  <ClickableCount
                    value={counts.courier}
                    onClick={() =>
                      openDrillDown({
                        scope: "periodStatus",
                        status: row.key,
                        category: "courier",
                        title: `${row.label} — courses (${periodLabel})`,
                      })
                    }
                  />
                </td>
                <td className="py-3 pl-2 text-center font-medium">
                  <ClickableCount
                    value={counts.total}
                    onClick={() =>
                      openDrillDown({
                        scope: "periodStatus",
                        status: row.key,
                        title: `${row.label} — ${periodLabel}`,
                      })
                    }
                  />
                </td>
              </tr>
            );
          })}
          <tr className="border-t bg-muted/30 font-medium">
            <td className="py-3 pr-4">Total missions</td>
            <td className="py-3 px-2 text-center">
              <ClickableCount
                value={periodStats.total.standard}
                onClick={() =>
                  openDrillDown({
                    scope: "period",
                    key: "standard",
                    title: `Commandes — ${periodLabel}`,
                  })
                }
              />
            </td>
            <td className="py-3 px-2 text-center">
              <ClickableCount
                value={periodStats.total.courier}
                onClick={() =>
                  openDrillDown({
                    scope: "period",
                    key: "courier",
                    title: `Courses — ${periodLabel}`,
                  })
                }
              />
            </td>
            <td className="py-3 pl-2 text-center">
              <ClickableCount
                value={periodStats.total.total}
                onClick={() =>
                  openDrillDown({
                    scope: "period",
                    key: "all",
                    title: `Total missions — ${periodLabel}`,
                  })
                }
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div className="space-y-2 md:hidden">
      {STATUS_ROWS.map((row) => {
        const counts = periodStats.byStatus[row.key];
        return (
          <div key={row.key} className="rounded-xl border border-border p-3">
            <p className="font-medium">{row.label}</p>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Cmd</p>
                <ClickableCount
                  value={counts.standard}
                  onClick={() =>
                    openDrillDown({
                      scope: "periodStatus",
                      status: row.key,
                      category: "standard",
                      title: `${row.label} — commandes (${periodLabel})`,
                    })
                  }
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Course</p>
                <ClickableCount
                  value={counts.courier}
                  onClick={() =>
                    openDrillDown({
                      scope: "periodStatus",
                      status: row.key,
                      category: "courier",
                      title: `${row.label} — courses (${periodLabel})`,
                    })
                  }
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <ClickableCount
                  value={counts.total}
                  onClick={() =>
                    openDrillDown({
                      scope: "periodStatus",
                      status: row.key,
                      title: `${row.label} — ${periodLabel}`,
                    })
                  }
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

function dashboardItemTimestamp(item: DashboardDeliveryItem) {
  const raw = item.scheduledAt ?? item.requestedDeliveryDate;
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMissionDate(item: DashboardDeliveryItem) {
  const raw = item.scheduledAt ?? item.requestedDeliveryDate;
  if (!raw) return "Non planifiée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(raw));
}

function ActiveDriversPanel() {
  const access = useOfferAccess();
  const hasAdminGps = useHasOfferFeature("admin_gps");
  const { data: drivers, isError, isLoading } = useDriverLiveLocations(hasAdminGps);
  const onlineDrivers = (drivers ?? []).filter((driver) => driver.isOnline);

  return (
    <section className="rounded-2xl border border-black/[0.065] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#0e1310]">
          Livreurs actifs
        </h2>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e4f9ec] px-3 py-1.5 text-xs font-semibold text-[#08783f]">
          <span className="h-2 w-2 rounded-full bg-[#00d46a] shadow-[0_0_0_4px_rgba(0,212,106,0.15)]" />
          {hasAdminGps ? (isLoading ? "Chargement…" : `${onlineDrivers.length} en ligne`) : "Indisponible"}
        </span>
      </div>

      {!hasAdminGps ? (
        <p className="mt-6 rounded-xl bg-[#f5f6f4] p-4 text-sm leading-6 text-[#68726b]">
          {lockedOfferReason("admin_gps", access?.planCode)}
        </p>
      ) : isLoading ? (
        <div role="status" className="mt-6 space-y-3" aria-label="Chargement des livreurs actifs">
          <div className="h-11 animate-pulse rounded-xl bg-[#f0f3f0]" />
          <div className="h-11 animate-pulse rounded-xl bg-[#f0f3f0]" />
        </div>
      ) : isError ? (
        <p role="alert" className="mt-6 text-sm text-[#a12c2c]">
          Les positions des livreurs sont indisponibles.
        </p>
      ) : onlineDrivers.length === 0 ? (
        <p className="mt-6 rounded-xl bg-[#f5f6f4] p-4 text-sm text-[#68726b]">
          Aucun livreur connecté pour le moment.
        </p>
      ) : (
        <ul className="mt-5 space-y-2" aria-label="Livreurs actuellement connectés">
          {onlineDrivers.slice(0, 4).map((driver) => {
            const initials = driver.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("");
            return (
              <li key={driver.id} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0e1310] text-[11px] font-semibold text-white">
                  {initials || "L"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[#0e1310]">{driver.name}</span>
                  <span className="mt-0.5 block text-xs text-[#5f6962]">
                    {driver.activeMissions} mission{driver.activeMissions > 1 ? "s" : ""} active{driver.activeMissions > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#00d46a]" aria-label="En ligne" />
              </li>
            );
          })}
        </ul>
      )}

      <Button
        variant="ghost"
        className="mt-4 h-11 w-full justify-between rounded-xl bg-[#f3f5f2] px-4 text-sm font-semibold text-[#0e1310] hover:bg-[#e9ede9]"
        asChild
      >
        <Link href="/dispatch/drivers">
          Voir la carte des livreurs
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  );
}

function RecentMissionsPanel() {
  const { dashboard, period } = useDashboardContext();
  const items = [...dashboard.lists.periods[period].all]
    .sort((a, b) => dashboardItemTimestamp(b) - dashboardItemTimestamp(a))
    .slice(0, 5);

  return (
    <section className="overflow-hidden rounded-2xl border border-black/[0.065] bg-white lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#0e1310]">
            Missions planifiées les plus récentes
          </h2>
          <p className="mt-1 text-sm text-[#5f6962]">{DASHBOARD_PERIOD_LABELS[period]}</p>
        </div>
        <Link
          href="/dashboard/orders"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#0e1310] transition-colors hover:bg-[#f3f5f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d46a]"
        >
          Toutes les commandes
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="border-t border-black/[0.055] px-6 py-10 text-center text-sm text-[#68726b]">
          Aucune mission sur cette période.
        </div>
      ) : (
        <>
          <div className="space-y-3 border-t border-black/[0.055] p-4 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-xl border border-black/[0.065] bg-[#fafbf9] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={buildDispatchTargetHref(item.id, false)}
                      className="inline-flex min-h-11 items-center font-semibold text-[#0e1310] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d46a]"
                    >
                      {item.reference}
                    </Link>
                    <span className="block text-xs text-[#5f6962]">{item.orderReference}</span>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#f0f3f0] px-2.5 py-1 text-xs font-semibold text-[#4f5c54]">
                    {getCompactStatusLabel(item.status, item.deliveryCategory)}
                  </span>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-black/[0.055] pt-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-[#5f6962]">Client</dt>
                    <dd className="mt-1 font-medium text-[#0e1310]">{item.customerName ?? "Client"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5f6962]">Livreur</dt>
                    <dd className="mt-1 font-medium text-[#0e1310]">{item.driverName ?? "Non assigné"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#5f6962]">Planification</dt>
                    <dd className="mt-1 font-medium text-[#0e1310]">{formatMissionDate(item)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden border-t border-black/[0.055] md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f7f8f6] text-[11px] uppercase tracking-[0.12em] text-[#5f6962]">
                <tr>
                  <th className="px-6 py-3 font-semibold">Mission</th>
                  <th className="px-4 py-3 font-semibold">Client</th>
                  <th className="px-4 py-3 font-semibold">Livreur</th>
                  <th className="px-4 py-3 font-semibold">Planification</th>
                  <th className="px-6 py-3 text-right font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-black/[0.055] transition-colors hover:bg-[#fafbf9]">
                    <td className="px-6 py-4">
                      <Link
                        href={buildDispatchTargetHref(item.id, false)}
                        className="font-semibold text-[#0e1310] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d46a]"
                      >
                        {item.reference}
                      </Link>
                      <span className="mt-1 block text-xs text-[#5f6962]">{item.orderReference}</span>
                    </td>
                    <td className="px-4 py-4 text-[#4f5c54]">{item.customerName ?? "Client"}</td>
                    <td className="px-4 py-4 text-[#4f5c54]">{item.driverName ?? "Non assigné"}</td>
                    <td className="px-4 py-4 text-[#4f5c54]">{formatMissionDate(item)}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex rounded-full bg-[#f0f3f0] px-2.5 py-1 text-xs font-semibold text-[#4f5c54]">
                        {getCompactStatusLabel(item.status, item.deliveryCategory)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function PlanningWidget() {
  const { dashboard, openDrillDown, period } = useDashboardContext();
  const periodStats = dashboard.periods[period];
  const periodLabel = DASHBOARD_PERIOD_LABELS[period];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
      <MapDeliveriesWidget height={352} />
      <ActiveDriversPanel />
      <RecentMissionsPanel />

      {(dashboard.alerts.unassigned > 0 || dashboard.alerts.assignedNotStarted > 0 || periodStats.late.total > 0) && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[#eadfc0] bg-[#fffaf0] px-4 py-3 text-sm text-[#614f22] lg:col-span-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[#9b7417]" aria-hidden />
          <span className="mr-auto font-medium">Points d&apos;attention</span>
          {dashboard.alerts.unassigned > 0 && (
            <button
              type="button"
              onClick={() => openDrillDown({ scope: "alert", key: "unassigned", title: "Missions sans livreur" })}
              className="min-h-11 rounded-xl bg-white px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#fffdf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7417]"
            >
              {dashboard.alerts.unassigned} sans livreur
            </button>
          )}
          {dashboard.alerts.assignedNotStarted > 0 && (
            <button
              type="button"
              onClick={() => openDrillDown({ scope: "alert", key: "assignedNotStarted", title: "Missions assignées non démarrées" })}
              className="min-h-11 rounded-xl bg-white px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#fffdf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7417]"
            >
              {dashboard.alerts.assignedNotStarted} à démarrer
            </button>
          )}
          {periodStats.late.total > 0 && (
            <button
              type="button"
              onClick={() =>
                openDrillDown({
                  scope: "period",
                  key: "late",
                  title: `Missions en retard — ${periodLabel}`,
                  description: "Date demandée par le client dépassée",
                })
              }
              className="min-h-11 rounded-xl bg-white px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#fffdf8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9b7417]"
            >
              {periodStats.late.total} en retard
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function PlanningCategoriesWidget() {
  const { period } = useDashboardContext();
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base">Catégories — {DASHBOARD_PERIOD_LABELS[period]}</CardTitle>
          <CardDescription>Commandes, courses et total sur la période</CardDescription>
        </div>
        <PeriodToggle />
      </CardHeader>
      <CardContent>
        <PlanningCategoriesSection widgetPeriod={period} />
      </CardContent>
    </Card>
  );
}

function PlanningStatusTableWidget() {
  const { period } = useDashboardContext();
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base">Statuts — {DASHBOARD_PERIOD_LABELS[period]}</CardTitle>
          <CardDescription>Ventilation commandes / courses par statut</CardDescription>
        </div>
        <PeriodToggle />
      </CardHeader>
      <CardContent>
        <PlanningStatusTableSection widgetPeriod={period} />
      </CardContent>
    </Card>
  );
}

function PeriodStatWidget({
  widget,
}: {
  widget: DashboardWidgetLayout;
}) {
  const { dashboard, openDrillDown } = useDashboardContext();
  const period = useWidgetPeriod(widget.config?.period);
  const periodStats = dashboard.periods[period];
  const periodLabel = DASHBOARD_PERIOD_LABELS[period];

  const configs: Record<
    Extract<
      DashboardWidgetType,
      | "stat-period-standard"
      | "stat-period-courier"
      | "stat-period-total"
      | "stat-period-late"
    >,
    { label: string; value: number; icon: typeof Package; drillDown: Parameters<typeof openDrillDown>[0] }
  > = {
    "stat-period-standard": {
      label: `Commandes (${periodLabel})`,
      value: periodStats.total.standard,
      icon: Package,
      drillDown: { scope: "period", key: "standard", title: `Commandes — ${periodLabel}` },
    },
    "stat-period-courier": {
      label: `Courses (${periodLabel})`,
      value: periodStats.total.courier,
      icon: Bike,
      drillDown: { scope: "period", key: "courier", title: `Courses — ${periodLabel}` },
    },
    "stat-period-total": {
      label: `Total missions (${periodLabel})`,
      value: periodStats.total.total,
      icon: Truck,
      drillDown: { scope: "period", key: "all", title: `Total missions — ${periodLabel}` },
    },
    "stat-period-late": {
      label: `Retards (${periodLabel})`,
      value: periodStats.late.total,
      icon: AlertTriangle,
      drillDown: {
        scope: "period",
        key: "late",
        title: `Missions en retard — ${periodLabel}`,
        description: "Date demandée par le client dépassée",
      },
    },
  };

  const config = configs[widget.type as keyof typeof configs];
  if (!config) return null;

  return (
    <ItemCard
      label={config.label}
      value={config.value}
      icon={config.icon}
      onClick={() => openDrillDown(config.drillDown)}
      destructive={widget.type === "stat-period-late" && config.value > 0}
    />
  );
}

function StatusStatWidget({ widget }: { widget: DashboardWidgetLayout }) {
  const { dashboard, openDrillDown } = useDashboardContext();
  const period = useWidgetPeriod(widget.config?.period);
  const periodStats = dashboard.periods[period];
  const periodLabel = DASHBOARD_PERIOD_LABELS[period];
  const statusKey = STATUS_WIDGET_MAP[widget.type as keyof typeof STATUS_WIDGET_MAP];
  if (!statusKey) return null;

  const row = STATUS_ROWS.find((r) => r.key === statusKey)!;
  const counts = periodStats.byStatus[statusKey];

  return (
    <ItemCard
      label={`${row.label} (${periodLabel})`}
      value={counts.total}
      icon={Package}
      onClick={() =>
        openDrillDown({
          scope: "periodStatus",
          status: statusKey,
          title: `${row.label} — ${periodLabel}`,
        })
      }
    />
  );
}

function DriversOnlineWidget() {
  const hasAdminGps = useHasOfferFeature("admin_gps");
  const { data: drivers } = useDriverLiveLocations(hasAdminGps);
  const onlineCount = (drivers ?? []).filter((d) => d.isOnline).length;

  return (
    <StatCard
      label="Livreurs connectés"
      value={onlineCount}
      icon={Users}
      changeLabel="En direct"
    />
  );
}

function MapDriversWidget({ height = 280 }: { height?: number }) {
  const access = useOfferAccess();
  const hasAdminGps = useHasOfferFeature("admin_gps");
  if (!hasAdminGps) {
    return (
      <section className="rounded-2xl border border-black/[0.065] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#0e1310]">Livreurs en direct</h2>
        <p className="mt-1 text-sm text-[#68726b]">{lockedOfferReason("admin_gps", access?.planCode)}</p>
          <div className="mt-5 flex h-[180px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-[#f6f8f5] text-sm text-[#68726b]">
            Carte GPS indisponible dans cette offre
          </div>
      </section>
    );
  }
  return (
    <section className="rounded-2xl border border-black/[0.065] bg-white p-5 sm:p-6">
      <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#0e1310]">Livreurs en direct</h2>
          <p className="mt-1 text-sm text-[#68726b]">Positions limitées au service actif</p>
        </div>
        <Button variant="ghost" size="sm" className="min-h-11 rounded-xl bg-[#f3f5f2] text-[#0e1310] hover:bg-[#e9ede9]" asChild>
          <Link href="/dispatch/drivers">
            <MapPin className="mr-2 h-4 w-4" />
            Carte complète
          </Link>
        </Button>
      </div>
        <DriversMapWidget height={height} />
    </section>
  );
}

function MapDeliveriesWidget({ height = 280 }: { height?: number }) {
  const access = useOfferAccess();
  const hasAdminGps = useHasOfferFeature("admin_gps");
  if (!hasAdminGps) {
    return (
      <section className="rounded-2xl border border-black/[0.065] bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#0e1310]">Missions actives</h2>
        <p className="mt-1 text-sm text-[#68726b]">{lockedOfferReason("admin_gps", access?.planCode)}</p>
          <div className="mt-5 flex h-[180px] items-center justify-center rounded-xl border border-dashed border-black/10 bg-[#f6f8f5] text-sm text-[#68726b]">
            Carte GPS indisponible dans cette offre
          </div>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-black/[0.065] bg-white p-5 sm:p-6">
      <div className="mb-5 flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.035em] text-[#0e1310]">Missions actives</h2>
          <p className="mt-1 text-sm text-[#68726b]">Destinations et points actifs sur la carte</p>
        </div>
        <Button variant="ghost" size="sm" className="min-h-11 rounded-xl bg-[#f3f5f2] text-[#0e1310] hover:bg-[#e9ede9]" asChild>
          <Link href="/dispatch/map">
            <Radio className="mr-2 h-4 w-4" />
            Dispatch
          </Link>
        </Button>
      </div>
        <DeliveriesMapWidget height={height} />
    </section>
  );
}

function ItemCard({
  label,
  value,
  icon,
  onClick,
  destructive,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  onClick?: () => void;
  destructive?: boolean;
}) {
  return (
    <StatCard
      label={label}
      value={value}
      icon={icon}
      className={destructive ? "border-destructive/40" : undefined}
      onClick={onClick}
    />
  );
}

function DashboardWidget({ widget }: { widget: DashboardWidgetLayout }) {
  const mapHeight = widget.config?.mapHeight ?? 280;

  switch (widget.type) {
    case "alerts-row":
      return <AlertsRowWidget />;
    case "alert-late":
      return <AlertLateWidget />;
    case "alert-unassigned":
      return <AlertUnassignedWidget />;
    case "alert-assigned-not-started":
      return <AlertAssignedNotStartedWidget />;
    case "alert-in-progress":
      return <AlertInProgressWidget />;
    case "today-summary":
      return <TodaySummaryWidget />;
    case "today-delivered":
      return <TodayDeliveredWidget />;
    case "today-in-progress":
      return <TodayInProgressWidget />;
    case "today-remaining":
      return <TodayRemainingWidget />;
    case "today-late":
      return <TodayLateWidget />;
    case "planning":
      return <PlanningWidget />;
    case "planning-categories":
      return <PlanningCategoriesWidget />;
    case "planning-status-table":
      return <PlanningStatusTableWidget />;
    case "stat-period-standard":
    case "stat-period-courier":
    case "stat-period-total":
    case "stat-period-late":
      return <PeriodStatWidget widget={widget} />;
    case "stat-status-pending":
    case "stat-status-assigned":
    case "stat-status-purchasing":
    case "stat-status-in-delivery":
    case "stat-status-delivered":
      return <StatusStatWidget widget={widget} />;
    case "stat-drivers-online":
      return <DriversOnlineWidget />;
    case "map-drivers":
      return <MapDriversWidget height={mapHeight} />;
    case "map-deliveries":
      return <MapDeliveriesWidget height={mapHeight} />;
    default:
      return null;
  }
}

export function DashboardWidgetRenderer({ widget }: { widget: DashboardWidgetLayout }) {
  return <DashboardWidget widget={widget} />;
}

export function DashboardCompactGrid({ widgets }: { widgets: DashboardWidgetLayout[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {widgets.map((widget) => (
        <DashboardWidget key={widget.type} widget={widget} />
      ))}
    </div>
  );
}
