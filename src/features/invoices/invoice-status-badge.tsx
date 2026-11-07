import { Badge } from "@/components/ui/badge";
import type { InvoiceListItem } from "@/domains/invoice/invoice.types";
import { SETTLEMENT_LABELS } from "@/lib/constants/invoice-status";
import { fr } from "@/lib/i18n/fr";

/** Statut de règlement calculé (RG-07), avec le retard lu à l'heure de Paris. */
export function InvoiceStatusBadge({ invoice }: { invoice: Pick<InvoiceListItem, "status" | "settlement" | "daysOverdue"> }) {
  if (invoice.status === "CANCELLED") return <Badge variant="outline">Annulée</Badge>;
  const overdue = invoice.status === "OVERDUE" && invoice.settlement !== "PAID";
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant={invoice.settlement === "PAID" ? "success" : invoice.settlement === "PARTIAL" ? "brand" : "warning"}>
        {SETTLEMENT_LABELS[invoice.settlement]}
      </Badge>
      {overdue ? <Badge variant="error">{fr.invoices.overdue(invoice.daysOverdue)}</Badge> : null}
    </span>
  );
}
