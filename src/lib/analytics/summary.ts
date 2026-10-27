/** Résumés en mots des graphiques d'analyse : ce qu'un lecteur d'écran lit, et ce que l'œil retient. */

export type DailyVolume = { date: string; count: number };

export function volumeSummary(rows: DailyVolume[]) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const peak = rows.reduce<DailyVolume | null>((best, row) => (row.count > (best?.count ?? 0) ? row : best), null);
  const average = rows.length ? total / rows.length : 0;
  return { total, peak, average };
}

/** Part encaissée de ce qui a été facturé, en pourcentage entier ; null sans facture. */
export function collectedShare(collected: number, pending: number): number | null {
  const total = collected + pending;
  if (total <= 0) return null;
  return Math.round((collected / total) * 100);
}
