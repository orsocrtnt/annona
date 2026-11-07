import { NextResponse } from "next/server";
import { generateDueInvoices } from "@/domains/invoice/invoice-generation.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * FACT-1 (ADM-10) : facture les périodes terminées selon la périodicité de chaque commerçant (hier pour
 * une facturation journalière, la semaine passée le lundi, le mois passé le 1er, l'année passée le
 * 1er janvier), retards compris, et met chaque facture créée dans la file d'envoi par e-mail.
 * Idempotent : un appel de plus ne crée aucun doublon ni aucun trou de numérotation.
 *
 * Déclenchement : cron Vercel quotidien (vercel.json, 6 h 10 UTC) et GitHub Actions
 * (.github/workflows/cron-daily.yml, 6 h UTC) pour la préproduction. Même secret que les autres crons.
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
    // Compteurs seulement : aucune donnée de facture ni de client.
    const data = await generateDueInvoices({ now });
    if (data.failed > 0) {
      await reportOperationalIncident({
        source: "cron.billing",
        fingerprint: "billing-generation-failure",
        summary: "Génération de factures de période impossible pour au moins un client",
        severity: "critical",
        context: { companies: data.companies, created: data.created, failed: data.failed },
      });
      return NextResponse.json({ data, success: false }, { status: 503 });
    }
    // Lot non vidé : 503 avec hasMore, le workflow rappelle (idempotent).
    if (data.hasMore) return NextResponse.json({ data, success: false }, { status: 503 });
    return NextResponse.json({ data, success: true });
  } catch {
    await reportOperationalIncident({
      source: "cron.billing",
      fingerprint: "billing-generation-crash",
      summary: "Génération des factures de période interrompue",
      severity: "critical",
    });
    return NextResponse.json({ error: "Erreur lors de la génération des factures" }, { status: 500 });
  }
}
