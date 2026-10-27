/** « 12 rue Lepic, Paris » : la ville n'est ajoutée que si l'adresse ne la contient pas déjà. */
export function formatPlace(street?: string | null, city?: string | null): string | null {
  const s = (street ?? "").trim();
  const c = (city ?? "").trim();
  const place = [s, c && !s.toLowerCase().includes(c.toLowerCase()) ? c : ""].filter(Boolean).join(", ");
  return place || null;
}
