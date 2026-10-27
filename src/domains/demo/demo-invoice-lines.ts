/**
 * Lignes des factures démo, au même contrat que les vraies factures
 * (`invoiceLineItemSchema` : `amount` par unité, lu par la page facture et le PDF).
 */
export function demoInvoiceLineItems(items: ReadonlyArray<{ name: string; quantity: number; unitPrice: number }>) {
  return items.map((item) => ({
    label: item.name,
    amount: item.unitPrice,
    quantity: item.quantity,
    sourceType: "PURCHASE" as const,
  }));
}
