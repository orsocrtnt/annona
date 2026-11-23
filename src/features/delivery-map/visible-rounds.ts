/**
 * CARTE-1 — tournées affichées sur la carte du gérant. « all » : toutes ; sinon la liste des tournées choisies.
 *
 * Toucher une tournée quand toutes sont affichées n'affiche plus qu'elle ; toucher ensuite d'autres tournées les
 * ajoute ou les retire ; retirer la dernière, ou les choisir toutes, revient à « Toutes ».
 */
export type VisibleRounds = "all" | readonly string[];

/** Liste nettoyée : tournées encore présentes, dans l'ordre d'affichage ; « all » si vide ou complète. */
export function normalizeVisible(visible: VisibleRounds, allIds: readonly string[]): VisibleRounds {
  if (visible === "all") return "all";
  const chosen = allIds.filter((id) => visible.includes(id));
  return chosen.length === 0 || chosen.length === allIds.length ? "all" : chosen;
}

export function toggleRound(visible: VisibleRounds, roundId: string, allIds: readonly string[]): VisibleRounds {
  if (!allIds.includes(roundId)) return normalizeVisible(visible, allIds);
  if (visible === "all") return allIds.length <= 1 ? "all" : [roundId];
  const next = visible.includes(roundId) ? visible.filter((id) => id !== roundId) : [...visible, roundId];
  return normalizeVisible(next, allIds);
}

export function isRoundVisible(visible: VisibleRounds, roundId: string): boolean {
  return visible === "all" || visible.includes(roundId);
}

/** La seule tournée affichée, s'il n'y en a qu'une (sa fiche détaillée s'ouvre). */
export function soloRoundId(visible: VisibleRounds, allIds: readonly string[]): string | null {
  if (visible === "all") return allIds.length === 1 ? allIds[0]! : null;
  return visible.length === 1 ? visible[0]! : null;
}

/**
 * Tracé de ce qui reste à faire : depuis le dernier arrêt fait (ou le laboratoire), les arrêts à livrer dans l'ordre.
 * Les arrêts livrés ne sont pas reliés (petits points gris) : une tournée terminée ne laisse aucun trait.
 */
export function remainingPath(
  stops: ReadonlyArray<{ sequence: number; status: string; latitude: number | null; longitude: number | null }>,
  depot: { latitude: number; longitude: number } | null,
): Array<[number, number]> {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const pending = ordered.filter((stop) => stop.status === "PENDING");
  if (pending.length === 0) return [];
  const lastDone = ordered.filter((stop) => stop.status !== "PENDING" && stop.sequence < pending[0]!.sequence).at(-1);
  const start = lastDone ? [lastDone.latitude!, lastDone.longitude!] as [number, number] : depot ? [depot.latitude, depot.longitude] as [number, number] : null;
  return [...(start ? [start] : []), ...pending.map((stop) => [stop.latitude!, stop.longitude!] as [number, number])];
}
