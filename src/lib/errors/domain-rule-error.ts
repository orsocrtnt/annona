/**
 * Refus d'une règle métier, rédigé pour l'utilisateur et renvoyé tel quel par l'API (statut 4xx).
 * `code` permet à l'interface de proposer l'action suivante ; `details` ne contient jamais de donnée
 * d'une autre entreprise ni d'un autre commerçant.
 */
export class DomainRuleError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainRuleError";
  }
}
