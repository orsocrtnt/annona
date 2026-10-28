import { NextResponse } from "next/server";

const INTERNAL_ERROR_MESSAGE = "Erreur interne du serveur";

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
  SAAS_FEATURE_NOT_AVAILABLE: { status: 403, message: "Cette fonctionnalité n'est pas incluse dans votre offre." },
  SAAS_ACCOUNT_READ_ONLY: { status: 403, message: "Le compte est en lecture seule." },
  COMPANY_NOT_FOUND: { status: 404, message: "Entreprise introuvable." },
};

export function resolveApiError(error: unknown): { status: number; message: string } {
  if (error instanceof ApiRouteError) return { status: error.status, message: error.message };
  if (error instanceof Error) {
    if (error.name === "ZodError") return { status: 400, message: "Données invalides." };
    // request.json() sur un corps mal formé.
    if (error instanceof SyntaxError) return { status: 400, message: "Requête invalide." };
    const known = KNOWN_ERROR_CODES[error.message];
    if (known) return known;
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
