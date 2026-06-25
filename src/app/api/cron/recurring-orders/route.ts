import { NextResponse } from "next/server";
import { processDueRecurringOrders } from "@/domains/client-portal/recurring-order.service";

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
    const processed = await processDueRecurringOrders();
    return NextResponse.json({ processed, success: true });
  } catch (error) {
    console.error("[cron/recurring-orders] échec:", error);
    return NextResponse.json(
      { error: "Erreur lors du traitement des récurrences" },
      { status: 500 }
    );
  }
}
