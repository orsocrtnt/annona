/** Durée d'un retard en minutes, lisible : « 12 min », « 2 h 5 min », « 3 jours ». */
export function formatLateness(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  return `${Math.round(hours / 24)} jours`;
}
