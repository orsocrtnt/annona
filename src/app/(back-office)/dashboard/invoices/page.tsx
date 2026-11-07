import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { AdminInvoicesContent } from "@/features/invoices/admin-invoices-content";

/** FACT-1 — factures par période (ADM-10), règlements (RG-07), mentions légales (ENF-05). */
export default function InvoicesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminInvoicesContent />
    </Suspense>
  );
}
