/** « 1 livraison terminée », « 3 livraisons terminées » : remplace les « livraison(s) terminée(s) ». */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${Math.abs(count) >= 2 ? plural : singular}`;
}
