/**
 * Mise à jour d'un JSON `settings` par réclamation sur `updatedAt` (motif de tracking.service) :
 * relire, appliquer la modification sur la version lue, écrire seulement si la ligne n'a pas
 * changé entre-temps ; sinon relire et réessayer. Aucune clé écrite par un autre écrivain
 * concurrent n'est perdue tant que cet écrivain réclame aussi la version.
 * `section` : partie des réglages que cet écrivain remplace. Si un autre enregistrement l'a modifiée
 * pendant la tentative (deux enregistrements du même réglage qui se croisent en base), rien n'est écrit
 * et SETTINGS_CONFLICT est levé. Limite : la référence est la première lecture du serveur, pas la
 * version chargée par le formulaire ; deux enregistrements successifs (l'un fini avant que l'autre ne
 * lise) restent « le dernier gagne » (aucun jeton de version côté client).
 */

export interface SettingsRow {
  settings: unknown;
  updatedAt: Date;
}

export interface SettingsClaim {
  /** Version lue : l'écriture ne s'applique que si la ligne porte encore cette valeur. */
  expected: Date;
  /** Nouvelle version, strictement postérieure. */
  next: Date;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

export async function updateSettingsWithClaim(options: {
  load: () => Promise<SettingsRow | null>;
  /** `updateMany({ where: { id, updatedAt: claim.expected }, data: { settings, updatedAt: claim.next } })` ; true si 1 ligne. */
  save: (nextSettings: Record<string, unknown>, claim: SettingsClaim) => Promise<boolean>;
  apply: (current: Record<string, unknown>) => Record<string, unknown>;
  section?: (current: Record<string, unknown>) => unknown;
  attempts?: number;
}): Promise<"saved" | "missing"> {
  // Cinq tentatives : plusieurs réglages différents enregistrés au même instant passent tous.
  const attempts = options.attempts ?? 5;
  let firstSection: string | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const row = await options.load();
    if (!row) return "missing";
    if (options.section) {
      // JSON relu en base (jsonb : ordre des clés normalisé) ; `undefined` devient "null".
      const section = JSON.stringify(options.section(asRecord(row.settings)) ?? null);
      if (firstSection === undefined) firstSection = section;
      else if (section !== firstSection) throw new Error("SETTINGS_CONFLICT");
    }
    const claim = { expected: row.updatedAt, next: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) };
    if (await options.save(options.apply(asRecord(row.settings)), claim)) return "saved";
  }
  // Traduit en 409 « Rechargez puis réessayez » par les routes (KNOWN_ERROR_CODES ou capture locale).
  throw new Error("SETTINGS_CONFLICT");
}

/** Partie des réglages désignée par un chemin de clés (`["backOffice", "dashboard"]`). */
export function settingsSection(...path: string[]) {
  return (current: Record<string, unknown>): unknown =>
    path.reduce<unknown>((value, key) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>)[key] : undefined), current);
}

/** Plusieurs clés de premier niveau remplacées ensemble (ex. tarifs : zones et frais). */
export function settingsKeys(...keys: string[]) {
  return (current: Record<string, unknown>): unknown => keys.map((key) => current[key] ?? null);
}
