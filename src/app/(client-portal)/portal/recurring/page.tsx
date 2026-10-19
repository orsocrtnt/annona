"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import {
  recurringPickupStopsToRoute,
  resolveRecurringPickupStops,
} from "@/lib/order/recurring-pickups";
import {
  usePortalRecurringOrders,
  useCreateRecurringOrder,
  useUpdateRecurringOrder,
} from "@/features/client-portal/hooks";
import { CreateRecurringOrderForm } from "@/features/client-portal/create-recurring-order-form";
import { DELIVERY_CATEGORY_LABELS } from "@/lib/constants/delivery";
import { formatRecurrenceInterval } from "@/lib/constants/recurrence";
import { formatDate } from "@/lib/utils";
import { Plus, RefreshCw, Pause, Play, Package, Bike } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS = {
  ACTIVE: "Active",
  PAUSED: "En pause",
  CANCELLED: "Terminée",
} as const;

export default function RecurringOrdersPage() {
  const { data: recurring, isLoading, error, refetch } = usePortalRecurringOrders();
  const createRecurring = useCreateRecurringOrder();
  const updateRecurring = useUpdateRecurringOrder();
  const [showForm, setShowForm] = useState(false);

  const onSubmit = async (data: Parameters<typeof createRecurring.mutateAsync>[0]) => {
    try {
      await createRecurring.mutateAsync(data);
      setShowForm(false);
      toast.success("Commande récurrente créée");
    } catch (error) {
      toast.error("Erreur", {
        description: error instanceof Error ? error.message : "Création impossible",
      });
    }
  };

  const toggleStatus = async (id: string, status: "ACTIVE" | "PAUSED" | "CANCELLED") => {
    try {
      await updateRecurring.mutateAsync({ id, data: { status } });
      toast.success("Statut mis à jour");
    } catch {
      toast.error("Mise à jour impossible");
    }
  };

  if (isInitialQueryLoading(isLoading, recurring)) return <PageSkeleton />;

  if (error) {
    return (
      <EmptyState
        icon={RefreshCw}
        title="Récurrences indisponibles"
        description="Impossible de charger vos commandes récurrentes pour le moment."
        action={{ label: "Réessayer", onClick: () => void refetch() }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commandes récurrentes</h1>
          <p className="mt-1 text-muted-foreground">
            Planifiez des livraisons régulières — achats ou courses collecte → livraison
          </p>
        </div>
        <Button variant="brand" onClick={() => setShowForm(!showForm)} className="max-md:w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle récurrence
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurer une récurrence</CardTitle>
            <CardDescription>
              Choisissez le type de livraison, la fréquence et la période de validité
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateRecurringOrderForm
              onSubmit={onSubmit}
              loading={createRecurring.isPending}
            />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {recurring?.map((item) => {
          const isCourier = item.deliveryCategory === "COURIER";
          const CategoryIcon = isCourier ? Bike : Package;
          const courierPickups = recurringPickupStopsToRoute(resolveRecurringPickupStops(item));
          return (
            <Card key={item.id}>
              <CardContent className="space-y-4 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-brand" />
                      <p className="font-medium">{item.label}</p>
                      <Badge variant={item.status === "ACTIVE" ? "success" : "secondary"}>
                        {STATUS_LABELS[item.status]}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <CategoryIcon className="h-3 w-3" />
                        {DELIVERY_CATEGORY_LABELS[item.deliveryCategory ?? "STANDARD"]}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatRecurrenceInterval(
                        item.intervalValue ?? 1,
                        item.intervalUnit ?? "WEEKS"
                      )}
                      {" — "}Prochaine : {formatDate(item.nextRunAt, { timeZone: "UTC" })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Du {formatDate(item.startAt, { timeZone: "UTC" })}{" "}
                      {item.endAt
                        ? ` au ${formatDate(item.endAt, { timeZone: "UTC" })}`
                        : " (sans date de fin)"}
                    </p>
                    <DeliveryRouteDisplay
                      category={item.deliveryCategory ?? "STANDARD"}
                      pickups={courierPickups.length ? courierPickups : undefined}
                      pickup={
                        !courierPickups.length && item.pickupAddress
                          ? {
                              address: item.pickupAddress,
                              city: item.pickupCity,
                              postalCode: item.pickupPostalCode,
                              instructions: item.pickupInstructions,
                            }
                          : null
                      }
                      destination={{
                        address: item.shippingAddress,
                        city: item.shippingCity,
                        postalCode: item.shippingPostalCode,
                        instructions: item.deliveryInstructions,
                      }}
                      compact
                    />
                    {!isCourier && item.items.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {item.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {item.status === "ACTIVE" ? (
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(item.id, "PAUSED")}>
                        <Pause className="mr-1 h-3 w-3" /> Pause
                      </Button>
                    ) : item.status === "PAUSED" ? (
                      <Button variant="outline" size="sm" onClick={() => toggleStatus(item.id, "ACTIVE")}>
                        <Play className="mr-1 h-3 w-3" /> Reprendre
                      </Button>
                    ) : null}
                    {item.status !== "CANCELLED" && (
                      <Button variant="ghost" size="sm" onClick={() => toggleStatus(item.id, "CANCELLED")}>
                        Terminer
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {recurring?.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Aucune commande récurrente configurée.
          </p>
        )}
      </div>
    </div>
  );
}
