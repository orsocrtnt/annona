"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyClient } from "@/features/back-office/hooks";
import { DeliveryStatusBadge, OrderStatusBadge, TicketStatusBadge } from "@/features/client-portal/status-badges";
import { ActivityList, PersonHeader, RecordRow, RelativeTime } from "@/features/back-office/detail-ui";
import { formatPlace } from "@/lib/format/place";
import { formatCurrency } from "@/features/client-portal/utils";
import { withoutRolePrefix } from "@/lib/format/person-labels";
import { User } from "lucide-react";
import type { OrderStatus, DeliveryStatus, DeliveryCategory, SupportTicketStatus } from "@prisma/client";

interface ClientDetail {
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    lastLoginAt: string | null;
    createdAt: string;
    addresses: { label: string; address: string; city: string; postalCode: string }[];
    ordersAsCustomer: {
      id: string;
      reference: string;
      status: OrderStatus;
      deliveryCategory: DeliveryCategory;
      totalAmount: string | number;
      createdAt: string;
      shippingAddress?: string | null;
      shippingCity?: string | null;
    }[];
    deliveriesAsCustomer: {
      id: string;
      reference: string;
      status: DeliveryStatus;
      deliveryCategory: DeliveryCategory;
      driverName: string | null;
      createdAt: string;
      address?: string | null;
      city?: string | null;
    }[];
    invoices: { reference: string; status: string; amount: string | number; createdAt: string }[];
    tickets: { subject: string; status: string; createdAt: string }[];
  };
  activityToday: {
    type: string;
    at: string;
    label: string;
    description?: string | null;
    deliveryRef?: string;
    status?: string | null;
  }[];
}

export default function CompanyClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useCompanyClient(id ?? "");
  const detail = data as ClientDetail | undefined;

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !detail?.client) {
    return (
      <EmptyState
        icon={User}
        title="Client introuvable"
        description="Ce client n'existe pas ou n'est plus accessible."
      />
    );
  }

  const { client, activityToday } = detail;
  const name = `${client.firstName} ${client.lastName}`.trim();
  const activity = activityToday.map((item) =>
    item.type === "order"
      ? { title: "Nouvelle commande", detail: null, reference: item.label.match(/(CMD|CRS|MSP)-\d+/)?.[0] ?? null, at: item.at }
      : { title: item.label, detail: item.description, reference: item.deliveryRef ?? null, at: item.at }
  );

  return (
    <div className="space-y-6">
      <PersonHeader
        backHref="/dashboard/clients"
        role="Client"
        name={name}
        contact={[client.email, client.phone].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Téléphone</dt><dd>{client.phone ?? "Non renseigné"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Client depuis</dt><dd><RelativeTime date={client.createdAt} withTime={false} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Dernière connexion</dt><dd>{client.lastLoginAt ? <RelativeTime date={client.lastLoginAt} /> : "Jamais"}</dd></div>
            </dl>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Activité aujourd&apos;hui</CardTitle></CardHeader>
          <CardContent>
            <ActivityList items={activity} empty="Aucune activité aujourd'hui" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Commandes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {client.ordersAsCustomer.length === 0 && <p className="text-sm text-muted-foreground">Aucune commande.</p>}
            {client.ordersAsCustomer.map((order) => (
              <RecordRow
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                title={formatPlace(order.shippingAddress, order.shippingCity) ?? "Commande sans adresse"}
                detail={<>Créée <RelativeTime inline date={order.createdAt} /></>}
                meta={order.reference}
                aside={
                  <>
                    <OrderStatusBadge status={order.status} deliveryCategory={order.deliveryCategory} />
                    {Number(order.totalAmount) > 0 && (
                      <span className="tabular-nums">{formatCurrency(order.totalAmount)}</span>
                    )}
                  </>
                }
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Livraisons & support</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {client.deliveriesAsCustomer.length === 0 && <p className="text-muted-foreground">Aucune livraison.</p>}
            {client.deliveriesAsCustomer.slice(0, 8).map((d) => (
              <RecordRow
                key={d.id}
                title={formatPlace(d.address, d.city) ?? "Livraison"}
                detail={d.driverName ? `Livreur : ${withoutRolePrefix(d.driverName)}` : "Pas encore de livreur"}
                meta={d.reference}
                aside={<DeliveryStatusBadge status={d.status} deliveryCategory={d.deliveryCategory} />}
              />
            ))}
            {client.tickets.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="font-medium">Demandes au support</p>
                {client.tickets.map((t, i) => (
                  <RecordRow
                    key={i}
                    title={t.subject}
                    detail={<RelativeTime date={t.createdAt} withTime={false} />}
                    aside={<TicketStatusBadge status={t.status as SupportTicketStatus} />}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {client.addresses.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Adresses enregistrées</CardTitle></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {client.addresses.map((a, i) => (
              <RecordRow key={i} title={a.label} detail={`${a.address}, ${a.postalCode} ${a.city}`} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
