import { NextResponse } from "next/server";
import { kickOperationJobs } from "@/domains/operations/operation-job.service";
import { queueOrderReminders } from "@/domains/notification/merchant-notification.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * NOTIF-1 (NOT-01) : rappel aux clients qui n'ont pas commandé pour le lendemain, `reminderLeadMinutes`
 * avant l'heure limite de chaque entreprise active. Idempotent (une tâche par compte, client et date) :
 * appelé toutes les 10 minutes par le workflow du verrouillage (.github/workflows/cron-lock-orders.yml),
 * avec le même secret que les autres crons. Les tâches sont lancées aussitôt ; /api/cron/operations
 * reprend celles qui échouent.
 *
 * Recette locale seulement : `?now=AAAA-MM-JJTHH:MM:SSZ` simule l'heure (refusé en production).
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let now = new Date();
  const simulated = new URL(request.url).searchParams.get("now");
  if (simulated) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Paramètre « now » refusé en production." }, { status: 400 });
    }
    now = new Date(simulated);
    if (Number.isNaN(now.getTime())) return NextResponse.json({ error: "Paramètre « now » invalide." }, { status: 400 });
  }

  try {
    const result = await queueOrderReminders({ now });
    kickOperationJobs(result.jobIds);
    // Compteurs seulement : aucun nom de client.
    return NextResponse.json({
      data: { companies: result.companies, windows: result.windows, queued: result.queued },
      success: true,
    });
  } catch {
    await reportOperationalIncident({
      source: "cron.order-reminders",
      fingerprint: "order-reminders-crash",
      summary: "Rappels avant l'heure limite interrompus",
      severity: "error",
    });
    return NextResponse.json({ error: "Erreur lors des rappels" }, { status: 500 });
  }
}
