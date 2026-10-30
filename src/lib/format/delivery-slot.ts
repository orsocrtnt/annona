const TIME = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

/** « 09:00 – 12:00 » en heure de Paris, celle des créneaux réglés par l'entreprise. */
export function deliverySlotRange(start: string | Date, end: string | Date): string {
  return `${TIME.format(new Date(start))} – ${TIME.format(new Date(end))}`;
}

export function formatWeightKg(value: string | number): string {
  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`;
}
