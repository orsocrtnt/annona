"use client";

import { useParams } from "next/navigation";
import { AlertTriangle, Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { CompanyFileView } from "@/features/admin/company/company-file-view";
import { useAdminCompany } from "@/features/admin/hooks";
import { isInitialQueryLoading } from "@/lib/query/is-initial-loading";

/** Fiche entreprise du super-administrateur (ADMIN-ESPACE lot 3), en lecture seule. */
export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { data: company, isLoading, error } = useAdminCompany(id);

  if (isInitialQueryLoading(isLoading, company)) return <PageSkeleton />;

  if (error instanceof Error && error.message === "Entreprise introuvable") {
    return <EmptyState icon={Building2} title="Entreprise introuvable" description="Cette entreprise est absente de la liste plateforme." />;
  }

  if (error || !company) {
    return <EmptyState icon={AlertTriangle} title="Entreprise indisponible" description="Impossible de charger cette entreprise." />;
  }

  return <CompanyFileView company={company} />;
}
