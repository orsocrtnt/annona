"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { StatCard } from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useDispatchOverview } from "@/features/back-office/hooks";
import {
  useOperationJobHealth,
  useRetryFailedOperationJobs,
  useRunAutoDispatch,
} from "@/features/back-office/dispatch-settings-hooks";
import { DispatchDriverWorkload } from "@/features/back-office/dispatch-driver-workload";
import { DispatchSettingsForm } from "@/features/back-office/dispatch-settings-form";
import { dispatchSearchText, getDispatchColumns } from "@/features/back-office/dispatch-columns";
import { MapPin, Radio, RefreshCw, Settings2, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DeliveryCategory } from "@prisma/client";
import type { TableColumn } from "@/types";
import type { CompanyDelivery } from "@/features/back-office/types";
import { resolveDispatchFocus } from "@/features/back-office/dispatch-focus";
import { lockedOfferReason } from "@/domains/saas/saas-access";
import { useHasOfferFeature, useOfferAccess } from "@/features/saas/use-offer-access";
import { canSeeDispatchRules } from "@/features/back-office/dispatch-access";
import { usePermissions } from "@/hooks/use-permissions";

type DispatchView = "queue" | "rules";
type CategoryFilter = "ALL" | DeliveryCategory;

const columns = getDispatchColumns();

export default function DispatcherDashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DispatcherDashboardContent />
    </Suspense>
  );
}

