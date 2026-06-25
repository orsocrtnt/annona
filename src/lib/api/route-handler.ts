import { NextResponse } from "next/server";

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message, success: false }, { status });
}

export async function withApiHandler(
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    console.error("[API Error]", error);
    const message =
      error instanceof Error ? error.message : "Erreur interne du serveur";
    return apiError(message);
  }
}
