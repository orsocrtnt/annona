import { isDemoCompanyId } from "@/lib/demo/demo-constants";

/**
 * DEMO-1 : se déconnecter d'une démo la rend aussitôt (elle est remise à neuf avant le visiteur suivant).
 * Sans effet pour un vrai compte. Compte pas encore connu de la page (déconnexion cliquée juste après un
 * rechargement) : l'appel part quand même, il ne fait rien sans cookie de prêt.
 * Un échec réseau ne bloque pas la déconnexion : le prêt expire de lui-même.
 */
export async function releaseDemoOnLogout(user: { companyId?: string | null } | null | undefined): Promise<void> {
  if (user && !isDemoCompanyId(user.companyId)) return;
  await fetch("/api/demo/leave", { method: "POST" }).catch(() => null);
}
