import { NextResponse } from "next/server";
import { processDueOperationJobs } from "@/domains/operations/operation-job.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * Reprend les effets différés (dispatch et notifications) après une erreur ou
 * une interruption. À appeler chaque minute avec le même CRON_SECRET que les
 * commandes récurrentes.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const result = await processDueOperationJobs();
    if (result.failed > 0) {
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "operation-jobs-terminal-failure",
        summary: "Des traitements opérationnels ont épuisé leurs tentatives.",
        severity: "critical",
        context: result,
      });
      return NextResponse.json({ data: result, success: false }, { status: 503 });
    }
    if (result.overdue > 0) {
      await reportOperationalIncident({
        source: "cron.operations",
        fingerprint: "operation-jobs-overdue",
        summary: "Des traitements opérationnels sont en attente depuis plus de 15 minutes.",
        severity: "error",
        context: result,
      });
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
