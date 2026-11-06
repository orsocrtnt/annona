import type { QueryClient } from "@tanstack/react-query";
import { portalApi } from "@/features/client-portal/api";
import { backOfficeApi } from "@/features/back-office/api";
import { billingSettingsApi } from "@/features/back-office/billing-settings-api";
import { fetchAdminOverview } from "@/features/admin/api";
import { QUERY_STALE_MS } from "@/lib/query/defaults";

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

/** Données préchargées au survol d'un lien du menu (mêmes clés que les écrans). */
const ROUTE_PREFETCH: Record<string, RoutePrefetch> = {
  "/portal/support": {
    queryKey: ["portal", "support"],
    queryFn: portalApi.getSupportTickets,
  },
  "/portal/settings": {
    queryKey: ["portal", "settings"],
    queryFn: portalApi.getSettings,
  },
  "/support": {
    queryKey: ["company", "support"],
    queryFn: backOfficeApi.getSupportTickets,
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
  "/settings/billing": {
    queryKey: ["company", "settings", "billing"],
    queryFn: billingSettingsApi.get,
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
