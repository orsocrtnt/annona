import type { QueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/client-portal/api";
import { backOfficeApi } from "@/features/back-office/api";
import { driverApi } from "@/features/driver/api";

const LIST_STALE_MS = 5 * 60 * 1000;

type RoutePrefetch = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
};

const ROUTE_PREFETCH: Record<string, RoutePrefetch> = {
  "/portal": {
    queryKey: ["portal", "dashboard"],
    queryFn: portalApi.getDashboard,
  },
  "/portal/orders": {
    queryKey: ["portal", "orders", "active"],
    queryFn: () => portalApi.getOrders(false),
  },
  "/portal/orders/history": {
    queryKey: ["portal", "orders", "history"],
    queryFn: () => portalApi.getOrders(true),
  },
  "/portal/recurring": {
    queryKey: ["portal", "recurring"],
    queryFn: portalApi.getRecurringOrders,
  },
  "/portal/deliveries": {
    queryKey: ["portal", "deliveries"],
    queryFn: portalApi.getDeliveries,
  },
  "/portal/invoices": {
    queryKey: ["portal", "invoices"],
    queryFn: portalApi.getInvoices,
  },
  "/portal/support": {
    queryKey: ["portal", "support"],
    queryFn: portalApi.getSupportTickets,
  },
  "/portal/settings": {
    queryKey: ["portal", "settings"],
    queryFn: portalApi.getSettings,
  },
  "/dashboard": {
    queryKey: ["company", "dashboard"],
    queryFn: backOfficeApi.getDashboard,
  },
  "/dashboard/orders": {
    queryKey: ["company", "orders"],
    queryFn: backOfficeApi.getOrders,
  },
  "/dashboard/clients": {
    queryKey: ["company", "clients"],
    queryFn: backOfficeApi.getClients,
  },
  "/dashboard/drivers": {
    queryKey: ["company", "drivers"],
    queryFn: backOfficeApi.getDrivers,
  },
  "/dispatch": {
    queryKey: ["company", "deliveries", "all"],
    queryFn: () => backOfficeApi.getDeliveries(false),
  },
  "/driver": {
    queryKey: ["driver", "missions"],
    queryFn: driverApi.getMissions,
  },
  "/driver/missions": {
    queryKey: ["driver", "missions"],
    queryFn: driverApi.getMissions,
  },
};

export function prefetchRouteQueries(queryClient: QueryClient, href: string) {
  const path = href.split("?")[0]?.split("#")[0] ?? href;
  const config = ROUTE_PREFETCH[path];
  if (!config) return;

  void queryClient.prefetchQuery({
    queryKey: config.queryKey,
    queryFn: config.queryFn,
    staleTime: LIST_STALE_MS,
  });
}
