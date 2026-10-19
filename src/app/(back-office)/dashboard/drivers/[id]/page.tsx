"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyDriver } from "@/features/back-office/hooks";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import { formatClientFromParts, formatPersonNameByRole } from "@/lib/format/person-labels";
import { formatDate } from "@/lib/utils";
import { ArrowLeft, Truck } from "lucide-react";
import type { DeliveryStatus } from "@prisma/client";

interface DriverDetail {
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    lastLoginAt: string | null;
    createdAt: string;
  };
  stats: { assigned: number; inTransit: number; deliveredToday: number };
  missions: {
    id: string;
    reference: string;
    status: DeliveryStatus;
    deliveryCategory: import("@prisma/client").DeliveryCategory;
    address: string;
    city: string | null;
    updatedAt: string;
    completedAt: string | null;
    order: {
      reference: string;
      customer: { firstName: string; lastName: string } | null;
      customerEmail: string | null;
    };
    trackingEvents: { label: string; occurredAt: string }[];
  }[];
  todayEvents: {
    label: string;
    description: string | null;
    occurredAt: string;
    delivery: { reference: string; status: DeliveryStatus };
  }[];
}

export default function CompanyDriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error } = useCompanyDriver(id ?? "");
  const detail = data as DriverDetail | undefined;

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error || !detail?.driver) {
    return (
      <EmptyState
        icon={Truck}
        title="Chauffeur introuvable"
        description="Ce chauffeur n'existe pas ou n'est plus accessible."
      />
    );
  }

  const { driver, stats, missions, todayEvents } = detail;

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link href="/dashboard/drivers">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatPersonNameByRole(driver.firstName, driver.lastName, "DRIVER")}
        </h1>
        <p className="mt-1 text-muted-foreground">{driver.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assignées" value={stats.assigned} icon={Truck} />
        <StatCard label="En cours" value={stats.inTransit} icon={Truck} />
        <StatCard label="Livrées aujourd'hui" value={stats.deliveredToday} icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Activité aujourd&apos;hui</CardTitle></CardHeader>
          <CardContent>
            {todayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun événement aujourd&apos;hui</p>
            ) : (
              <ol className="space-y-3">
                {todayEvents.map((e, i) => (
                  <li key={i} className="text-sm">
                    <p className="font-medium">{e.label} — {e.delivery.reference}</p>
                    {e.description && <p className="text-muted-foreground">{e.description}</p>}
                    <p className="text-xs text-muted-foreground">{formatDate(e.occurredAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Informations</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Tél. : {driver.phone ?? "—"}</p>
            <p>Depuis : {formatDate(driver.createdAt)}</p>
            <p>Dernière connexion : {driver.lastLoginAt ? formatDate(driver.lastLoginAt) : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Missions récentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {missions.map((m) => {
            const client = m.order.customer
              ? formatClientFromParts(m.order.customer, m.order.customerEmail)
              : m.order.customerEmail ?? "—";
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div>
                  <p className="font-medium">{m.reference} — {m.order.reference}</p>
                  <p className="text-muted-foreground">{client} · {m.address}{m.city ? `, ${m.city}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    MAJ {formatDate(m.updatedAt)}
                    {m.completedAt ? ` · Livré ${formatDate(m.completedAt)}` : ""}
                  </p>
                </div>
                <DeliveryStatusBadge status={m.status} deliveryCategory={m.deliveryCategory} />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
