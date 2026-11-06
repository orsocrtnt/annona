/**
 * Liens internes vers les pièces de la preuve de livraison. Aucun lien Storage n'est exposé dans les
 * réponses d'API : chaque lien passe par une route authentifiée qui génère, au clic, une URL signée de
 * 5 minutes (photo, signature).
 */
type ProofLinkRow = {
  id: string;
  status?: string | null;
  podOutcome?: string | null;
  podPhotoPath?: string | null;
  podSignaturePath?: string | null;
};

export function proofLinks(basePath: string, row: ProofLinkRow) {
  const base = `${basePath}/${encodeURIComponent(row.id)}/proof`;
  return {
    podPhotoUrl: row.podPhotoPath ? `${base}/photo` : null,
    podSignatureUrl: row.podSignaturePath ? `${base}/signature` : null,
  };
}

const STORAGE_PATH_KEYS = new Set(["podPhotoPath", "podSignaturePath"]);

/**
 * Retire récursivement les chemins de stockage des preuves de toute réponse d'API : seules les routes
 * internes `/proof` sortent. Ne modifie pas l'entrée ; conserve les dates.
 */
export function omitStoragePaths<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => omitStoragePaths(item)) as unknown as T;
  if (Object.prototype.toString.call(value) === "[object Object]") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !STORAGE_PATH_KEYS.has(key))
        .map(([key, item]) => [key, omitStoragePaths(item)])
    ) as T;
  }
  return value;
}

/** Retire les chemins de stockage de la ligne et ajoute les liens internes (`podPhotoUrl`, `podSignatureUrl`). */
export function withProofLinks<T extends ProofLinkRow>(basePath: string, row: T) {
  const { podPhotoPath: _photo, podSignaturePath: _signature, ...rest } = row;
  void _photo;
  void _signature;
  return { ...rest, ...proofLinks(basePath, row) };
}
