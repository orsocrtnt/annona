/**
 * Mise à jour d'un JSON `settings` par réclamation sur `updatedAt` (motif de tracking.service) :
 * relire, appliquer la modification sur la version lue, écrire seulement si la ligne n'a pas
 * changé entre-temps ; sinon relire et réessayer. Aucune clé écrite par un autre écrivain
 * concurrent n'est perdue tant que cet écrivain réclame aussi la version.
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
  attempts?: number;
}): Promise<"saved" | "missing"> {
  const attempts = options.attempts ?? 3;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const row = await options.load();
    if (!row) return "missing";
    const claim = { expected: row.updatedAt, next: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) };
    if (await options.save(options.apply(asRecord(row.settings)), claim)) return "saved";
  }
  throw new Error("SETTINGS_CONFLICT");
}
