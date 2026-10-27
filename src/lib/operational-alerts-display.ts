/** Libellés lisibles des alertes : le type et l'échéance plutôt que les références brutes. */

export type AlertDisplayInput = { id: string; title: string; deadline: string | null };

export function alertKindLabel(alert: Pick<AlertDisplayInput, "id" | "title">): string {
  if (alert.id.startsWith("late:")) return "Retard";
  return alert.title;
}

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
const parisDay = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" });

/** « Prévue à 14:30 · 2 h de retard », ou la date quand l'échéance n'est pas du jour. */
export function alertDeadlineLabel(deadline: string | null, now = new Date()): string | null {
  if (!deadline) return null;
  const due = new Date(deadline);
  if (Number.isNaN(due.getTime())) return null;
  const sameDay = parisDay.format(due) === parisDay.format(now);
  const planned = sameDay ? `Prévue à ${timeFormat.format(due)}` : `Prévue le ${dayFormat.format(due)}`;
  const minutes = Math.floor((now.getTime() - due.getTime()) / 60_000);
  if (minutes <= 0) return planned;
  const late = minutes < 60 ? `${minutes} min` : minutes < 48 * 60 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 1440)} j`;
  return `${planned} · ${late} de retard`;
}

export function alertCountLabel(count: number): string {
  return count === 1 ? "1 alerte à suivre" : `${count} alertes à suivre`;
}
