import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { PortalInvoicesContent } from "@/features/invoices/portal-invoices-content";

/** FACT-1 (CLI-10) — factures et relevés du commerçant, par jour, semaine, mois ou année. */
export default function ClientInvoicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PortalInvoicesContent />
    </Suspense>
  );
}
