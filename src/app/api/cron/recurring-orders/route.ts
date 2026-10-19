import { NextResponse } from "next/server";
import { processDueRecurringOrders } from "@/domains/client-portal/recurring-order.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * Génère les commandes des récurrences arrivées à échéance.
 * Protégé par CRON_SECRET (Vercel Cron envoie `Authorization: Bearer <CRON_SECRET>`).
 * Appelable par n'importe quel planificateur avec le même header.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const result = await processDueRecurringOrders();
    const success = result.failed === 0 && !result.hasMore;
    if (!success) {
      await reportOperationalIncident({
        source: "cron.recurring-orders",
        fingerprint: result.failed > 0 ? "recurring-orders-failure" : "recurring-orders-backlog",
        summary: result.failed > 0
          ? "Des commandes récurrentes n'ont pas pu être générées."
          : "Le traitement des commandes récurrentes n'a pas vidé la file.",
        severity: result.failed > 0 ? "critical" : "warning",
        context: result,
      });
    }
    return NextResponse.json(
      { ...result, success },
      { status: result.failed > 0 || result.hasMore ? 503 : 200 }
    );
  } catch (error) {
    await reportOperationalIncident({
      source: "cron.recurring-orders",
      fingerprint: "recurring-orders-worker-crash",
      summary: error instanceof Error ? error.message : "Erreur lors du traitement des récurrences",
      severity: "critical",
    });
    return NextResponse.json(
      { error: "Erreur lors du traitement des récurrences" },
      { status: 500 }
    );
  }
}
