/** Parse une liste de codes postaux saisis manuellement (ex. "75009, 75007, 92"). */
export function parsePostalCodeList(value: string): string[] {
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function formatPostalCodeList(prefixes: string[]): string {
  return prefixes.join(", ");
}

/** Vérifie si le code postal de la mission correspond à l'un des préfixes autorisés. */
export function matchesPostalCodePrefix(
  postalCode: string | null | undefined,
  prefixes: string[]
): boolean {
  if (prefixes.length === 0) return false;
  if (!postalCode) return false;
  const normalized = postalCode.trim();
  return prefixes.some((prefix) => normalized.startsWith(prefix.trim()));
}
