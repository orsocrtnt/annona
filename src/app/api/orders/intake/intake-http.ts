import { NextResponse } from "next/server";

/** Réponses de la commande par message : jamais de détail interne, jamais de cache. */
export function intakeJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function intakeError(code: string, error: string, status: number, headers: Record<string, string> = {}) {
  return intakeJson({ success: false, code, error }, status, headers);
}

/** Une panne (base, migration absente, réseau) rend un 503 générique plutôt qu'un 500 bavard. */
export async function withIntakeErrors(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error("[order-intake] échec", error instanceof Error ? error.name : "unknown");
    return intakeError("INTAKE_UNAVAILABLE", "Service momentanément indisponible. Réessayez dans un instant.", 503);
  }
}
