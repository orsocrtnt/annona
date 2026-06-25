import { z } from "zod";
import { PORTAL_DASHBOARD_WIDGET_TYPES } from "@/lib/dashboard/portal-dashboard-layout";

const portalDashboardWidgetLayoutSchema = z.object({
  type: z.enum(PORTAL_DASHBOARD_WIDGET_TYPES),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

export const portalDashboardLayoutSchema = z.object({
  widgets: z.array(portalDashboardWidgetLayoutSchema),
});

export type PortalDashboardLayoutInput = z.infer<typeof portalDashboardLayoutSchema>;
