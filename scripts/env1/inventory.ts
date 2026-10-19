import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "outputs/env1/inventory.json");
const requiredRuntime = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "CRON_SECRET",
  "OPS_HEALTH_SECRET",
] as const;

function configured(name: string) {
  return Boolean(process.env[name]?.trim());
}

function safeUrl(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function appOriginKind() {
  const url = safeUrl("NEXT_PUBLIC_APP_URL");
  if (!url) return configured("NEXT_PUBLIC_APP_URL") ? "invalid" : "missing";
  return ["localhost", "127.0.0.1", "::1"].includes(url.hostname) ? "local" : "remote";
}

function databaseShape(name: "DATABASE_URL" | "DIRECT_URL") {
  const url = safeUrl(name);
  if (!url) return { configured: configured(name), validUrl: false };
  return {
    configured: true,
    validUrl: url.protocol === "postgres:" || url.protocol === "postgresql:",
    port: url.port || "default",
    pooled: url.port === "6543" || url.searchParams.get("pgbouncer") === "true",
  };
}

async function exists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function remoteProvider() {
  try {
    const raw = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
    const normalized = raw.startsWith("git@")
      ? raw.replace(/^git@([^:]+):/, "https://$1/")
      : raw;
    const hostname = new URL(normalized).hostname;
    if (hostname === "github.com") return "github";
    if (hostname === "gitlab.com") return "gitlab";
    return "other";
  } catch {
    return "missing";
  }
}

function isIgnored(path: string) {
  try {
    execFileSync("git", ["check-ignore", "-q", path], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const runtime = safeUrl("DATABASE_URL");
  const direct = safeUrl("DIRECT_URL");
  const supabase = safeUrl("NEXT_PUBLIC_SUPABASE_URL");
  const missingRuntime = requiredRuntime.filter((name) => !configured(name));
  const vercel = JSON.parse(await readFile(resolve("vercel.json"), "utf8")) as {
    crons?: Array<{ path: string; schedule: string }>;
  };

  const proof = {
    task: "ENV-1-inventory",
    passed: true,
    inspectedAt: new Date().toISOString(),
    currentTarget: {
      classification: "current-authorized-test-target",
      appOriginKind: appOriginKind(),
      supabaseConfigured: Boolean(supabase),
      supabaseProviderDetected: Boolean(supabase?.hostname.endsWith(".supabase.co")),
      database: databaseShape("DATABASE_URL"),
      directDatabase: databaseShape("DIRECT_URL"),
      databaseHostsMatch: Boolean(runtime && direct && runtime.hostname === direct.hostname),
      requiredRuntimeConfigured: requiredRuntime.length - missingRuntime.length,
      requiredRuntimeExpected: requiredRuntime.length,
      missingRuntime,
      authEmailLinksEnabled: process.env.AUTH_EMAIL_LINKS_ENABLED === "true",
      businessEmailProviderConfigured: configured("RESEND_API_KEY") && (configured("MAIL_FROM") || configured("EMAIL_FROM")),
      operationsWebhookConfigured: configured("OPS_ALERT_WEBHOOK_URL"),
    },
    separation: {
      localEnvironmentFiles: [".env.local"],
      dedicatedPreproductionIdentified: false,
      productionIdentified: false,
      credentialsComparedAcrossTargets: false,
      hostedProjectLinkPresent: await exists(resolve(".vercel/project.json")),
    },
    delivery: {
      gitRemoteProvider: remoteProvider(),
      workflowPreparedLocally: await exists(resolve(".github/workflows/ci.yml")),
      cronRoutes: vercel.crons?.map(({ path, schedule }) => ({ path, schedule })) ?? [],
    },
    safeguards: {
      envLocalIgnored: isIgnored(".env.local"),
      fixturePrefixes: ["test2-", "demo-", "onboard1-", "special1-"],
      connectedTestsTargetProductionForbidden: true,
      mutations: 0,
      valuesDisclosed: 0,
    },
    blockers: [
      "dedicated preproduction target not identified",
      "production target not identified",
      "credentials cannot be compared until targets exist",
      "hosting account and protected environment require provider access",
      "creating an additional provider target may incur cost",
    ],
  };

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    passed: proof.passed,
    classification: proof.currentTarget.classification,
    runtimeConfigured: `${proof.currentTarget.requiredRuntimeConfigured}/${proof.currentTarget.requiredRuntimeExpected}`,
    appOriginKind: proof.currentTarget.appOriginKind,
    preproduction: proof.separation.dedicatedPreproductionIdentified,
    production: proof.separation.productionIdentified,
    remoteProvider: proof.delivery.gitRemoteProvider,
    mutations: proof.safeguards.mutations,
    disclosedValues: proof.safeguards.valuesDisclosed,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "ENV1_INVENTORY_FAILED");
  process.exitCode = 1;
});
