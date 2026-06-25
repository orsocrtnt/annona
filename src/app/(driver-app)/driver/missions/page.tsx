"use client";

import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";
import { EmptyState } from "@/components/ui/empty-state";
import { useDriverMissions } from "@/features/driver/hooks";
import { MissionCard } from "@/features/driver/mission-card";
import { AvailableMissionCard } from "@/features/driver/available-mission-card";
import { Truck } from "lucide-react";

export default function DriverMissionsPage() {
  const { data, isLoading, error } = useDriverMissions();
  const missions = data?.missions ?? [];
  const availableMissions = data?.available ?? [];

  const activeMissions = missions.filter((m) => m.status !== "DELIVERED");
  const inProgressMissions = activeMissions.filter(
    (m) => m.status === "PURCHASING" || m.status === "IN_DELIVERY"
  );
  const assignedMissions = activeMissions.filter((m) => m.status === "ASSIGNED");

  if (isInitialQueryLoading(isLoading, data)) return <PageSkeleton />;

  if (error) {
    return (
      <div className="p-4">
        <EmptyState
          icon={Truck}
          title="Impossible de charger les missions"
          description="Réessayez dans quelques instants."
        />
      </div>
    );
  }

  const hasContent = activeMissions.length > 0 || availableMissions.length > 0;

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Missions</h1>
        <p className="text-sm text-muted-foreground">
          Vos missions assignées par le dispatch. Démarrez-en plusieurs en parallèle si besoin.
        </p>
      </div>

      {!hasContent ? (
        <EmptyState
          icon={Truck}
          title="Aucune mission"
          description="Les missions assignées par le dispatch apparaîtront ici."
        />
      ) : (
        <>
          {inProgressMissions.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-medium">En cours</h2>
                <p className="text-xs text-muted-foreground">
                  {inProgressMissions.length} en cours
                </p>
              </div>
              {inProgressMissions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </section>
          )}

          {assignedMissions.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-medium">Assignées</h2>
                <p className="text-xs text-muted-foreground">
                  Démarrez quand vous êtes prêt
                </p>
              </div>
              {assignedMissions.map((mission) => (
                <MissionCard key={mission.id} mission={mission} />
              ))}
            </section>
          )}

          {availableMissions.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-medium">Disponibles</h2>
                <p className="text-xs text-muted-foreground">
                  Missions à prendre en charge ({availableMissions.length})
                </p>
              </div>
              {availableMissions.map((mission) => (
                <AvailableMissionCard key={mission.id} mission={mission} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
