// SEC-6 : défense CSRF du middleware (runtime Edge, aucune API Node).
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Appels serveur à serveur authentifiés par signature ou secret, sans Origin navigateur. */
export function isOriginCheckExempt(pathname: string): boolean {
  return pathname === "/api/billing/webhook" || pathname.startsWith("/api/cron/");
}

function originOf(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Vrai si une mutation vient d'une autre origine que l'application. L'origine admise est
 * celle de la requête et, derrière un proxy qui réécrit l'hôte, `NEXT_PUBLIC_APP_URL`.
 * Sans en-tête Origin (client non navigateur, test E2E), seul `Sec-Fetch-Site` peut refuser :
 * un navigateur moderne envoie toujours l'un des deux sur une mutation.
 */
export function isCrossOriginMutation(
  request: Pick<Request, "method" | "url" | "headers">,
  options: { appUrl?: string } = {}
): boolean {
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return false;
  const url = new URL(request.url);
  if (isOriginCheckExempt(url.pathname)) return false;

  const origin = request.headers.get("origin");
  if (origin === null) {
    const site = request.headers.get("sec-fetch-site");
    return site !== null && site !== "same-origin" && site !== "none";
  }
  const allowed = new Set([url.origin]);
  const appOrigin = originOf(options.appUrl ?? process.env.NEXT_PUBLIC_APP_URL);
  if (appOrigin) allowed.add(appOrigin);
  return !allowed.has(originOf(origin) ?? "invalid");
}
