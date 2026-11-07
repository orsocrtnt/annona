import { NextResponse } from "next/server";
import { lockDueDeliveryDates } from "@/domains/order/order-lock.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * LOCK-1 (RG-01, RG-04, RG-05, RG-09) : verrouille les dates dont l'heure limite est passée et qui
 * n'ont pas encore été traitées, pour toutes les entreprises actives (aujourd'hui et demain, fuseau
 * de chaque entreprise). Idempotent : un appel de plus ne change rien.
 *
 * Déclenchement : GitHub Actions toutes les 10 minutes (.github/workflows/cron-lock-orders.yml) et
 * cron Vercel quotidien (vercel.json, filet de sécurité). En plus, les écrans boulanger et
 * administrateur verrouillent la date à l'ouverture (`ensureDateLocked`) : un cron en retard ne
 * bloque jamais la production. Même secret que /api/cron/operations.
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
    const results = await lockDueDeliveryDates({ now });
    const failed = results.filter((result) => !result.ok).length;
    const data = {
      processed: results.length,
      failed,
      // Compteurs seulement : aucune donnée de commande ni de client.
      results: results.map(({ companyId, date, ok, summary }) => ({
        companyId,
        date,
        ok,
        recurringGenerated: summary?.recurringGenerated ?? 0,
        ordersLocked: summary?.ordersLocked ?? 0,
        roundsCreated: summary?.roundsCreated ?? 0,
        stopsCreated: summary?.stopsCreated ?? 0,
      })),
    };
    if (failed > 0) {
      await reportOperationalIncident({
        source: "cron.lock-orders",
        fingerprint: "lock-orders-failure",
        summary: "Verrouillage d'une date de livraison impossible",
        severity: "critical",
        context: { processed: results.length, failed },
      });
      return NextResponse.json({ data, success: false }, { status: 503 });
    }
    return NextResponse.json({ data, success: true });
  } catch {
    await reportOperationalIncident({
      source: "cron.lock-orders",
      fingerprint: "lock-orders-crash",
      summary: "Verrouillage des dates de livraison interrompu",
      severity: "critical",
    });
    return NextResponse.json({ error: "Erreur lors du verrouillage" }, { status: 500 });
  }
}
