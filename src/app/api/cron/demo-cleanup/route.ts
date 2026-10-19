import { NextResponse } from "next/server";
import {
  cleanupExpiredDemoSessions,
} from "@/domains/data-lifecycle/demo-cleanup-batch.service";
import {
  DEMO_CLEANUP_AUTHORIZATION,
} from "@/domains/data-lifecycle/demo-cleanup.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/**
 * Prépare le nettoyage planifié des seules sessions démo synthétiques.
 * Aucun horaire d'hébergement n'est installé par ce fichier. La route reste
 * inactive sans CRON_SECRET ET l'autorisation DATA-02 exacte.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (process.env.DEMO_CLEANUP_ENABLED !== DEMO_CLEANUP_AUTHORIZATION) {
    return NextResponse.json(
      { error: "Nettoyage des démos désactivé" },
      { status: 503 }
    );
  }

  try {
    const result = await cleanupExpiredDemoSessions({
      apply: true,
      authorization: process.env.DEMO_CLEANUP_ENABLED,
    });
    if (!result.success) {
      await reportOperationalIncident({
        source: "cron.demo-cleanup",
        fingerprint: result.remaining
          ? "demo-cleanup-backlog"
          : "demo-cleanup-blocked",
        summary: result.remaining
          ? "Le nettoyage des démos n'a pas vidé le lot."
          : "Des sessions démo expirées exigent une intervention.",
        severity: "warning",
        context: {
          processed: result.processed,
          blocked: result.counts.blocked,
          remaining: result.remaining,
        },
      });
    }
    return NextResponse.json(
      { data: result, success: result.success },
      { status: result.success ? 200 : 503 }
    );
  } catch {
    await reportOperationalIncident({
      source: "cron.demo-cleanup",
      fingerprint: "demo-cleanup-worker-crash",
      summary: "Erreur lors du nettoyage des démos",
      severity: "critical",
    });
    return NextResponse.json(
      { error: "Erreur lors du nettoyage des démos" },
      { status: 500 }
    );
  }
}
