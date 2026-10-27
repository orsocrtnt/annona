import type { QueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/client-portal/api";
import { backOfficeApi } from "@/features/back-office/api";
import { companySettingsApi } from "@/features/back-office/company-settings-api";
import { billingSettingsApi } from "@/features/back-office/billing-settings-api";
import { driverApi } from "@/features/driver/api";
import { fetchAdminOverview } from "@/features/admin/api";
import { QUERY_STALE_MS } from "@/lib/query/defaults";
import type { OrderHistoryQuery } from "@/lib/query/order-history";

const COMPANY_ORDERS_QUERY: OrderHistoryQuery = { page: 1, pageSize: 50 };
const ACTIVE_PORTAL_ORDERS_QUERY: OrderHistoryQuery = { page: 1, pageSize: 50, history: false };
const PORTAL_ORDER_HISTORY_QUERY: OrderHistoryQuery = { page: 1, pageSize: 50, history: true };

type RoutePrefetch = {
  queryKey: readonly unknown[];
  queryFn: () => Promise<unknown>;
};

async function fetchUsers() {
  const res = await fetch("/api/users");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data;
}

async function fetchDispatchMap() {
  const res = await fetch("/api/dispatch/map");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data;
}

async function fetchDriversLocations() {
  const res = await fetch("/api/dispatch/drivers-locations");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Erreur serveur");
  return json.data;
}

const ROUTE_PREFETCH: Record<string, RoutePrefetch> = {
  "/portal": {
    queryKey: ["portal", "dashboard"],
    queryFn: portalApi.getDashboard,
  },
  "/portal/orders": {
    queryKey: ["portal", "orders", ACTIVE_PORTAL_ORDERS_QUERY],
    queryFn: () => portalApi.getOrders(ACTIVE_PORTAL_ORDERS_QUERY),
  },
  "/portal/orders/history": {
    queryKey: ["portal", "orders", PORTAL_ORDER_HISTORY_QUERY],
    queryFn: () => portalApi.getOrders(PORTAL_ORDER_HISTORY_QUERY),
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
  "/dashboard/analytics": {
    queryKey: ["company", "analytics", 30],
    queryFn: () => backOfficeApi.getAnalytics(30),
  },
  "/dashboard/orders": {
    queryKey: ["company", "orders", COMPANY_ORDERS_QUERY],
    queryFn: () => backOfficeApi.getOrders(COMPANY_ORDERS_QUERY),
  },
  "/dashboard/clients": {
    queryKey: ["company", "clients"],
    queryFn: backOfficeApi.getClients,
  },
  "/dashboard/drivers": {
    queryKey: ["company", "drivers"],
    queryFn: backOfficeApi.getDrivers,
  },
  "/support": {
    queryKey: ["company", "support"],
    queryFn: backOfficeApi.getSupportTickets,
  },
  "/dispatch": {
    // Même clé que useDispatchOverview() ; appel explicite, sinon le contexte React Query
    // devient le paramètre « livraison » (« ?delivery=[object Object] »).
    queryKey: ["company", "dispatch", "overview", null],
    queryFn: () => backOfficeApi.getDispatchOverview(),
  },
  "/dispatch/map": {
    queryKey: ["company", "dispatch", "map"],
    queryFn: fetchDispatchMap,
  },
  "/dispatch/drivers": {
    queryKey: ["company", "dispatch", "drivers-locations"],
    queryFn: fetchDriversLocations,
  },
  "/admin": {
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminOverview,
  },
  "/companies": {
    queryKey: ["admin", "overview"],
    queryFn: fetchAdminOverview,
  },
  "/users": {
    queryKey: ["users"],
    queryFn: fetchUsers,
  },
  "/settings": {
    queryKey: ["company", "settings", "delivery-options"],
    queryFn: companySettingsApi.getDeliveryOptions,
  },
  "/settings/billing": {
    queryKey: ["company", "settings", "billing"],
    queryFn: billingSettingsApi.get,
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
    staleTime: QUERY_STALE_MS,
  });
}
