export interface OrderIntakeExtractRequest {
  text: string;
  sender: string | null;
  now: Date;
}

export interface OrderIntakeExtractResult {
  /** Sortie brute du modèle : toujours revalidée par Zod dans le domaine. */
  output: unknown;
  usage: { inputTokens: number; outputTokens: number };
}

/** Fournisseur de modèle interchangeable ; les tests utilisent une implémentation simulée. */
export interface OrderIntakeModelProvider {
  readonly model: string;
  extract(request: OrderIntakeExtractRequest): Promise<OrderIntakeExtractResult>;
}

export type OrderIntakeProviderErrorCode =
  | "not_configured"
  | "refusal"
  | "truncated"
  | "invalid_json"
  | "rate_limited"
  | "upstream";

export class OrderIntakeProviderError extends Error {
  constructor(
    readonly code: OrderIntakeProviderErrorCode,
    message: string,
    readonly usage: { inputTokens: number; outputTokens: number } = { inputTokens: 0, outputTokens: 0 }
  ) {
    super(message);
    this.name = "OrderIntakeProviderError";
  }
}
