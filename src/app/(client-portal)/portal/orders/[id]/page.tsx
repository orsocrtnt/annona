"use client";

import Link from "next/link";
import { OrderTracking } from "@/components/shared/order-tracking";
import { OrderConversation } from "@/components/shared/order-conversation";
import { OrderProgressTrack } from "@/components/shared/order-progress-track";
import { orderProgress } from "@/lib/orders/progress";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { usePortalOrder } from "@/features/client-portal/hooks";
import {
  OrderStatusBadge,
  DeliveryStatusBadge,
  InvoiceStatusBadge,
} from "@/features/client-portal/status-badges";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatDate } from "@/lib/utils";
import { DeliveryRouteDisplay } from "@/components/shared/delivery-route-display";
import { MissionStopsDisplay } from "@/components/shared/mission-stops-display";
import { getCourierPickupStops } from "@/lib/order/courier-pickups";
import {
  canReorderPortalOrder,
  ReorderOrderButton,
} from "@/features/client-portal/reorder-order-button";
import { HISTORY_ORDER_STATUSES } from "@/lib/constants/order-status";
import { ArrowLeft, FileText, Package } from "lucide-react";

export default function ClientOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, error } = usePortalOrder(id ?? "");

  if (isInitialQueryLoading(isLoading, order)) return <PageSkeleton />;

  if (error || !order) {
    return (
      <EmptyState
        icon={Package}
        title="Commande introuvable"
        description="Cette commande n'existe pas ou ne vous appartient pas."
        action={{ label: "Retour aux commandes", onClick: () => window.location.href = "/portal/orders" }}
      />
    );
  }

  const courierPickups = getCourierPickupStops(order);
  const isHistoryOrder = HISTORY_ORDER_STATUSES.includes(order.status);
  const ordersBackHref = isHistoryOrder ? "/portal/orders/history" : "/portal/orders";
  const ordersBackLabel = isHistoryOrder ? "Historique des commandes" : "Retour aux commandes";

  return (
    <div className="space-y-6">
      <Link href={ordersBackHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {ordersBackLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Commande</p>
          <h1 className="text-2xl font-semibold tracking-tight tabular-nums">{order.reference}</h1>
          <p className="mt-1 text-muted-foreground">Passée le {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} deliveryCategory={order.deliveryCategory} />
          {canReorderPortalOrder(order) && <ReorderOrderButton orderId={order.id} />}
        </div>
      </div>

      {/* Où en est la commande, sans lire de statut technique. */}
      <section aria-label="Avancement" className="rounded-2xl border border-border bg-card px-5 pb-5 pt-1 shadow-sm">
        <OrderProgressTrack progress={orderProgress(order.status, order.deliveryCategory)} />
      </section>

      {(order.shippingAddress || order.deliveryCategory === "COURIER") &&
        order.deliveryCategory !== "SPECIAL_MISSION" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itinéraire</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      {order.deliveryCategory === "SPECIAL_MISSION" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mission spéciale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {order.status === "QUOTE_REQUESTED" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                Votre demande a bien été reçue. Le devis chiffré et son acceptation sont traités
                hors TutelLiv ; l&apos;entreprise vous recontactera directement.
              </p>
            )}
            {order.missionDescription && (
              <div>
                <p className="font-medium text-muted-foreground">Votre demande</p>
                <p className="mt-1 whitespace-pre-wrap">{order.missionDescription}</p>
              </div>
            )}
            {order.stops && order.stops.length > 0 && (
              <div>
                <p className="mb-2 font-medium text-muted-foreground">Adresses</p>
                <MissionStopsDisplay stops={order.stops} />
              </div>
            )}
            {order.requestedDeliveryDate && (
              <p>
                <span className="text-muted-foreground">Date souhaitée :</span>{" "}
                {formatDate(order.requestedDeliveryDate)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {order.deliveryCategory !== "SPECIAL_MISSION" && (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Articles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.deliveryCategory === "COURIER" &&
            order.stops?.some((stop) => stop.items && stop.items.length > 0) ? (
              order.stops.map((stop) =>
                stop.items && stop.items.length > 0 ? (
                  <div key={stop.id} className="space-y-2 rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">
                      {stop.label?.trim() || `Collecte ${stop.sequence + 1}`}
                    </p>
                    {stop.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>
                          {item.name} × {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null
              )
            ) : (
              order.items?.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {item.name} × {item.quantity}
                    {Number(item.unitPrice) > 0 && (
                      <span className="text-muted-foreground"> — {formatCurrency(item.unitPrice)} / unité</span>
                    )}
                  </span>
                  {Number(item.unitPrice) > 0 && (
                    <span className="font-medium">
                      {formatCurrency(Number(item.unitPrice) * item.quantity)}
                    </span>
                  )}
                </div>
              ))
            )}
            {Number(order.totalAmount) > 0 && (
              <div className="flex justify-between border-t border-border pt-3 font-semibold">
                <span>Total estimé</span>
                <span>{formatCurrency(order.totalAmount)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Livraisons associées</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.deliveries?.length ? (
              order.deliveries.map((d) => (
                <Link
                  key={d.id}
                  href={`/portal/deliveries/${d.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Suivre la livraison</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">{d.reference}</span>
                  </span>
                  <DeliveryStatusBadge
                    status={d.status}
                    deliveryCategory={order.deliveryCategory}
                  />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune livraison associée.</p>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {order.invoices && order.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Facture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/portal/invoices/${invoice.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{invoice.reference}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(invoice.amount)}
                  </p>
                </div>
                <InvoiceStatusBadge status={invoice.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      <OrderTracking orderId={order.id} />
      <OrderConversation orderId={order.id} />
    </div>
  );
}
