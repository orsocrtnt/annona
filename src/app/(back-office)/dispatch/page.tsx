"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataGrid } from "@/components/ui/data-grid";
import { StatCard } from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useDispatchOverview } from "@/features/back-office/hooks";
import { useRunAutoDispatch } from "@/features/back-office/dispatch-settings-hooks";
import { DispatchDriverWorkload } from "@/features/back-office/dispatch-driver-workload";
import { DispatchSettingsForm } from "@/features/back-office/dispatch-settings-form";
import { getDispatchColumns } from "@/features/back-office/dispatch-columns";
import { MapPin, Radio, Settings2, Sparkles, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DeliveryCategory } from "@prisma/client";
import type { TableColumn } from "@/types";

type DispatchView = "queue" | "rules";
type CategoryFilter = "ALL" | DeliveryCategory;

const columns = getDispatchColumns();

export default function DispatcherDashboardPage() {
  const [view, setView] = useState<DispatchView>("queue");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const { data: overview, isLoading, error } = useDispatchOverview();
  const deliveries = overview?.deliveries;
  const stats = overview?.stats;
  const dispatchSettings = overview?.settings;
  const runAutoDispatch = useRunAutoDispatch();

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
            href="/dispatch/map"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <MapPin className="h-4 w-4" />
            Carte livraison
          </Link>
          <Link
            href="/dispatch/drivers"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Truck className="h-4 w-4" />
            Carte chauffeurs
          </Link>
          {view === "queue" && (
            <Button
              variant="brand"
              size="sm"
              loading={runAutoDispatch.isPending}
              disabled={!dispatchSettings?.enabled || runAutoDispatch.isPending}
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
            view === "queue"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Radio className="h-4 w-4" />
          File d&apos;attente
        </button>
        <button
          type="button"
          onClick={() => setView("rules")}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
            view === "rules"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings2 className="h-4 w-4" />
          Règles dispatch
        </button>
      </div>

      {view === "rules" ? (
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
                  searchKey="reference"
                  searchPlaceholder="Rechercher une livraison..."
                  pageSize={15}
                  emptyTitle="Aucune livraison en attente"
                  emptyDescription="Les nouvelles commandes clients apparaîtront ici."
                />
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
