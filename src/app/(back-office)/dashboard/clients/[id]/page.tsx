"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyClient } from "@/features/back-office/hooks";
import { DeliveryStatusBadge, OrderStatusBadge } from "@/features/client-portal/status-badges";
import { formatCurrency } from "@/features/client-portal/utils";
import { formatDriverFromParts, formatPersonNameByRole } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, User } from "lucide-react";
import type { OrderStatus, DeliveryStatus, DeliveryCategory } from "@prisma/client";

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
    }[];
    deliveriesAsCustomer: {
      id: string;
      reference: string;
      status: DeliveryStatus;
      deliveryCategory: DeliveryCategory;
      driverName: string | null;
      createdAt: string;
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

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href="/dashboard/clients">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatPersonNameByRole(client.firstName, client.lastName, "CLIENT")}
        </h1>
        <p className="mt-1 text-muted-foreground">{client.email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Tél. : {client.phone ?? "—"}</p>
            <p>Inscrit le : {formatDate(client.createdAt)}</p>
            <p>Dernière connexion : {client.lastLoginAt ? formatDate(client.lastLoginAt) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Activité aujourd&apos;hui</CardTitle></CardHeader>
          <CardContent>
            {activityToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune activité aujourd&apos;hui</p>
            ) : (
              <ol className="space-y-3">
                {activityToday.map((item, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium">{item.label}</p>
                    {item.description && <p className="text-muted-foreground">{item.description}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(item.at)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Commandes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {client.ordersAsCustomer.map((order) => (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">{order.reference}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStatusBadge status={order.status} deliveryCategory={order.deliveryCategory} />
                  {Number(order.totalAmount) > 0 && (
                    <span>{formatCurrency(order.totalAmount)}</span>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Livraisons & support</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {client.deliveriesAsCustomer.slice(0, 8).map((d) => (
              <div key={d.id} className="flex justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{d.reference}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.driverName
                      ? formatDriverFromParts(null, d.driverName)
                      : "Non assigné"}
                  </p>
                </div>
                <DeliveryStatusBadge status={d.status} deliveryCategory={d.deliveryCategory} />
              </div>
            ))}
            {client.tickets.length > 0 && (
              <div className="pt-2">
                <p className="mb-2 font-medium">Tickets support</p>
                {client.tickets.map((t, i) => (
                  <p key={i} className="text-muted-foreground">
                    {t.subject} — {t.status}
                  </p>
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
              <div key={i} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{a.label}</p>
                <p>{a.address}, {a.postalCode} {a.city}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
