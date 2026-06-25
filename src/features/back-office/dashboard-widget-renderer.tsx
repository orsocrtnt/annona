"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  Bike,
  MapPin,
  Package,
  Radio,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
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
    <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setPeriod(option.key)}
          className={cn(
            buttonVariants({ variant: period === option.key ? "default" : "ghost", size: "sm" }),
            "rounded-md"
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
  const { dashboard, openDrillDown } = useDashboardContext();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aujourd&apos;hui</CardTitle>
        <CardDescription>Résumé des missions du jour — cliquez pour voir le détail</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TodayMetric
            label="Livrées"
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
  const { data: drivers } = useDriverLiveLocations();
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
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">Livreurs en direct</CardTitle>
          <CardDescription>Positions GPS des livreurs connectés</CardDescription>
        </div>
        <Link href="/dispatch/drivers">
          <Button variant="outline" size="sm">
            <MapPin className="mr-2 h-4 w-4" />
            Carte complète
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <DriversMapWidget height={height} />
      </CardContent>
    </Card>
  );
}

function MapDeliveriesWidget({ height = 280 }: { height?: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">Missions actives</CardTitle>
          <CardDescription>Destinations et points sur la carte</CardDescription>
        </div>
        <Link href="/dispatch/map">
          <Button variant="outline" size="sm">
            <Radio className="mr-2 h-4 w-4" />
            Dispatch
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        <DeliveriesMapWidget height={height} />
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
