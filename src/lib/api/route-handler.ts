import { NextResponse } from "next/server";

const INTERNAL_ERROR_MESSAGE = "Erreur interne du serveur";
/** Réglages modifiés par un autre enregistrement pendant celui-ci (réclamation sur updatedAt). */
export const SETTINGS_CONFLICT_MESSAGE = "Les réglages ont changé pendant l'enregistrement. Rechargez puis réessayez.";

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message, success: false }, { status });
}

/** Erreur dont le message, rédigé pour l'utilisateur, peut être renvoyé tel quel. */
export class ApiRouteError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "ApiRouteError";
  }
}

// Codes métier levés par les services et sûrs à traduire pour le client.
// Tout autre message (Prisma, réseau, code interne) reste dans le journal serveur.
const KNOWN_ERROR_CODES: Record<string, { status: number; message: string }> = {
  ACCOUNT_UNAVAILABLE: { status: 403, message: "Compte ou entreprise indisponible. Contactez votre administrateur." },
  USER_NOT_PROVISIONED: { status: 403, message: "Votre compte n'a pas été activé. Contactez votre administrateur." },
  COMPANY_NOT_FOUND: { status: 404, message: "Entreprise introuvable." },
  SETTINGS_CONFLICT: { status: 409, message: SETTINGS_CONFLICT_MESSAGE },
  USER_NOT_FOUND: { status: 404, message: "Compte introuvable." },
  RECURRING_SPECIAL_MISSION_UNSUPPORTED: { status: 400, message: "Les missions spéciales ne peuvent pas être récurrentes." },
};

/** Lit le corps JSON ; un corps mal formé devient une erreur 400 destinée au client. */
export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiRouteError("Requête invalide.", 400);
  }
}

// Erreurs de domaine dont le message est rédigé pour l'utilisateur (comparaison par nom :
// importer les services ici chargerait Prisma dans chaque route).
function namedDomainError(error: Error): { status: number; message: string } | null {
  if (error.name === "InvalidSupportReferenceError") return { status: 404, message: error.message };
  const status = (error as { status?: unknown }).status;
  if (error.name === "OrderAccessError" && typeof status === "number" && status >= 400 && status < 500) {
    return { status, message: error.message };
  }
  return null;
}

export function resolveApiError(error: unknown): { status: number; message: string } {
  if (error instanceof ApiRouteError) return { status: error.status, message: error.message };
  if (error instanceof Error) {
    if (error.name === "ZodError") return { status: 400, message: "Données invalides." };
    const named = namedDomainError(error);
    if (named) return named;
    if (Object.hasOwn(KNOWN_ERROR_CODES, error.message)) return KNOWN_ERROR_CODES[error.message]!;
  }
  return { status: 500, message: INTERNAL_ERROR_MESSAGE };
}

export async function withApiHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error("[API Error]", error);
    const { status, message } = resolveApiError(error);
    return apiError(message, status);
  }
}
