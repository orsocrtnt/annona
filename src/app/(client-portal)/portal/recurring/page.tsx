"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { fullDateLabel, relativeDayLabel } from "@/lib/format/relative-day";
import { Plus, RefreshCw, Pause, Play, Package, Bike, CalendarClock } from "lucide-react";
import { toast } from "sonner";

type RecurringItem = NonNullable<ReturnType<typeof usePortalRecurringOrders>["data"]>[number];

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
  // « Terminer » est irréversible : la carte demande, la fenêtre confirme.
  const [finishTarget, setFinishTarget] = useState<RecurringItem | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const cancelFinishRef = useRef<HTMLButtonElement>(null);
  const finishReturnFocusRef = useRef<HTMLElement | null>(null);

  const requestFinish = (item: RecurringItem) => {
    finishReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFinishTarget(item);
    setFinishOpen(true);
  };

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
      return true;
    } catch {
      toast.error("Mise à jour impossible");
      return false;
    }
  };

  const confirmFinish = async () => {
    if (!finishTarget) return;
    if (await toggleStatus(finishTarget.id, "CANCELLED")) setFinishOpen(false);
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

  const current = recurring?.filter((item) => item.status !== "CANCELLED") ?? [];
  const finished = recurring?.filter((item) => item.status === "CANCELLED") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commandes récurrentes</h1>
          <p className="mt-1 text-muted-foreground">
            Planifiez des livraisons régulières — achats ou courses collecte → livraison
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => setShowForm(!showForm)}
          aria-expanded={showForm}
          aria-controls="recurring-form"
          className="max-md:w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nouvelle récurrence
        </Button>
      </div>

      {showForm && (
        <Card id="recurring-form">
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

      {current.length > 0 && (
        <ul className="space-y-3" aria-label="Récurrences en cours">
          {current.map((item) => (
            <li key={item.id}>
              <RecurringCard item={item} onStatusChange={toggleStatus} onRequestFinish={requestFinish} />
            </li>
          ))}
        </ul>
      )}

      {recurring?.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aucune commande récurrente configurée.
        </p>
      )}

      {finished.length > 0 && (
        <details className="group rounded-2xl border border-border bg-card">
          <summary className="cursor-pointer rounded-2xl px-5 py-4 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Récurrences terminées ({finished.length})
          </summary>
          <ul className="space-y-3 px-3 pb-3">
            {finished.map((item) => (
              <li key={item.id}>
                <RecurringCard item={item} onStatusChange={toggleStatus} onRequestFinish={requestFinish} />
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        {finishTarget && (
          <DialogContent
            onOpenAutoFocus={(event) => {
              // Action irréversible : le focus part sur « Annuler », pas sur la confirmation.
              event.preventDefault();
              cancelFinishRef.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              // Retour au bouton « Terminer » ; s'il a disparu (récurrence terminée), au contenu principal.
              event.preventDefault();
              const target = finishReturnFocusRef.current;
              (target?.isConnected ? target : document.getElementById("main-content"))?.focus();
            }}
          >
            <DialogHeader>
              <DialogTitle>Terminer « {finishTarget.label} » ?</DialogTitle>
              <DialogDescription>
                Cette action est irréversible : aucune nouvelle livraison ne sera créée pour cette
                récurrence et elle ne pourra pas être reprise. Les livraisons déjà créées sont conservées.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button ref={cancelFinishRef} variant="ghost" onClick={() => setFinishOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={() => void confirmFinish()} loading={updateRecurring.isPending}>
                Terminer la récurrence
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** « Demain », « 3 nov. » ; en milieu de phrase sans majuscule. */
function dayLabel(value: string, inline = false): string {
  const label = relativeDayLabel(value);
  return inline ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

function RecurringCard({
  item,
  onStatusChange,
  onRequestFinish,
}: {
  item: RecurringItem;
  onStatusChange: (id: string, status: "ACTIVE" | "PAUSED" | "CANCELLED") => void;
  onRequestFinish: (item: RecurringItem) => void;
}) {
  const isCourier = item.deliveryCategory === "COURIER";
  const CategoryIcon = isCourier ? Bike : Package;
  const courierPickups = recurringPickupStopsToRoute(resolveRecurringPickupStops(item));
  const frequency = formatRecurrenceInterval(item.intervalValue ?? 1, item.intervalUnit ?? "WEEKS");
  const period = item.endAt
    ? `du ${dayLabel(item.startAt, true)} au ${dayLabel(item.endAt, true)}`
    : `depuis le ${dayLabel(item.startAt, true)}, sans date de fin`;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{item.label}</h2>
              <Badge variant={item.status === "ACTIVE" ? "success" : "secondary"}>
                {STATUS_LABELS[item.status]}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <CategoryIcon className="h-3 w-3" aria-hidden="true" />
                {DELIVERY_CATEGORY_LABELS[item.deliveryCategory ?? "STANDARD"]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {frequency}, {period}
            </p>
          </div>
          <div className="flex gap-2">
            {item.status === "ACTIVE" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(item.id, "PAUSED")}
                aria-label={`Mettre en pause « ${item.label} »`}
              >
                <Pause className="mr-1 h-3 w-3" aria-hidden="true" /> Pause
              </Button>
            ) : item.status === "PAUSED" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(item.id, "ACTIVE")}
                aria-label={`Reprendre « ${item.label} »`}
              >
                <Play className="mr-1 h-3 w-3" aria-hidden="true" /> Reprendre
              </Button>
            ) : null}
            {item.status !== "CANCELLED" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRequestFinish(item)}
                aria-label={`Terminer « ${item.label} »`}
              >
                Terminer
              </Button>
            )}
          </div>
        </div>

        {item.status === "ACTIVE" && (
          <p className="flex items-center gap-2 rounded-xl bg-[#f5f8f6] px-3 py-2.5 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-[#08783f]" aria-hidden="true" />
            <span className="text-muted-foreground">Prochaine livraison</span>
            <time dateTime={item.nextRunAt} title={fullDateLabel(item.nextRunAt)} className="font-medium text-foreground">
              {dayLabel(item.nextRunAt)}
            </time>
          </p>
        )}
        {item.status === "PAUSED" && (
          <p className="rounded-xl bg-[#f5f8f6] px-3 py-2.5 text-sm text-muted-foreground">
            En pause : aucune livraison n&apos;est créée tant que vous ne la reprenez pas.
          </p>
        )}

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
      </CardContent>
    </Card>
  );
}
