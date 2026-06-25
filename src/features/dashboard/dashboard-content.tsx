"use client";

import { StatCard } from "@/components/ui/stat-card";
import { ChartPlaceholder } from "@/components/ui/chart-placeholder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataGrid } from "@/components/ui/data-grid";
import type { DashboardStat, TableColumn } from "@/types";
import { mockActivity } from "./mock-data";

interface DashboardContentProps {
  title: string;
  description?: string;
  stats: DashboardStat[];
  showCharts?: boolean;
  showActivity?: boolean;
  showTable?: boolean;
  tableData?: Record<string, unknown>[];
  tableColumns?: TableColumn<Record<string, unknown>>[];
  tableTitle?: string;
}

const activityTypeBadge: Record<string, "brand" | "success" | "warning" | "error" | "secondary"> = {
  company: "brand",
  delivery: "success",
  user: "secondary",
  alert: "error",
  settings: "warning",
};

export function DashboardContent({
  title,
  description,
  stats,
  showCharts = true,
  showActivity = true,
  showTable = false,
  tableData,
  tableColumns,
  tableTitle,
}: DashboardContentProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-1 text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      {showCharts && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartPlaceholder title="Activité des livraisons" type="area" />
          <ChartPlaceholder title="Performance par zone" type="bar" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {showActivity && (
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Activité récente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.entity}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span>
                    <Badge variant={activityTypeBadge[item.type] ?? "secondary"} className="text-[10px]">
                      {item.type}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {showCharts && (
          <div className={showActivity ? "lg:col-span-2" : "lg:col-span-3"}>
            <ChartPlaceholder title="Répartition des statuts" type="pie" height={280} />
          </div>
        )}
      </div>

      {showTable && tableData && tableColumns && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{tableTitle ?? "Données"}</CardTitle>
          </CardHeader>
          <CardContent>
            <DataGrid data={tableData} columns={tableColumns} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
