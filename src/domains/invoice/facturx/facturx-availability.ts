/** Règle unique (portail, back-office, mapping) : quels statuts de facture peuvent produire un Factur-X. */
export function facturXUnavailableReason(status: string): string | null {
  if (status === "DRAFT") return "Facture en brouillon : le Factur-X est disponible une fois la facture émise.";
  if (status === "CANCELLED") return "Facture annulée : aucun Factur-X n'est émis.";
  return null;
}
