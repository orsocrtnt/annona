/** Purge des anciens mots de passe : ne jamais lire ni réécrire ces données. */
export function clearPendingCredentials(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem("tutelliv:pending-credentials"); } catch { /* Stockage désactivé. */ }
}
