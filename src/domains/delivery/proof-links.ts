/**
 * Liens internes vers les pièces de la preuve de livraison. Aucun lien Storage n'est exposé dans les
 * réponses d'API : chaque lien passe par une route authentifiée qui génère, au clic, une URL signée de
 * 5 minutes (photo, signature) ou le PDF de preuve.
 */
type ProofLinkRow = {
  id: string;
  status?: string | null;
  podOutcome?: string | null;
  podPhotoPath?: string | null;
  podSignaturePath?: string | null;
};

const TERMINAL_STATUSES = ["DELIVERED", "FAILED", "INVOICED", "PAID"];

export function proofLinks(basePath: string, row: ProofLinkRow) {
  const base = `${basePath}/${encodeURIComponent(row.id)}/proof`;
  const hasProof = Boolean(row.podOutcome) || (row.status != null && TERMINAL_STATUSES.includes(row.status));
  return {
    podPhotoUrl: row.podPhotoPath ? `${base}/photo` : null,
    podSignatureUrl: row.podSignaturePath ? `${base}/signature` : null,
    podPdfUrl: hasProof ? `${base}/pdf` : null,
  };
}

/** Retire les chemins de stockage de la ligne et ajoute les liens internes (`podPhotoUrl`, `podSignatureUrl`, `podPdfUrl`). */
export function withProofLinks<T extends ProofLinkRow>(basePath: string, row: T) {
  const { podPhotoPath: _photo, podSignaturePath: _signature, ...rest } = row;
  void _photo;
  void _signature;
  return { ...rest, ...proofLinks(basePath, row) };
}
