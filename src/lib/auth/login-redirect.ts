/** La reprise imposée par le serveur prime sur un ancien lien vers le tableau de bord. */
export function selectLoginRedirect(requestedPath: string | null, serverPath: string): string {
  if (serverPath === "/onboarding") return serverPath;
  if (serverPath === "/dashboard" && requestedPath === "/onboarding") return requestedPath;
  return serverPath;
}
