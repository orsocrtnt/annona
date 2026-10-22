import { NextResponse } from "next/server";
import {
  getDemoPoolStats,
  maintainDemoPool,
} from "@/domains/demo/demo-pool.service";
import { reportOperationalIncident } from "@/lib/operations/incident-reporter";

/** Reprend les recyclages DEMO-2 interrompus et les locations expirées. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const results = await maintainDemoPool({ limit: 3 });
    const stats = await getDemoPoolStats();
    const degraded = results.some((result) =>
      result.status === "quarantined" || result.status === "retry"
    );
    if (degraded || stats.quarantined > 0) {
      await reportOperationalIncident({
        source: "cron.demo-pool",
        fingerprint: "demo-pool-degraded",
        summary: "Le stock de démonstration exige une intervention.",
        severity: stats.ready === 0 ? "critical" : "warning",
        context: {
          ready: stats.ready,
          leased: stats.leased,
          quarantined: stats.quarantined,
          processed: results.length,
        },
      });
    }
    return NextResponse.json(
      { success: !degraded, data: { stats, processed: results.length } },
      { status: degraded ? 503 : 200 }
    );
  } catch (error) {
    await reportOperationalIncident({
      source: "cron.demo-pool",
      fingerprint: "demo-pool-worker-crash",
      summary: error instanceof Error ? error.message : "Erreur du worker de démonstration",
      severity: "critical",
    });
    return NextResponse.json({ error: "Erreur du worker de démonstration" }, { status: 500 });
  }
}
