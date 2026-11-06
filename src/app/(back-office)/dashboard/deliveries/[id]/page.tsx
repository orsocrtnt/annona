"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Truck } from "lucide-react";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AssignDriverSelect } from "@/features/back-office/assign-driver-select";
import { DeliveryAdminPanel } from "@/features/back-office/delivery-admin-panel";
import { useCompanyDelivery } from "@/features/back-office/hooks";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatLateness } from "@/lib/format/lateness";
import { formatClientFromParts } from "@/lib/format/person-labels";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { formatDate, formatDateTime } from "@/lib/utils";

/**
 * Fiche canonique d'une livraison pour l'équipe (UX-03) : la référence de livraison est le
 * repère principal ; la commande passe dans « Informations techniques ».
 */
export default function CompanyDeliveryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: delivery, isLoading, error } = useCompanyDelivery(id ?? "");

  if (isInitialQueryLoading(isLoading, delivery)) return <PageSkeleton />;

  if (error || !delivery) {
    return (
      <EmptyState
        icon={Truck}
        title="Livraison introuvable"
        description="Cette livraison n'existe pas ou n'est plus accessible."
      />
    );
  }

  const order = delivery.order;
  const category = order.deliveryCategory ?? "STANDARD";
  const customer = order.customer;
  const driverName = delivery.driver
    ? `${delivery.driver.firstName} ${delivery.driver.lastName}`.trim()
    : delivery.driverName;
  const terminal = delivery.status === "DELIVERED" || delivery.status === "FAILED" || delivery.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/dispatch">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour au dispatch
            </Link>
          </Button>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Livraison</p>
          <h1 className="text-lg font-semibold tracking-tight tabular-nums">{delivery.reference}</h1>
        </div>
        <DeliveryStatusBadge status={delivery.status} deliveryCategory={order.deliveryCategory} />
      </div>

      {(delivery.timing.nextAction || delivery.timing.late) && (
        <div
          role="status"
          data-delivery-next-action={delivery.timing.nextAction?.code ?? "NONE"}
          className={
            delivery.timing.late
              ? "rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
              : "rounded-xl border border-brand/30 bg-brand-subtle/40 p-4 text-sm"
          }
        >
          {delivery.timing.late && delivery.timing.lateByMinutes !== null && (
            <p className="font-semibold text-destructive">En retard de {formatLateness(delivery.timing.lateByMinutes)}</p>
          )}
          {delivery.timing.nextAction && (
            <p><span className="text-muted-foreground">Prochaine action :</span> <span className="font-medium">{delivery.timing.nextAction.label}</span></p>
          )}
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 text-sm sm:grid-cols-4" data-delivery-summary="true">
          <div>
            <p className="text-muted-foreground">Client</p>
            <p className="font-medium">{customer ? formatClientFromParts(customer, order.customerEmail) : order.customerEmail ?? "Non renseigné"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Livreur</p>
            <p className="font-medium">{driverName || "Non affecté"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Échéance</p>
            <p className="font-medium">{delivery.timing.dueAt ? formatDateTime(delivery.timing.dueAt) : "Sans échéance"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{delivery.completedAt ? "Terminée le" : "Créneau"}</p>
            <p className="font-medium">
              {delivery.completedAt
                ? formatDate(delivery.completedAt)
                : delivery.scheduledAt
                  ? formatDate(delivery.scheduledAt)
                  : "Sans créneau"}
            </p>
          </div>
        </CardContent>
      </Card>

      {!terminal && (
        <Card className="border-brand/20">
          <CardHeader>
            <CardTitle className="text-base">Assigner à un livreur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AssignDriverSelect
              deliveryId={delivery.id}
              status={delivery.status}
              driverId={delivery.driverId}
              driverName={delivery.driverName}
              driver={delivery.driver ?? null}
              missionStartedAt={delivery.missionStartedAt}
              deliveryCategory={order.deliveryCategory ?? undefined}
              postalCode={delivery.postalCode ?? order.shippingPostalCode}
              pickupPostalCode={delivery.pickupPostalCode ?? order.pickupPostalCode}
            />
          </CardContent>
        </Card>
      )}

      <DeliveryAdminPanel delivery={delivery} deliveryCategory={order.deliveryCategory} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itinéraire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <DeliveryRouteDisplay
            category={category}
            pickup={
              delivery.pickupAddress ?? order.pickupAddress
                ? {
                    address: (delivery.pickupAddress ?? order.pickupAddress)!,
                    city: delivery.pickupCity ?? order.pickupCity,
                    postalCode: delivery.pickupPostalCode ?? order.pickupPostalCode,
                  }
                : null
            }
            destination={{
              address: delivery.address || order.shippingAddress || "",
              city: delivery.city ?? order.shippingCity,
              postalCode: delivery.postalCode ?? order.shippingPostalCode,
              instructions: order.deliveryInstructions,
            }}
          />
        </CardContent>
      </Card>

      {customer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{formatClientFromParts(customer, order.customerEmail)}</p>
            <p>{customer.email}</p>
            {customer.phone && <p>{customer.phone}</p>}
            <Link href={`/dashboard/clients/${customer.id}`} className="text-brand underline underline-offset-2 hover:decoration-2">
              Voir le profil client complet →
            </Link>
          </CardContent>
        </Card>
      )}

      {order.items.length > 0 && (
        <details className="group rounded-xl border bg-card">
          <summary className="cursor-pointer list-none p-4 text-base font-semibold">Contenu ({order.items.length})</summary>
          <div className="space-y-2 border-t p-4 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between gap-4">
                <span>{item.name} × {item.quantity}</span>
                {Number(item.unitPrice) > 0 && (
                  <span className="font-medium">{formatCurrency(Number(item.unitPrice) * item.quantity)}</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}

      <details className="rounded-xl border bg-card" data-delivery-technical="true">
        <summary className="cursor-pointer list-none p-4 text-sm font-medium text-muted-foreground">Informations techniques</summary>
        <div className="space-y-1 border-t p-4 text-sm">
          <p>
            <span className="text-muted-foreground">Commande :</span>{" "}
            <Link href={`/dashboard/orders/${order.id}`} className="tabular-nums underline underline-offset-2">{order.reference}</Link>
          </p>
          <p>
            <span className="text-muted-foreground">Créée le :</span> {formatDate(delivery.createdAt)}
          </p>
        </div>
      </details>
    </div>
  );
}
