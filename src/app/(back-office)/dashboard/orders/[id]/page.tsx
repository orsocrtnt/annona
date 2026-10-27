"use client";

import Link from "next/link";
import { OrderTracking } from "@/components/shared/order-tracking";
import { OrderConversation } from "@/components/shared/order-conversation";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyOrder } from "@/features/back-office/hooks";
import { AssignDriverSelect } from "@/features/back-office/assign-driver-select";
import { OrderStatusSelect } from "@/features/back-office/order-status-select";
import { OrderInvoiceForm } from "@/features/back-office/order-invoice-form";
import { DeliveryAdminPanel } from "@/features/back-office/delivery-admin-panel";
import { DeleteOrderButton } from "@/features/back-office/delete-order-button";
import { OrderSummary } from "@/features/back-office/order-summary";
import { OrderStatusBadge } from "@/features/client-portal/status-badges";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatClientFromParts } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { MissionStopsDisplay } from "@/components/shared/mission-stops-display";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import { ArrowLeft, Package } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";

export default function CompanyOrderDetailPage() {
  const { can } = usePermissions();
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, error } = useCompanyOrder(id ?? "");

  if (isInitialQueryLoading(isLoading, order)) return <PageSkeleton />;

  if (error || !order) {
    return (
      <EmptyState
        icon={Package}
        title="Commande introuvable"
        description="Cette commande n'existe pas ou n'est plus accessible."
      />
    );
  }

  const courierPickups = getCourierPickupStops(order);
  const canDeleteOrder =
    order.status === "QUOTE_REQUESTED" &&
    (order.deliveries?.length ?? 0) === 0 &&
    (order.invoices?.length ?? 0) === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link href="/dashboard/orders">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commande</p>
          <h1 className="text-lg font-semibold tracking-tight tabular-nums">{order.reference}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} deliveryCategory={order.deliveryCategory} />
          {canDeleteOrder && (
            <DeleteOrderButton
              orderId={order.id}
              orderReference={order.reference}
              redirectTo="/dashboard/orders"
              variant="button"
            />
          )}
        </div>
      </div>

      <OrderSummary order={order} />

      {order.deliveryCategory === "SPECIAL_MISSION" && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base">Demande de devis — mission spéciale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {order.status === "QUOTE_REQUESTED" && (
              <p className="rounded-lg border border-amber-200 bg-background p-3 text-amber-900 dark:text-amber-100">
                Fonction expérimentale hors offre pilote. Le devis chiffré et son acceptation
                restent gérés hors TutelLiv. Après accord externe, passez manuellement le statut
                en « En attente » pour créer la livraison.
              </p>
            )}
            {order.missionDescription && (
              <div>
                <p className="font-medium text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap">{order.missionDescription}</p>
              </div>
            )}
            {order.stops && order.stops.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-muted-foreground">Adresses</p>
                <MissionStopsDisplay stops={order.stops} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.deliveries?.[0] && (
        <Card className="border-brand/20">
          <CardHeader>
            <CardTitle className="text-base">Assigner à un chauffeur</CardTitle>
          </CardHeader>
          <CardContent>
            <AssignDriverSelect
              deliveryId={order.deliveries[0].id}
              status={order.deliveries[0].status}
              driverId={order.deliveries[0].driverId}
              driverName={order.deliveries[0].driverName}
              driver={order.deliveries[0].driver ?? null}
              missionStartedAt={order.deliveries[0].missionStartedAt}
              deliveryCategory={order.deliveryCategory}
              postalCode={order.deliveries[0].postalCode ?? order.shippingPostalCode}
              pickupPostalCode={order.deliveries[0].pickupPostalCode ?? order.pickupPostalCode}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statut de la commande</CardTitle>
        </CardHeader>
        <CardContent>
          <OrderStatusSelect
            orderId={order.id}
            currentStatus={order.status}
            deliveryCategory={order.deliveryCategory}
          />
        </CardContent>
      </Card>

      {can(["invoices:read", "invoices:create", "invoices:update"]) && (order.status === "IN_DELIVERY" ||
        order.status === "DELIVERED" ||
        order.status === "INVOICED" ||
        order.status === "PAID") && <OrderInvoiceForm order={order} />}

      <div className="grid gap-4 lg:grid-cols-2">
        {order.deliveryCategory !== "SPECIAL_MISSION" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.name} × {item.quantity}
                </span>
                {Number(item.unitPrice) > 0 && (
                  <span className="font-medium">
                    {formatCurrency(Number(item.unitPrice) * item.quantity)}
                  </span>
                )}
              </div>
            ))}
            {Number(order.totalAmount) > 0 && (
              <div className="flex justify-between border-t border-border pt-3 font-semibold">
                <span>Total estimé</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {order.deliveryCategory !== "SPECIAL_MISSION" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Livraison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DeliveryRouteDisplay
              category={order.deliveryCategory ?? "STANDARD"}
              pickups={courierPickups.length ? courierPickups : undefined}
              pickup={
                !courierPickups.length && order.pickupAddress
                  ? {
                      address: order.pickupAddress,
                      city: order.pickupCity,
                      postalCode: order.pickupPostalCode,
                      instructions: order.pickupInstructions,
                    }
                  : null
              }
              destination={{
                address: order.shippingAddress ?? "",
                city: order.shippingCity,
                postalCode: order.shippingPostalCode,
                instructions: order.deliveryInstructions,
              }}
            />
            {order.requestedDeliveryDate && (
              <p>
                <span className="text-muted-foreground">Date souhaitée :</span>{" "}
                <span className="font-medium">{formatDate(order.requestedDeliveryDate)}</span>
              </p>
            )}
            {order.notes && <p className="italic text-muted-foreground">{order.notes}</p>}
          </CardContent>
        </Card>
        ) : null}
      </div>

      {order.deliveries?.map((delivery) => (
        <DeliveryAdminPanel
          key={delivery.id}
          delivery={delivery}
          deliveryCategory={order.deliveryCategory}
        />
      ))}

      {order.customer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">
              {formatClientFromParts(order.customer, order.customerEmail)}
            </p>
            <p>{order.customer.email}</p>
            {order.customer.phone && <p>{order.customer.phone}</p>}
            {order.customer.id && (
              <Link href={`/dashboard/clients/${order.customer.id}`} className="text-brand underline underline-offset-2 hover:decoration-2">
                Voir le profil client complet →
              </Link>
            )}
          </CardContent>
        </Card>
      )}
      <OrderTracking orderId={order.id} />
      <OrderConversation orderId={order.id} />
    </div>
  );
}
