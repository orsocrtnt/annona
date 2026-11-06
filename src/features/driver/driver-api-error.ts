/**
 * Erreur d'un appel de l'application livreur. `retryable` dit à la file hors réseau
 * (`offline-action-queue.ts`) si l'action doit être rejouée au retour du réseau (LIV-06).
 */
export class DriverApiError extends Error {
  code?: string;
  status?: number;
  retryable?: boolean;

  constructor(message: string, extras?: Partial<Pick<DriverApiError, "code" | "status" | "retryable">>) {
    super(message);
    this.name = "DriverApiError";
    Object.assign(this, extras);
  }
}
