export type ClientLiveEta = {
  minutes: number;
  /** Vrai sans service de trajet : estimation à vol d'oiseau. */
  approximate: boolean;
};

export function liveEtaLabel(eta: ClientLiveEta): string {
  return `Arrive dans ${eta.approximate ? "environ " : ""}${eta.minutes} min`;
}
