import { AdminInvoiceDetailView } from "@/features/invoices/admin-invoice-detail";

/** FACT-1 — fiche facture : commandes incluses, lignes, PDF, Factur-X, envoi et règlements (ADM-10, RG-07). */
export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminInvoiceDetailView id={id} />;
}
