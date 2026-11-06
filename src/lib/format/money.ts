const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 110 → « 1,10 € » (montants en centimes). */
export function formatCents(cents: number): string {
  return EUROS.format(cents / 100);
}

/** 110 → « 1,10 » : valeur d'un champ de saisie en euros. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

/** 550 → « 5,5 % ». */
export function formatVatRate(basisPoints: number): string {
  return `${(basisPoints / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

/** 550 → « 5,5 » : valeur d'un champ de saisie en pourcentage. */
export function basisPointsToInput(basisPoints: number): string {
  return (basisPoints / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2, useGrouping: false });
}
