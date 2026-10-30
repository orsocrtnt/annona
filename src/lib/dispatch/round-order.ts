/**
 * Tournée dans l'application livreur : les missions d'une même tournée se suivent dans l'ordre de
 * passage, à la place de la première d'entre elles. Le reste garde son ordre.
 */
export function orderMissionsByRound<T extends { id: string; roundId?: string | null; roundSequence?: number | null }>(missions: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const mission of missions) {
    if (!mission.roundId) continue;
    groups.set(mission.roundId, [...(groups.get(mission.roundId) ?? []), mission]);
  }
  const ordered: T[] = [];
  const placed = new Set<string>();
  for (const mission of missions) {
    if (!mission.roundId) {
      ordered.push(mission);
    } else if (!placed.has(mission.roundId)) {
      placed.add(mission.roundId);
      ordered.push(...[...groups.get(mission.roundId)!].sort((a, b) => (a.roundSequence ?? 0) - (b.roundSequence ?? 0)));
    }
  }
  return ordered;
}
