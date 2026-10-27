"use client";

import Link from "next/link";
import { TableDriverDayCell } from "@/components/shared/table-cells";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useDriverMissions } from "@/features/driver/hooks";
import { MissionCard } from "@/features/driver/mission-card";
import { useAuth } from "@/hooks/use-auth";
import { Truck } from "lucide-react";

export default function DriverDashboardPage() {
  const { user } = useAuth();
  const { data, isLoading, error } = useDriverMissions();
  const missions = data?.missions ?? [];
  const stats = data?.stats;

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Truck}
          title="Impossible de charger vos missions"
          description="Réessayez dans quelques instants."
        />
      </div>
    );
  }

  const inProgressMissions = missions.filter(
    (m) => m.status === "IN_DELIVERY" || m.status === "PURCHASING"
  );
  const assignedMissions = missions.filter((m) => m.status === "ASSIGNED");

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {user?.firstName?.trim() ? `Bonjour ${user.firstName.trim()}` : "Bonjour"}
        </h1>
        <p className="text-sm text-muted-foreground">Vos missions assignées par le dispatch</p>
      </div>

      {/* Une phrase et une barre plutôt que trois compteurs. */}
      <section aria-label="Ma journée" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-foreground">Ma journée</p>
        <TableDriverDayCell
          day={{ delivered: stats?.deliveredToday ?? 0, inTransit: stats?.inTransit ?? 0, toDo: stats?.assigned ?? 0 }}
        />
      </section>

      {inProgressMissions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Missions en cours ({inProgressMissions.length})
          </h2>
          {inProgressMissions.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </div>
      ) : assignedMissions.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Prêtes à démarrer</h2>
          {assignedMissions.slice(0, 3).map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
          {assignedMissions.length > 3 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/driver/missions">Voir toutes ({assignedMissions.length})</Link>
            </Button>
          )}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aucune mission en cours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Attendez qu&apos;une mission vous soit assignée par le dispatch.</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/driver/missions">Voir mes missions</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
