"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useCompanyDriver } from "@/features/back-office/hooks";
import { DeliveryStatusBadge } from "@/features/client-portal/status-badges";
import { ActivityList, PersonHeader, RecordRow, RelativeTime } from "@/features/back-office/detail-ui";
import { plainClientName, TableDriverDayCell } from "@/features/back-office/table-ui";
import { formatPlace } from "@/lib/format/place";
import { Truck } from "lucide-react";
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
  const name = `${driver.firstName} ${driver.lastName}`.trim();

  return (
    <div className="space-y-6">
      <PersonHeader
        backHref="/dashboard/drivers"
        role="Chauffeur"
        name={name}
        contact={[driver.phone, driver.email].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Sa journée</CardTitle></CardHeader>
          <CardContent>
            {/* Une phrase et une barre au lieu de trois compteurs. */}
            <TableDriverDayCell
              day={{ delivered: stats.deliveredToday, inTransit: stats.inTransit, toDo: stats.assigned }}
            />
            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Téléphone</dt><dd>{driver.phone ?? "Non renseigné"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Dans l&apos;équipe depuis</dt><dd><RelativeTime date={driver.createdAt} withTime={false} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Dernière connexion</dt><dd>{driver.lastLoginAt ? <RelativeTime date={driver.lastLoginAt} /> : "Jamais"}</dd></div>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Activité aujourd&apos;hui</CardTitle></CardHeader>
          <CardContent>
            <ActivityList
              items={todayEvents.map((e) => ({ title: e.label, detail: e.description, reference: e.delivery.reference, at: e.occurredAt }))}
              empty="Aucun événement aujourd'hui"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Missions récentes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {missions.length === 0 && <p className="text-sm text-muted-foreground">Aucune mission.</p>}
          {missions.map((m) => (
            <RecordRow
              key={m.id}
              title={formatPlace(m.address, m.city) ?? "Mission"}
              detail={plainClientName(m.order)}
              meta={
                <>
                  {m.reference} · mise à jour <RelativeTime inline date={m.updatedAt} />
                  {m.completedAt ? <> · livrée <RelativeTime inline date={m.completedAt} /></> : null}
                </>
              }
              aside={<DeliveryStatusBadge status={m.status} deliveryCategory={m.deliveryCategory} />}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
