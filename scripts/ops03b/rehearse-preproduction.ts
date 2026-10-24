import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { prisma } from "../../src/services/prisma/client";

type MonitorResult = {
  status: "healthy" | "down";
  previousStatus: "unknown" | "healthy" | "down";
  simulated: boolean;
  alertDelivery: "not_needed" | "disabled" | "sent" | "failed";
  publicHttpStatus: number | null;
  deepHttpStatus: number | null;
  database: string | null;
  storage: string | null;
  queue: string | null;
  checkedAt: string;
  durationMs: number;
};

const output = resolve(process.argv[2] ?? "outputs/ops03b/preproduction-rehearsal.json");
const alertOnly = process.argv.includes("--alert-only");
const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`OPS03B_MISSING_${name}`);
  return value;
};

async function upsertVaultSecret(name: string, value: string, description: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text
    FROM vault.secrets
    WHERE name = ${name}
    LIMIT 1
  `;
  if (rows[0]) {
    await prisma.$queryRaw<Array<{ ok: number }>>`
      WITH updated AS MATERIALIZED (
        SELECT vault.update_secret(${rows[0].id}::uuid, ${value}, ${name}, ${description})
      )
      SELECT 1::integer AS ok FROM updated
    `;
  } else {
    await prisma.$queryRaw<Array<{ ok: number }>>`
      WITH created AS MATERIALIZED (
        SELECT vault.create_secret(${value}, ${name}, ${description})
      )
      SELECT 1::integer AS ok FROM created
    `;
  }
}

async function runMonitor(simulate: boolean) {
  const rows = await prisma.$queryRaw<Array<{ result: MonitorResult }>>`
    SELECT ops_monitor.run(${simulate}) AS result
  `;
  if (!rows[0]?.result) throw new Error("OPS03B_MONITOR_RESULT_MISSING");
  return rows[0].result;
}

async function main() {
  const appUrl = required("OPS_MONITOR_APP_URL");
  const expectedRef = required("PREPROD_EXPECTED_SUPABASE_REF");
  const configuredRef = new URL(required("NEXT_PUBLIC_SUPABASE_URL")).hostname.split(".")[0];
  if (configuredRef !== expectedRef) throw new Error("OPS03B_PREPRODUCTION_REF_MISMATCH");
  if (!/\.vercel\.app$/i.test(new URL(appUrl).hostname)) {
    throw new Error("OPS03B_APP_HOST_NOT_PREPRODUCTION");
  }

  await upsertVaultSecret("ops03b_app_url", appUrl, "OPS-03B preproduction endpoint");
  await upsertVaultSecret(
    "ops03b_health_secret",
    required("OPS_HEALTH_SECRET"),
    "OPS-03B deep health bearer"
  );
  await upsertVaultSecret(
    "ops03b_vercel_bypass",
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ?? "",
    "OPS-03B Vercel automation bypass"
  );
  await upsertVaultSecret(
    "ops03b_webhook_url",
    required("OPS_MONITOR_WEBHOOK_URL"),
    "OPS-03B temporary test channel"
  );

  if (alertOnly) {
    const outage = await runMonitor(true);
    if (outage.status !== "down" || outage.alertDelivery !== "sent") {
      throw new Error("OPS03B_OUTAGE_ALERT_NOT_SENT");
    }
    const proof = {
      task: "OPS-03B-test-channel",
      passed: true,
      environment: "preproduction",
      simulatedOutage: outage,
      scheduleActivated: false,
      recoveryVerified: false,
      reason: "Vercel automation bypass approval pending",
      secretsPersistedIn: "Supabase Vault",
      businessDataMutations: 0,
    };
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ passed: true, outageAlert: outage.alertDelivery, scheduleActivated: false }));
    return;
  }

  required("VERCEL_AUTOMATION_BYPASS_SECRET");

  const baseline = await runMonitor(false);
  if (baseline.status !== "healthy") throw new Error("OPS03B_BASELINE_NOT_HEALTHY");

  const outage = await runMonitor(true);
  if (outage.status !== "down" || outage.alertDelivery !== "sent") {
    throw new Error("OPS03B_OUTAGE_ALERT_NOT_SENT");
  }

  const recovery = await runMonitor(false);
  if (recovery.status !== "healthy" || recovery.alertDelivery !== "sent") {
    throw new Error("OPS03B_RECOVERY_ALERT_NOT_SENT");
  }

  // N'activer la surveillance périodique qu'après une répétition complète réussie.
  await prisma.$queryRaw`SELECT cron.unschedule('ops03b-preproduction-health')`
    .catch(() => undefined);
  await prisma.$queryRaw`
    SELECT cron.schedule(
      'ops03b-preproduction-health',
      '*/30 * * * *',
      'SELECT ops_monitor.run(false);'
    )
  `;

  const proof = {
    task: "OPS-03B",
    passed: true,
    environment: "preproduction",
    monitor: {
      scheduler: "Supabase Cron",
      intervalMinutes: 30,
      owner: "TutelLiv product owner",
      retentionDays: 90,
    },
    baseline,
    simulatedOutage: outage,
    recovery,
    secretsPersistedIn: "Supabase Vault",
    businessDataMutations: 0,
  };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    passed: true,
    outageAlert: outage.alertDelivery,
    recoveryAlert: recovery.alertDelivery,
    recoveredInMs: recovery.durationMs,
    businessDataMutations: 0,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "OPS03B_REHEARSAL_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