function DispatcherDashboardContent() {
  const searchParams = useSearchParams();
  const requestedDeliveryId = searchParams.get("delivery")?.trim() || null;
  const [view, setView] = useState<DispatchView>("queue");
  const { role, permissions } = usePermissions();
  const showRules = canSeeDispatchRules(role, permissions);
  const activeView = showRules && view === "rules" ? "rules" : "queue";
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const { data: overview, isLoading, error } = useDispatchOverview(requestedDeliveryId);
  const deliveries = overview?.deliveries;
  const stats = overview?.stats;
  const dispatchSettings = overview?.settings;
  const runAutoDispatch = useRunAutoDispatch();
  const offerAccess = useOfferAccess();
  const hasAdminGps = useHasOfferFeature("admin_gps");
  const hasAutoDispatch = useHasOfferFeature("auto_dispatch");
  const { data: operationHealth } = useOperationJobHealth();
  const retryFailedJobs = useRetryFailedOperationJobs();
  const dispatchFocus = useMemo(
    () => resolveDispatchFocus(searchParams, deliveries ?? []),
    [deliveries, searchParams]
  );
  const focusedDelivery =
    dispatchFocus.state === "ready"
      ? (deliveries ?? []).find((delivery) => delivery.id === dispatchFocus.delivery.id) ?? null
      : null;
  const focusedDeliveryId = focusedDelivery?.id ?? null;

  useEffect(() => {
    if (!focusedDeliveryId) return;
    setView("queue");
    setCategoryFilter("ALL");
  }, [focusedDeliveryId]);

  const queue = useMemo(() => {
    const base = (deliveries ?? []).filter(
      (d) => !["DELIVERED", "CANCELLED", "PAID", "INVOICED", "FAILED"].includes(d.status)
    );
    if (categoryFilter === "ALL") return base;
    return base.filter(
      (d) => (d.deliveryCategory ?? d.order.deliveryCategory) === categoryFilter
    );
  }, [deliveries, categoryFilter]);

  const pendingUnassigned = useMemo(
    () =>
      queue.filter((d) => d.status === "PENDING" && !d.driverId).length,
    [queue]
  );

  const handleAutoDispatch = async () => {
    try {
      const result = await runAutoDispatch.mutateAsync();
      if (result.message) {
        toast.info(result.message);
        return;
      }
      if (result.assigned === 0) {
        toast.info("Aucune livraison assignée", {
          description:
            result.skipped > 0
              ? `${result.skipped} livraison(s) ignorée(s) — vérifiez les profils chauffeurs.`
              : "La file d'attente est vide.",
        });
      } else {
        toast.success(`${result.assigned} livraison(s) assignée(s) automatiquement`, {
          description:
            result.skipped > 0 ? `${result.skipped} non assignée(s)` : undefined,
        });
      }
    } catch (err) {
      toast.error("Auto-dispatch impossible", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleRetryFailedJobs = async () => {
    try {
      const result = await retryFailedJobs.mutateAsync();
      toast.success(`${result.retried} traitement(s) relancé(s)`);
    } catch (err) {
      toast.error("Relance impossible", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  if (isInitialQueryLoading(isLoading, overview)) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centre de dispatch</h1>
          <p className="mt-1 text-muted-foreground">
            Assignez les missions aux livreurs selon leurs profils
            {dispatchSettings?.enabled ? " — auto-dispatch actif" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={
              focusedDelivery
                ? `/dispatch/map?delivery=${encodeURIComponent(focusedDelivery.id)}${
                    dispatchFocus.state === "ready" && dispatchFocus.reason === "late"
                      ? "&focus=late"
                      : ""
                  }`
                : "/dispatch/map"
            }
            title={hasAdminGps ? undefined : lockedOfferReason("admin_gps", offerAccess?.planCode)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              !hasAdminGps && "opacity-50"
            )}
          >
            <MapPin className="h-4 w-4" />
            Carte livraison
          </Link>
          <Link
            href="/dispatch/drivers"
            title={hasAdminGps ? undefined : lockedOfferReason("admin_gps", offerAccess?.planCode)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              !hasAdminGps && "opacity-50"
            )}
          >
            <Truck className="h-4 w-4" />
            Carte chauffeurs
          </Link>
          {view === "queue" && (
            <Button
              variant="brand"
              size="sm"
              loading={runAutoDispatch.isPending}
              disabled={!hasAutoDispatch || !dispatchSettings?.enabled || runAutoDispatch.isPending}
              title={hasAutoDispatch ? undefined : lockedOfferReason("auto_dispatch", offerAccess?.planCode)}
              onClick={handleAutoDispatch}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Lancer auto-dispatch
            </Button>
          )}
        </div>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
        <button
          type="button"
          onClick={() => setView("queue")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            activeView === "queue"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Radio className="h-4 w-4" />
          File d&apos;attente
        </button>
        {showRules ? (
          <button
            type="button"
            onClick={() => setView("rules")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              activeView === "rules"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings2 className="h-4 w-4" />
            Règles dispatch
          </button>
        ) : null}
      </div>

      {operationHealth &&
        (operationHealth.failed > 0 ||
          operationHealth.pending > 0 ||
          operationHealth.processing > 0) && (
          <Alert variant={operationHealth.failed > 0 ? "destructive" : "info"}>
            <AlertTitle>
              {operationHealth.failed > 0
                ? `${operationHealth.failed} traitement(s) automatique(s) en échec`
                : "Traitements automatiques en cours"}
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {operationHealth.pending} en attente, {operationHealth.processing} en cours.
                {operationHealth.failedJobs[0]?.lastError
                  ? ` Dernière erreur : ${operationHealth.failedJobs[0].lastError}`
                  : ""}
              </span>
              {operationHealth.failed > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={retryFailedJobs.isPending}
                  onClick={handleRetryFailedJobs}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Relancer
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

      {dispatchFocus.state === "ready" && focusedDelivery && (
        <Alert variant={dispatchFocus.reason === "late" ? "warning" : "info"}>
          <AlertTitle>
            {dispatchFocus.reason === "late"
              ? `Commande en retard ciblée — ${focusedDelivery.reference}`
              : `Livraison ciblée — ${focusedDelivery.reference}`}
          </AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              La ligne correspondante est affichée, surlignée et reçoit le focus clavier.
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/dispatch/map?delivery=${encodeURIComponent(focusedDelivery.id)}${
                  dispatchFocus.reason === "late" ? "&focus=late" : ""
                }`}
                title={hasAdminGps ? undefined : lockedOfferReason("admin_gps", offerAccess?.planCode)}
                className={cn(!hasAdminGps && "opacity-50")}
              >
                Voir sur la carte
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {dispatchFocus.state === "unavailable" && (
        <Alert variant="warning">
          <AlertTitle>Cible indisponible</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {dispatchFocus.reason === "late"
                ? "Cette livraison n’est plus en retard ou n’est pas accessible."
                : "Cette livraison n’est plus active ou n’est pas accessible."}
            </span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dispatch">Afficher toute la file</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {activeView === "rules" ? (
        <DispatchSettingsForm />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="En attente"
              value={stats?.unassigned ?? 0}
              icon={Radio}
              changeLabel="À assigner"
            />
            <StatCard
              label="En cours"
              value={stats?.activeDeliveries ?? 0}
              icon={Truck}
              changeLabel="Assignées + en route"
            />
            <StatCard
              label="Non assignées"
              value={pendingUnassigned}
              icon={Radio}
              changeLabel="En attente d'un chauffeur"
            />
            <StatCard
              label="Livrées aujourd'hui"
              value={stats?.deliveredToday ?? 0}
              icon={Truck}
              changeLabel="Terminées"
            />
          </div>

          <DispatchDriverWorkload
            drivers={overview?.workload}
            settings={dispatchSettings}
          />

          {error ? (
            <EmptyState
              icon={Truck}
              title="Impossible de charger les livraisons"
              description="Réessayez dans quelques instants."
            />
          ) : (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                <CardTitle className="text-base">File d&apos;attente</CardTitle>
                <div className="flex flex-wrap gap-2">
                  {(["ALL", "STANDARD", "COURIER"] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      size="sm"
                      variant={categoryFilter === filter ? "brand" : "outline"}
                      onClick={() => setCategoryFilter(filter)}
                    >
                      {filter === "ALL"
                        ? "Toutes"
                        : filter === "STANDARD"
                          ? "Commandes"
                          : "Courses"}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <DataGrid
                  data={queue as unknown as Record<string, unknown>[]}
                  columns={columns as unknown as TableColumn<Record<string, unknown>>[]}
                  searchText={(row) => dispatchSearchText(row as unknown as CompanyDelivery)}
                  searchPlaceholder="Client, adresse ou référence…"
                  pageSize={15}
                  emptyTitle="Aucune livraison en attente"
                  emptyDescription="Les nouvelles commandes clients apparaîtront ici."
                  getRowId={(row) => String(row.id)}
                  highlightedRowId={focusedDelivery?.id}
                  highlightedRowLabel={
                    focusedDelivery
                      ? `Livraison ciblée ${focusedDelivery.reference}`
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
