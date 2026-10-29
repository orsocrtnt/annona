"use client";

import {
  AlertTriangle,
  Bike,
  Package,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, type StatDelta } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "@/components/ui/tone";
import { DASHBOARD_PERIOD_LABELS } from "@/lib/dashboard/period-stats";
import type { DashboardWidgetLayout, DashboardWidgetType } from "@/lib/dashboard/dashboard-layout";
import type { CompanyDashboardStats } from "@/lib/dashboard/dashboard-types";
import { useDashboardContext, useWidgetPeriod } from "@/features/back-office/dashboard-context";
import {
  PERIOD_OPTIONS,
  STATUS_ROWS,
  STATUS_WIDGET_MAP,
} from "@/features/back-office/dashboard-drill-down";
import {
  CategoryCard,
  ClickableCount,
  HourlyBars,
  TodayDonut,
  TodayMetric,
} from "@/features/back-office/dashboard-shared";
import { useDriverLiveLocations } from "@/features/back-office/dispatch-map-hooks";
import { DashboardMapPanel } from "@/features/back-office/dashboard-map-panel";
import type { DashboardMapView } from "@/features/back-office/dashboard-map-model";
import { lockedOfferReason } from "@/domains/saas/saas-access";
import { useHasOfferFeature, useOfferAccess } from "@/features/saas/use-offer-access";

/** Écart des retards avec hier à la même heure, sur la même définition reconstituée. */
function lateDelta(dashboard: CompanyDashboardStats): StatDelta {
  return {
    value: dashboard.trends.lateNow - dashboard.trends.lateYesterdaySameTime,
    label: "vs hier même heure",
    goodWhen: "down",
  };
}

function PeriodToggle() {
  const { period, setPeriod } = useDashboardContext();

  return (
    <div className="inline-flex w-fit self-start rounded-xl bg-muted p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={period === option.key}
          onClick={() => setPeriod(option.key)}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "rounded-lg",
            period === option.key
              ? "bg-card text-foreground shadow-sm hover:bg-card"
              : "text-muted-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AlertsRowWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="En retard"
        value={dashboard.alerts.late}
        icon={AlertTriangle}
        tone="critical"
        delta={lateDelta(dashboard)}
        onClick={() =>
          openDrillDown({
            scope: "alert",
            key: "late",
            title: "Missions en retard",
            description: "Date demandée par le client dépassée",
          })
        }
      />
      <StatCard
        label="Sans livreur"
        tone="warning"
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
      <StatCard
        label="Assignées non démarrées"
        tone="info"
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
      <StatCard
        label="En cours de route"
        tone="success"
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
    </div>
  );
}

function AlertLateWidget() {
  const { dashboard, openDrillDown } = useDashboardContext();
  return (
    <StatCard
      label="En retard"
      value={dashboard.alerts.late}
      icon={AlertTriangle}
      tone="critical"
      delta={lateDelta(dashboard)}
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
      tone="warning"
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
      tone="info"
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
      tone="success"
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
  const { dashboard, openDrillDown } = useDashboardContext();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aujourd&apos;hui</CardTitle>
        <CardDescription>Résumé des missions du jour — cliquez pour voir le détail</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TodayMetric
            label="Livrées"
            tone="success"
            delta={{
              value: dashboard.trends.deliveredToday - dashboard.trends.deliveredYesterdaySameTime,
              label: "vs hier même heure",
              goodWhen: "up",
            }}
            counts={dashboard.today.delivered}
            onClick={() =>
              openDrillDown({
                scope: "today",
                key: "delivered",
                title: "Missions livrées aujourd'hui",
              })
            }
          />
          <TodayMetric
            label="En cours"
            tone="info"
            counts={dashboard.today.inProgress}
            onClick={() =>
              openDrillDown({
                scope: "today",
                key: "inProgress",
                title: "Missions en cours aujourd'hui",
              })
            }
          />
          <TodayMetric
            label="Restantes"
            counts={dashboard.today.remaining}
            onClick={() =>
              openDrillDown({
                scope: "today",
                key: "remaining",
                title: "Missions restantes aujourd'hui",
              })
            }
          />
          <TodayMetric
            label="En retard"
            tone="critical"
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
        </div>
        <TodayDonut
          segments={[
            { label: "Livrées", value: dashboard.today.delivered.total, tone: "ink" },
            { label: "En cours", value: dashboard.today.inProgress.total, tone: "mid" },
            { label: "Restantes", value: dashboard.today.remaining.total, tone: "soft" },
          ]}
        />
        <div className="xl:col-span-2">
          <HourlyBars values={dashboard.trends.deliveredByHour} />
        </div>
      </CardContent>
    </Card>
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
        accentClass={TONE_CLASSES.warning.surface}
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
        accentClass={TONE_CLASSES.info.surface}
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
        accentClass={TONE_CLASSES.neutral.surface}
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

function PlanningWidget() {
  const { dashboard, openDrillDown, period } = useDashboardContext();
  const periodStats = dashboard.periods[period];
  const periodLabel = DASHBOARD_PERIOD_LABELS[period];

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle className="text-base">Planning des missions</CardTitle>
          <CardDescription>
            Commandes, courses et statuts sur la période sélectionnée — cliquez sur un chiffre
          </CardDescription>
        </div>
        <PeriodToggle />
      </CardHeader>
      <CardContent className="space-y-6">
        <PlanningCategoriesSection widgetPeriod={period} />

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
            className="flex w-full items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm transition-colors hover:bg-destructive/10"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span>
              <strong>{periodStats.late.total}</strong> mission
              {periodStats.late.total > 1 ? "s" : ""} en retard sur cette période
              <span className="ml-2 text-brand">Voir le détail →</span>
            </span>
          </button>
        )}

        <PlanningStatusTableSection widgetPeriod={period} />
      </CardContent>
    </Card>
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

/** Carte unifiée du tableau de bord : une seule zone, bascule Livreurs / Livraisons (MAP-INTERACTION). */
function UnifiedMapWidget({ height = 280, initialView }: { height?: number; initialView: DashboardMapView }) {
  const access = useOfferAccess();
  const hasAdminGps = useHasOfferFeature("admin_gps");
  if (!hasAdminGps) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Carte en direct</CardTitle>
          <CardDescription>{lockedOfferReason("admin_gps", access?.planCode)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
            Carte GPS indisponible dans cette offre
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Carte en direct</CardTitle>
        <CardDescription>Livreurs et livraisons : choisissez la vue, sélectionnez un repère pour ses détails</CardDescription>
      </CardHeader>
      <CardContent>
        <DashboardMapPanel height={height} initialView={initialView} />
      </CardContent>
    </Card>
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
      return <UnifiedMapWidget height={mapHeight} initialView="drivers" />;
    case "map-deliveries":
      return <UnifiedMapWidget height={mapHeight} initialView="deliveries" />;
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
