"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, Flag } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PilotDetailView } from "@/features/admin/pilots/pilot-detail-view";
import { useAdminPilot } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

/** ADMIN-ESPACE lot 4 : fiche d'un pilote (étape, suivi, notes, courbe de l'entreprise liée). */
export default function AdminPilotPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: pilot, isLoading, error } = useAdminPilot(id);

  if (isInitialQueryLoading(isLoading, pilot)) return <PageSkeleton />;

  if (error instanceof Error && error.message === "Pilote introuvable") {
    return <EmptyState icon={Flag} title="Pilote introuvable" description="Ce pilote n'existe pas ou plus." />;
  }

  if (error || !pilot) {
    return <EmptyState icon={AlertTriangle} title="Pilote indisponible" description="Impossible de charger ce pilote pour le moment." />;
  }

  return <PilotDetailView pilot={pilot} />;
}
