/** Largeurs des barres de charge : proportionnelles au livreur le plus chargé de la période. */
export type WorkloadSplit = { standard: number; courier: number };

export function workloadBar(split: WorkloadSplit, max: number) {
  const total = split.standard + split.courier;
  if (max <= 0 || total <= 0) return { total, standardPct: 0, courierPct: 0 };
  return {
    total,
    standardPct: (split.standard / max) * 100,
    courierPct: (split.courier / max) * 100,
  };
}

export function workloadMax(splits: WorkloadSplit[]): number {
  return splits.reduce((max, split) => Math.max(max, split.standard + split.courier), 0);
}

/** « 2 commandes et 1 course », « aucune livraison » : la même information que la barre, en mots. */
export function workloadSentence(split: WorkloadSplit): string {
  const parts = [
    split.standard ? `${split.standard} commande${split.standard > 1 ? "s" : ""}` : "",
    split.courier ? `${split.courier} course${split.courier > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" et ") : "aucune livraison";
}

/** Journée d'un livreur : livrées, en cours, à faire (missions assignées non démarrées). */
export type DriverDay = { delivered: number; inTransit: number; toDo: number };

export function driverDaySegments(day: DriverDay) {
  const total = day.delivered + day.inTransit + day.toDo;
  const pct = (value: number) => (total ? (value / total) * 100 : 0);
  return { total, delivered: pct(day.delivered), inTransit: pct(day.inTransit), toDo: pct(day.toDo) };
}

export function driverDaySentence(day: DriverDay): string {
  const parts = [
    day.inTransit ? `${day.inTransit} en cours` : "",
    day.toDo ? `${day.toDo} à faire` : "",
    day.delivered ? `${day.delivered} livrée${day.delivered > 1 ? "s" : ""}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Aucune mission aujourd'hui";
}
