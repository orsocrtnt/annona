/**
 * Requête d'authentification bornée dans le temps : sans réponse, la requête est annulée (AbortController) et
 * l'appelant reçoit RequestTimeoutError, pour rendre le bouton et rouvrir la garde d'envoi. Une réponse qui arrive
 * après l'abandon est ignorée. Le délai couvre aussi la lecture du corps de la réponse.
 */
export const AUTH_REQUEST_TIMEOUT_MS = 15_000;
export const AUTH_TIMEOUT_MESSAGE = "Le serveur ne répond pas, réessayez";

export class RequestTimeoutError extends Error {
  constructor() {
    super("REQUEST_TIMEOUT");
    this.name = "RequestTimeoutError";
  }
}

export type JsonResult = { ok: boolean; status: number; /** null si le corps n'est pas du JSON (page HTML d'un 502, coupure). */ json: any };

export function requestJsonWithTimeout(
  url: string,
  init: RequestInit,
  { timeoutMs = AUTH_REQUEST_TIMEOUT_MS, fetchImpl = fetch }: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<JsonResult> {
  const controller = new AbortController();
  return new Promise<JsonResult>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      controller.abort();
      reject(new RequestTimeoutError());
    }, timeoutMs);
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    fetchImpl(url, { ...init, signal: controller.signal }).then(
      async (response) => {
        const json = await response.json().catch(() => null);
        finish(() => resolve({ ok: response.ok, status: response.status, json }));
      },
      (error) => finish(() => reject(error))
    );
  });
}
