/**
 * ENF-04 — la position du livreur n'est lue (navigateur ou application native) que pendant une
 * tournée démarrée, d'après le statut confirmé par le serveur. Le serveur refuse aussi toute position
 * hors tournée (`/api/driver/location`).
 */
export interface RoundStatusLike {
  status: string;
}

export function driverLocationAllowed(rounds: readonly RoundStatusLike[]): boolean {
  return rounds.some((round) => round.status === "IN_PROGRESS");
}
