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

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const jobs = await processDueOperationJobs();
    let overdueInvoices: number | null = null;
    try {
      overdueInvoices = await markOverdueInvoices();
    } catch {
      // Message fixe : une erreur Prisma peut contenir des valeurs de requête.
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "invoice-overdue-sweep-failure",
        summary: "Passage des factures en retard impossible",
        severity: "error",
      });
    }
    const result = { ...jobs, overdueInvoices };
    // Les deux conditions sont évaluées : un échec terminal ne masque pas un retard.
    if (result.failed > 0) {
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "operation-jobs-terminal-failure",
        summary: "Des traitements opérationnels ont épuisé leurs tentatives.",
        severity: "critical",
        context: result,
      });
    }
    if (result.overdue > 0) {
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "operation-jobs-overdue",
        summary: "Des traitements opérationnels sont en attente depuis plus de 15 minutes.",
        severity: "error",
        context: result,
      });
    }
    if (result.failed > 0 || result.overdue > 0 || overdueInvoices === null) {
      return NextResponse.json({ data: result, success: false }, { status: 503 });
    }
    return NextResponse.json({ data: result, success: true });
  } catch (error) {
    await reportOperationalIncident({
      source: "cron.operations",
      fingerprint: "operation-jobs-worker-crash",
      summary: error instanceof Error ? error.message : "Erreur lors de la reprise des traitements",
      severity: "critical",
    });
    return NextResponse.json(
      { error: "Erreur lors de la reprise des traitements" },
      { status: 500 }
    );
  }
}
