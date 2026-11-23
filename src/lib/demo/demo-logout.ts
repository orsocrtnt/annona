import { isDemoCompanyId } from "@/lib/demo/demo-constants";

/**
 * DEMO-1 : se déconnecter d'une démo la rend aussitôt (elle est remise à neuf avant le visiteur suivant).
 * Sans effet pour un vrai compte. Un échec réseau ne bloque pas la déconnexion : le prêt expire de lui-même.
 */
export async function releaseDemoOnLogout(companyId: string | null | undefined): Promise<void> {
  if (!isDemoCompanyId(companyId)) return;
  await fetch("/api/demo/leave", { method: "POST" }).catch(() => null);
}
