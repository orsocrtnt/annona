import { NextResponse } from "next/server";
import { processDueOperationJobs } from "@/domains/operations/operation-job.service";
import { markOverdueInvoices } from "@/domains/invoice/invoice-overdue.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * Reprend les effets différés (dispatch et notifications) après une erreur ou
 * une interruption. Appelée toutes les 5 minutes par GitHub Actions
 * (.github/workflows/cron-operations.yml) avec le même CRON_SECRET que les
 * commandes récurrentes.
 * DEMO-3 : passe aussi en retard les factures PENDING échues (mise à jour
 * conditionnelle idempotente) ; un échec est signalé sans bloquer les tâches.
 */
// Un lot de 50 tâches (dispatch, e-mails) doit pouvoir finir : durée maximale
// explicite ; le --max-time du workflow GitHub doit rester supérieur ou égal.
export const maxDuration = 60;

/** Passage en retard indépendant des tâches durables : exécuté dans tous les cas, échec signalé. */
async function runOverdueInvoiceSweep(): Promise<number | null> {
  try {
    return await markOverdueInvoices();
  } catch {
    // Message fixe : une erreur Prisma peut contenir des valeurs de requête.
    await reportOperationalIncident({
      source: "cron.operations",
      fingerprint: "invoice-overdue-sweep-failure",
      summary: "Passage des factures en retard impossible",
      severity: "error",
    });
    return null;
  }
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const overdueInvoices = await runOverdueInvoiceSweep();
  // Tournées automatiques : un échec ne doit pas bloquer le traitement des tâches.
  await import("@/domains/delivery/delivery-rounds.service")
    .then(({ runDueAutoRounds }) => runDueAutoRounds())
    .catch((error) => console.warn("[cron.auto-rounds]", error instanceof Error ? error.message : "FAILED"));
  // Conservation publiée des messages Contact : un échec ne doit pas bloquer le traitement des tâches.
  await import("@/domains/growth/contact.service")
    .then(({ purgeExpiredContactMessages }) => purgeExpiredContactMessages())
    .catch((error) => console.warn("[cron.contact-retention]", error instanceof Error ? error.message : "FAILED"));
  try {
    const { details, ...counts } = await processDueOperationJobs();
    // Compteurs seuls pour les alertes ; le détail par tâche (identifiant interne, type, nature, code
    // d'erreur, jamais de texte libre ni de donnée personnelle) n'est renvoyé qu'à l'appelant du cron.
    const context = { ...counts, overdueInvoices };
    // Les deux conditions sont évaluées : un échec terminal ne masque pas un retard.
    if (counts.failed > 0) {
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "operation-jobs-terminal-failure",
        summary: "Des traitements opérationnels ont épuisé leurs tentatives.",
        severity: "critical",
        context,
      });
    }
    if (counts.overdue > 0) {
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "operation-jobs-overdue",
        summary: "Des traitements opérationnels sont en attente depuis plus de 15 minutes.",
        severity: "error",
        context,
      });
    }
    const data = { ...context, jobs: details };
    // Erreur seulement sur un échec réel : tâche épuisée, tâche bloquée au-delà de 15 minutes, ou
    // passage des factures en retard impossible. Une tâche ignorée (service désactivé) ou rejouée plus
    // tard ne l'est pas (RECETTE-2810, point 10).
    if (counts.failed > 0 || counts.overdue > 0 || overdueInvoices === null) {
      return NextResponse.json({ data, success: false }, { status: 503 });
    }
    return NextResponse.json({ data, success: true });
  } catch {
    await reportOperationalIncident({
      source: "cron.operations",
      fingerprint: "operation-jobs-worker-crash",
      // Message fixe : une erreur Prisma peut contenir des valeurs de requête (adresse, nom).
      summary: "Reprise des traitements interrompue",
      severity: "critical",
    });
    return NextResponse.json(
      { error: "Erreur lors de la reprise des traitements" },
      { status: 500 }
    );
  }
}
