import { z } from "zod";
import { DASHBOARD_WIDGET_TYPES } from "@/lib/dashboard/dashboard-layout";

const dashboardPeriodSchema = z.enum(["3d", "7d", "30d"]);

const dashboardWidgetConfigSchema = z
  .object({
    period: dashboardPeriodSchema.optional(),
    mapHeight: z.number().int().min(200).max(600).optional(),
  })
  .optional();

const dashboardWidgetLayoutSchema = z.object({
  type: z.enum(DASHBOARD_WIDGET_TYPES),
  visible: z.boolean(),
  order: z.number().int().min(0),
  config: dashboardWidgetConfigSchema,
});

export const dashboardLayoutSchema = z.object({
  defaultPeriod: dashboardPeriodSchema,
  widgets: z.array(dashboardWidgetLayoutSchema),
});

export type DashboardLayoutInput = z.infer<typeof dashboardLayoutSchema>;
